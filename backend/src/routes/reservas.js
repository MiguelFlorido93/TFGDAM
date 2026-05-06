const router = require('express').Router();
const pool = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

// GET /api/reservas
// - cliente: solo las suyas
// - operario/admin: todas (filtros opcionales)
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
    if (req.query.estado) {
        where.push('r.estado = ?');
        params.push(req.query.estado);
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
           LIMIT 500`, params);
    res.json(rows);
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
            [producto_id]);
        if (!prod) { await conn.rollback(); return res.status(404).json({ error: 'Producto inexistente' }); }

        const disponible = prod.stock - prod.stock_reservado;
        if (cantidad > disponible) {
            await conn.rollback();
            return res.status(409).json({ error: `Stock insuficiente (disponible: ${disponible})` });
        }

        await conn.query(
            'UPDATE productos SET stock_reservado = stock_reservado + ? WHERE id = ?',
            [cantidad, producto_id]);
        const [ins] = await conn.query(
            `INSERT INTO reservas (usuario_id, producto_id, cantidad, fecha_recogida, notas)
             VALUES (?, ?, ?, ?, ?)`,
            [usuario_id, producto_id, cantidad, fecha_recogida || null, notas || null]);
        await conn.query(
            `INSERT INTO movimientos (producto_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, motivo)
             VALUES (?, ?, 'reserva', ?, ?, ?, ?)`,
            [producto_id, usuario_id, cantidad, prod.stock, prod.stock, `Reserva #${ins.insertId}`]);
        await conn.commit();
        res.status(201).json({ id: ins.insertId });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
});

// PATCH /api/reservas/:id/estado  (operario/admin)
router.patch('/:id/estado', authRequired, requireRole('admin','operario'), async (req, res) => {
    const { estado } = req.body || {};
    if (!['pendiente','confirmada','entregada'].includes(estado)) {
        return res.status(400).json({ error: 'Estado inválido' });
    }
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[r]] = await conn.query(
            'SELECT producto_id, cantidad, estado FROM reservas WHERE id = ? FOR UPDATE',
            [req.params.id]);
        if (!r) { await conn.rollback(); return res.status(404).json({ error: 'No encontrada' }); }
        if (r.estado === 'cancelada') { await conn.rollback(); return res.status(400).json({ error: 'Reserva cancelada' }); }

        if (estado === 'entregada' && r.estado !== 'entregada') {
            const [[prod]] = await conn.query('SELECT stock, stock_reservado FROM productos WHERE id = ? FOR UPDATE', [r.producto_id]);
            await conn.query(
                'UPDATE productos SET stock = stock - ?, stock_reservado = GREATEST(0, stock_reservado - ?) WHERE id = ?',
                [r.cantidad, r.cantidad, r.producto_id]);
            await conn.query(
                "UPDATE reservas SET estado = 'entregada', fecha_entrega = NOW() WHERE id = ?",
                [req.params.id]);
            await conn.query(
                `INSERT INTO movimientos (producto_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, motivo)
                 VALUES (?, ?, 'salida', ?, ?, ?, ?)`,
                [r.producto_id, req.user.id, r.cantidad, prod.stock, prod.stock - r.cantidad, `Entrega reserva #${req.params.id}`]);
        } else {
            await conn.query('UPDATE reservas SET estado = ? WHERE id = ?', [estado, req.params.id]);
        }
        await conn.commit();
        res.json({ ok: true });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
});

// DELETE /api/reservas/:id  (cancelar)
router.delete('/:id', authRequired, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[r]] = await conn.query(
            'SELECT usuario_id, producto_id, cantidad, estado FROM reservas WHERE id = ? FOR UPDATE',
            [req.params.id]);
        if (!r) { await conn.rollback(); return res.status(404).json({ error: 'No encontrada' }); }
        if (req.user.rol === 'cliente' && r.usuario_id !== req.user.id) {
            await conn.rollback();
            return res.status(403).json({ error: 'No autorizado' });
        }
        if (r.estado === 'cancelada') { await conn.rollback(); return res.status(400).json({ error: 'Ya cancelada' }); }
        if (r.estado === 'entregada') { await conn.rollback(); return res.status(400).json({ error: 'Ya entregada' }); }

        await conn.query("UPDATE reservas SET estado = 'cancelada' WHERE id = ?", [req.params.id]);
        await conn.query(
            'UPDATE productos SET stock_reservado = GREATEST(0, stock_reservado - ?) WHERE id = ?',
            [r.cantidad, r.producto_id]);
        await conn.query(
            `INSERT INTO movimientos (producto_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, motivo)
             VALUES (?, ?, 'liberacion', ?, 0, 0, ?)`,
            [r.producto_id, req.user.id, r.cantidad, `Cancelación reserva #${req.params.id}`]);
        await conn.commit();
        res.json({ ok: true });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
});

module.exports = router;
