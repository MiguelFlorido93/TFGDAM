const router = require('express').Router();
const pool = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

// =============================================================
// Helper: aplica una transición a UNA reserva dentro de una transacción.
// accion ∈ {'confirmar','entregar','cancelar'}.
// Lanza Error si la transición no es legítima.
// =============================================================
async function transitarReserva(conn, id, accion, user) {
    const [[r]] = await conn.query(
        'SELECT usuario_id, producto_id, cantidad, estado FROM reservas WHERE id = ? FOR UPDATE',
        [id]
    );
    if (!r) throw new Error('Reserva no encontrada');

    if (accion === 'cancelar') {
        if (user.rol === 'cliente' && r.usuario_id !== user.id) throw new Error('No autorizado');
        if (r.estado === 'cancelada') throw new Error('Ya cancelada');
        if (r.estado === 'entregada') throw new Error('Ya entregada');
        await conn.query("UPDATE reservas SET estado = 'cancelada' WHERE id = ?", [id]);
        await conn.query('UPDATE productos SET stock_reservado = GREATEST(0, stock_reservado - ?) WHERE id = ?', [
            r.cantidad,
            r.producto_id,
        ]);
        await conn.query(
            `INSERT INTO movimientos (producto_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, motivo)
             VALUES (?, ?, 'liberacion', ?, 0, 0, ?)`,
            [r.producto_id, user.id, r.cantidad, `Cancelación reserva #${id}`]
        );
        return;
    }

    // La reactivacion trabaja sobre reservas en estado final (entregada/cancelada).
    // Por eso se procesa antes de los guards generales.
    if (accion === 'reactivar_pendiente' || accion === 'reactivar_confirmada') {
        if (!['admin', 'operario'].includes(user.rol)) throw new Error('No autorizado');
        if (!['entregada', 'cancelada'].includes(r.estado))
            throw new Error('Sólo se pueden reactivar reservas entregadas o canceladas');
        const target = accion === 'reactivar_pendiente' ? 'pendiente' : 'confirmada';

        const [[prod]] = await conn.query(
            'SELECT stock, stock_reservado FROM productos WHERE id = ? FOR UPDATE',
            [r.producto_id]
        );

        if (r.estado === 'entregada') {
            // El stock fisico se entrego: lo recuperamos y volvemos a marcarlo como reservado
            const nuevoStock = prod.stock + r.cantidad;
            await conn.query(
                'UPDATE productos SET stock = stock + ?, stock_reservado = stock_reservado + ? WHERE id = ?',
                [r.cantidad, r.cantidad, r.producto_id]
            );
            await conn.query(
                `INSERT INTO movimientos (producto_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, motivo)
                 VALUES (?, ?, 'entrada', ?, ?, ?, ?)`,
                [r.producto_id, user.id, r.cantidad, prod.stock, nuevoStock, `Reversión entrega reserva #${id}`]
            );
            await conn.query(
                `INSERT INTO movimientos (producto_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, motivo)
                 VALUES (?, ?, 'reserva', ?, ?, ?, ?)`,
                [r.producto_id, user.id, r.cantidad, nuevoStock, nuevoStock, `Reactivación reserva #${id}`]
            );
        } else {
            // cancelada -> stock fisico nunca se toco. Solo hay que volver a reservar.
            const disponible = prod.stock - prod.stock_reservado;
            if (r.cantidad > disponible)
                throw new Error(`Stock insuficiente para reactivar (disponible: ${disponible}, necesarios: ${r.cantidad})`);
            await conn.query('UPDATE productos SET stock_reservado = stock_reservado + ? WHERE id = ?', [
                r.cantidad,
                r.producto_id,
            ]);
            await conn.query(
                `INSERT INTO movimientos (producto_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, motivo)
                 VALUES (?, ?, 'reserva', ?, ?, ?, ?)`,
                [r.producto_id, user.id, r.cantidad, prod.stock, prod.stock, `Reactivación reserva #${id}`]
            );
        }

        // Limpiamos fecha_entrega si la tenía
        await conn.query('UPDATE reservas SET estado = ?, fecha_entrega = NULL WHERE id = ?', [target, id]);
        return;
    }

    // confirmar / entregar requieren staff y reserva no cancelada
    if (!['admin', 'operario'].includes(user.rol)) throw new Error('No autorizado');
    if (r.estado === 'cancelada') throw new Error('Reserva cancelada');

    if (accion === 'confirmar') {
        if (r.estado !== 'pendiente') throw new Error('Sólo se pueden confirmar reservas pendientes');
        // Registramos quién confirma (columna añadida por migración M001).
        // Si la migración aún no se aplicó, hacemos fallback al UPDATE original.
        try {
            await conn.query(
                "UPDATE reservas SET estado = 'confirmada', confirmada_por_id = ? WHERE id = ?",
                [user.id, id]
            );
        } catch (e) {
            if (/Unknown column/i.test(e.message)) {
                await conn.query("UPDATE reservas SET estado = 'confirmada' WHERE id = ?", [id]);
            } else throw e;
        }
        return;
    }

    if (accion === 'entregar') {
        if (r.estado === 'entregada') throw new Error('Ya entregada');
        const [[prod]] = await conn.query('SELECT stock, stock_reservado FROM productos WHERE id = ? FOR UPDATE', [
            r.producto_id,
        ]);
        await conn.query(
            'UPDATE productos SET stock = stock - ?, stock_reservado = GREATEST(0, stock_reservado - ?) WHERE id = ?',
            [r.cantidad, r.cantidad, r.producto_id]
        );
        // Registramos quién entrega (columna añadida por migración M001).
        try {
            await conn.query(
                "UPDATE reservas SET estado = 'entregada', fecha_entrega = NOW(), entregada_por_id = ? WHERE id = ?",
                [user.id, id]
            );
        } catch (e) {
            if (/Unknown column/i.test(e.message)) {
                await conn.query("UPDATE reservas SET estado = 'entregada', fecha_entrega = NOW() WHERE id = ?", [id]);
            } else throw e;
        }
        await conn.query(
            `INSERT INTO movimientos (producto_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, motivo)
             VALUES (?, ?, 'salida', ?, ?, ?, ?)`,
            [r.producto_id, user.id, r.cantidad, prod.stock, prod.stock - r.cantidad, `Entrega reserva #${id}`]
        );
        return;
    }

    throw new Error('Acción no reconocida');
}

// GET /api/reservas
router.get('/', authRequired, async (req, res) => {
    const params = [];
    const where = [];
    if (req.user.rol === 'cliente') {
        where.push('r.usuario_id = ?');
        params.push(req.user.id);
    } else if (req.query.usuario_id) {
        where.push('r.usuario_id = ?');
        params.push(req.query.usuario_id);
    }
    // estado puede ser un valor único o una lista separada por comas.
    // Atajos: ?activas=1 -> pendiente+confirmada · ?historico=1 -> entregada+cancelada
    let estados = null;
    if (req.query.activas === '1') estados = ['pendiente', 'confirmada'];
    else if (req.query.historico === '1') estados = ['entregada', 'cancelada'];
    else if (req.query.estado) estados = String(req.query.estado).split(',').map(s => s.trim()).filter(Boolean);
    if (estados && estados.length) {
        where.push(`r.estado IN (${estados.map(() => '?').join(',')})`);
        params.push(...estados);
    }

    // Busqueda por "codigo": acepta id numerico de la reserva, SKU exacto o
    // substring del SKU/nombre del producto. Si empieza por # se trata como id.
    if (req.query.q) {
        const raw = String(req.query.q).trim();
        if (raw) {
            const soloDigitos = raw.replace(/^#/, '');
            if (/^\d+$/.test(soloDigitos)) {
                where.push('(r.id = ? OR p.sku LIKE ?)');
                params.push(Number(soloDigitos), `%${raw}%`);
            } else {
                where.push('(p.sku LIKE ? OR p.nombre LIKE ?)');
                params.push(`%${raw}%`, `%${raw}%`);
            }
        }
    }

    // Rango de fechas sobre fecha_reserva. Formato esperado: YYYY-MM-DD.
    if (req.query.desde) {
        where.push('r.fecha_reserva >= ?');
        params.push(req.query.desde + ' 00:00:00');
    }
    if (req.query.hasta) {
        where.push('r.fecha_reserva <= ?');
        params.push(req.query.hasta + ' 23:59:59');
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [rows] = await pool.query(
        `SELECT r.id, r.cantidad, r.estado, r.fecha_reserva, r.fecha_recogida, r.fecha_entrega, r.notas,
                u.id AS usuario_id, u.nombre AS usuario, u.email AS usuario_email,
                p.id AS producto_id, p.sku, p.nombre AS producto, p.ubicacion, p.precio
           FROM reservas r
           JOIN usuarios  u ON u.id = r.usuario_id
           JOIN productos p ON p.id = r.producto_id
           ${whereSql}
           ORDER BY r.fecha_reserva DESC
           LIMIT 500`,
        params
    );
    res.json(rows);
});

// GET /api/reservas/:id  → detalle enriquecido para la app móvil
// Incluye nombres de quien confirmó/entregó (si las columnas existen) y
// la lista de incidencias asociadas (si la tabla existe).
router.get('/:id', authRequired, async (req, res) => {
    try {
        const [[base]] = await pool.query(
            `SELECT r.*, u.nombre AS usuario, u.email AS usuario_email,
                    p.id AS producto_id, p.sku, p.nombre AS producto,
                    p.descripcion AS producto_descripcion, p.ubicacion, p.precio
               FROM reservas r
               JOIN usuarios  u ON u.id = r.usuario_id
               JOIN productos p ON p.id = r.producto_id
              WHERE r.id = ?`,
            [req.params.id]
        );
        if (!base) return res.status(404).json({ error: 'Reserva no encontrada' });

        // Cliente solo puede ver SUS reservas.
        if (req.user.rol === 'cliente' && base.usuario_id !== req.user.id) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        // Nombres de quién confirmó/entregó (las columnas pueden no existir
        // si la migración M001 aún no se aplicó; en ese caso `base.confirmada_por_id`
        // será undefined y nos saltamos el lookup).
        let confirmada_por = null;
        let entregada_por = null;
        if (base.confirmada_por_id) {
            const [[u]] = await pool.query('SELECT id, nombre, email FROM usuarios WHERE id = ?', [base.confirmada_por_id]);
            if (u) confirmada_por = u;
        }
        if (base.entregada_por_id) {
            const [[u]] = await pool.query('SELECT id, nombre, email FROM usuarios WHERE id = ?', [base.entregada_por_id]);
            if (u) entregada_por = u;
        }

        // Incidencias asociadas (si la tabla existe)
        let incidencias = [];
        try {
            const [rows] = await pool.query(
                `SELECT i.id, i.tipo, i.descripcion, i.creado_en,
                        u.id AS operario_id, u.nombre AS operario, u.email AS operario_email
                   FROM incidencias i
              LEFT JOIN usuarios u ON u.id = i.operario_id
                  WHERE i.reserva_id = ?
                  ORDER BY i.creado_en DESC`,
                [req.params.id]
            );
            incidencias = rows;
        } catch (e) {
            if (!/doesn't exist|no existe/i.test(e.message)) throw e;
        }

        res.json({ ...base, confirmada_por, entregada_por, incidencias });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/reservas/:id/incidencias  (operario/admin)
// body: { tipo: 'rotura'|'faltante'|'mal_estado'|'otro', descripcion: string }
router.post('/:id/incidencias', authRequired, requireRole('admin', 'operario'), async (req, res) => {
    const tiposValidos = ['rotura', 'faltante', 'mal_estado', 'otro'];
    const tipo = tiposValidos.includes(req.body?.tipo) ? req.body.tipo : 'otro';
    const descripcion = String(req.body?.descripcion || '').trim();
    if (!descripcion) return res.status(400).json({ error: 'Descripción obligatoria' });
    if (descripcion.length > 2000) return res.status(400).json({ error: 'Descripción demasiado larga' });

    try {
        // Verificar que la reserva existe (para devolver 404 limpio)
        const [[r]] = await pool.query('SELECT id FROM reservas WHERE id = ?', [req.params.id]);
        if (!r) return res.status(404).json({ error: 'Reserva no encontrada' });

        const [ins] = await pool.query(
            `INSERT INTO incidencias (reserva_id, operario_id, tipo, descripcion)
             VALUES (?, ?, ?, ?)`,
            [req.params.id, req.user.id, tipo, descripcion]
        );
        const [[incidencia]] = await pool.query(
            `SELECT i.id, i.tipo, i.descripcion, i.creado_en,
                    u.id AS operario_id, u.nombre AS operario, u.email AS operario_email
               FROM incidencias i
          LEFT JOIN usuarios u ON u.id = i.operario_id
              WHERE i.id = ?`,
            [ins.insertId]
        );
        res.status(201).json(incidencia);
    } catch (e) {
        if (/doesn't exist|no existe/i.test(e.message)) {
            return res.status(503).json({ error: 'Tabla de incidencias no creada — reinicia el servicio' });
        }
        res.status(500).json({ error: e.message });
    }
});

// POST /api/reservas
router.post('/', authRequired, async (req, res) => {
    const { producto_id, cantidad, fecha_recogida, notas } = req.body || {};
    const usuario_id = req.user.id;
    if (!producto_id || !cantidad || cantidad < 1) return res.status(400).json({ error: 'Datos inválidos' });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[prod]] = await conn.query(
            'SELECT stock, stock_reservado FROM productos WHERE id = ? AND activo = 1 FOR UPDATE',
            [producto_id]
        );
        if (!prod) {
            await conn.rollback();
            return res.status(404).json({ error: 'Producto inexistente' });
        }

        const disponible = prod.stock - prod.stock_reservado;
        if (cantidad > disponible) {
            await conn.rollback();
            return res.status(409).json({ error: `Stock insuficiente (disponible: ${disponible})` });
        }

        await conn.query('UPDATE productos SET stock_reservado = stock_reservado + ? WHERE id = ?', [
            cantidad,
            producto_id,
        ]);
        const [ins] = await conn.query(
            `INSERT INTO reservas (usuario_id, producto_id, cantidad, fecha_recogida, notas)
             VALUES (?, ?, ?, ?, ?)`,
            [usuario_id, producto_id, cantidad, fecha_recogida || null, notas || null]
        );
        await conn.query(
            `INSERT INTO movimientos (producto_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, motivo)
             VALUES (?, ?, 'reserva', ?, ?, ?, ?)`,
            [producto_id, usuario_id, cantidad, prod.stock, prod.stock, `Reserva #${ins.insertId}`]
        );
        await conn.commit();
        res.status(201).json({ id: ins.insertId });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally {
        conn.release();
    }
});

// POST /api/reservas/bulk  → aplica una misma acción a varias reservas
// body: { ids: [...], accion: 'confirmar' | 'entregar' | 'cancelar' }
router.post('/bulk', authRequired, async (req, res) => {
    const { ids, accion } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids vacío' });
    if (ids.length > 100) return res.status(400).json({ error: 'Máximo 100 reservas por operación' });
    if (!['confirmar', 'entregar', 'cancelar'].includes(accion))
        return res.status(400).json({ error: 'Acción no válida' });
    if (req.user.rol === 'cliente' && accion !== 'cancelar') {
        return res.status(403).json({ error: 'Sólo puedes cancelar tus reservas' });
    }

    const resultados = [];
    for (const id of ids) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            await transitarReserva(conn, id, accion, req.user);
            await conn.commit();
            resultados.push({ id, ok: true });
        } catch (e) {
            await conn.rollback();
            resultados.push({ id, ok: false, error: e.message });
        } finally {
            conn.release();
        }
    }
    const aplicadas = resultados.filter(r => r.ok).length;
    res.json({ aplicadas, fallidas: resultados.length - aplicadas, resultados });
});

// PATCH /api/reservas/:id/estado  (operario/admin) — adaptador al helper
// Body { estado: 'confirmada'|'entregada'|'pendiente'|'cancelada' }.
// pendiente/confirmada sobre una reserva entregada o cancelada -> reactivación.
router.patch('/:id/estado', authRequired, requireRole('admin', 'operario'), async (req, res) => {
    const estado = req.body?.estado;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        let accion;
        if (estado === 'confirmada' || estado === 'pendiente') {
            // Decidir entre 'confirmar' (pendiente->confirmada) y 'reactivar_*' (final->activa)
            const [[cur]] = await conn.query('SELECT estado FROM reservas WHERE id = ?', [req.params.id]);
            if (!cur) throw new Error('Reserva no encontrada');
            if (cur.estado === 'entregada' || cur.estado === 'cancelada') {
                accion = estado === 'pendiente' ? 'reactivar_pendiente' : 'reactivar_confirmada';
            } else if (estado === 'confirmada') {
                accion = 'confirmar';
            } else {
                throw new Error('Sólo se puede volver a pendiente desde entregada/cancelada');
            }
        } else if (estado === 'entregada') {
            accion = 'entregar';
        } else if (estado === 'cancelada') {
            accion = 'cancelar';
        } else {
            throw new Error('Estado inválido');
        }

        await transitarReserva(conn, req.params.id, accion, req.user);
        await conn.commit();
        res.json({ ok: true });
    } catch (e) {
        await conn.rollback();
        res.status(/no encontrada/i.test(e.message) ? 404 : 400).json({ error: e.message });
    } finally {
        conn.release();
    }
});

// DELETE /api/reservas/:id  (cancelar) — adaptador al helper
router.delete('/:id', authRequired, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await transitarReserva(conn, req.params.id, 'cancelar', req.user);
        await conn.commit();
        res.json({ ok: true });
    } catch (e) {
        await conn.rollback();
        const m = e.message;
        const code = /no encontrada/i.test(m) ? 404 : /no autorizado/i.test(m) ? 403 : 400;
        res.status(code).json({ error: m });
    } finally {
        conn.release();
    }
});

module.exports = router;
