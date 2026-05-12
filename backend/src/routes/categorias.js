const router = require('express').Router();
const pool = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

// GET /api/categorias — lista con contador de productos activos
router.get('/', async (_req, res) => {
    const [rows] = await pool.query(
        `SELECT c.id, c.nombre, c.icono, c.color,
                (SELECT COUNT(*) FROM productos p WHERE p.categoria_id = c.id AND p.activo = 1) AS productos
           FROM categorias c ORDER BY c.nombre`
    );
    res.json(rows);
});

// POST /api/categorias — crear (admin)
router.post('/', authRequired, requireRole('admin'), async (req, res) => {
    const { nombre, icono, color } = req.body || {};
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'Nombre obligatorio' });
    try {
        const [r] = await pool.query('INSERT INTO categorias (nombre, icono, color) VALUES (?, ?, ?)', [
            nombre.trim(),
            icono || null,
            color || null,
        ]);
        res.status(201).json({ id: r.insertId });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Esa categoría ya existe' });
        res.status(500).json({ error: e.message });
    }
});

// PATCH /api/categorias/:id — renombrar/cambiar icono/color (admin)
router.patch('/:id', authRequired, requireRole('admin'), async (req, res) => {
    const { nombre, icono, color } = req.body || {};
    const cambios = [];
    const valores = [];

    if (nombre !== undefined) {
        if (!String(nombre).trim()) return res.status(400).json({ error: 'Nombre no puede estar vacío' });
        cambios.push('nombre = ?');
        valores.push(String(nombre).trim());
    }
    if (icono !== undefined) {
        cambios.push('icono = ?');
        valores.push(icono || null);
    }
    if (color !== undefined) {
        cambios.push('color = ?');
        valores.push(color || null);
    }
    if (!cambios.length) return res.status(400).json({ error: 'No hay cambios' });

    try {
        valores.push(req.params.id);
        const [r] = await pool.query(`UPDATE categorias SET ${cambios.join(', ')} WHERE id = ?`, valores);
        if (!r.affectedRows) return res.status(404).json({ error: 'Categoría no encontrada' });
        res.json({ ok: true });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ese nombre ya existe' });
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/categorias/:id?force=true
//   - sin force: error 409 si hay productos asociados
//   - con force: pone categoria_id = NULL en productos y borra
router.delete('/:id', authRequired, requireRole('admin'), async (req, res) => {
    const id = req.params.id;
    const force = req.query.force === 'true';
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM productos WHERE categoria_id = ?', [id]);
        if (n > 0 && !force) {
            await conn.rollback();
            return res.status(409).json({
                error: `La categoría tiene ${n} producto(s). Usa fusionar o ?force=true para desasignarlos.`,
                productos: n,
            });
        }
        if (n > 0) {
            await conn.query('UPDATE productos SET categoria_id = NULL WHERE categoria_id = ?', [id]);
        }
        const [r] = await conn.query('DELETE FROM categorias WHERE id = ?', [id]);
        await conn.commit();
        if (!r.affectedRows) return res.status(404).json({ error: 'Categoría no encontrada' });
        res.json({ ok: true, productos_desasignados: n });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally {
        conn.release();
    }
});

// POST /api/categorias/:id/merge { destino_id }
//   - Mueve todos los productos de :id a destino_id, borra :id
router.post('/:id/merge', authRequired, requireRole('admin'), async (req, res) => {
    const origen = parseInt(req.params.id, 10);
    const destino = parseInt(req.body?.destino_id, 10);
    if (!destino || destino === origen) return res.status(400).json({ error: 'destino_id no válido' });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[catDest]] = await conn.query('SELECT id FROM categorias WHERE id = ?', [destino]);
        if (!catDest) {
            await conn.rollback();
            return res.status(404).json({ error: 'Categoría destino no existe' });
        }

        const [r1] = await conn.query('UPDATE productos SET categoria_id = ? WHERE categoria_id = ?', [
            destino,
            origen,
        ]);
        const [r2] = await conn.query('DELETE FROM categorias WHERE id = ?', [origen]);
        if (!r2.affectedRows) {
            await conn.rollback();
            return res.status(404).json({ error: 'Categoría origen no existe' });
        }

        await conn.commit();
        res.json({ ok: true, productos_movidos: r1.affectedRows });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally {
        conn.release();
    }
});

module.exports = router;
