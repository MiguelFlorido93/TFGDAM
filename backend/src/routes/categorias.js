const router = require('express').Router();
const pool = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

router.get('/', async (_req, res) => {
    const [rows] = await pool.query(
        `SELECT c.id, c.nombre, c.icono, c.color,
                (SELECT COUNT(*) FROM productos p WHERE p.categoria_id = c.id AND p.activo = 1) AS productos
           FROM categorias c ORDER BY c.nombre`);
    res.json(rows);
});

router.post('/', authRequired, requireRole('admin'), async (req, res) => {
    const { nombre, icono, color } = req.body || {};
    if (!nombre) return res.status(400).json({ error: 'Nombre obligatorio' });
    try {
        const [r] = await pool.query(
            'INSERT INTO categorias (nombre, icono, color) VALUES (?, ?, ?)',
            [nombre, icono || null, color || null]);
        res.status(201).json({ id: r.insertId });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Categoría ya existe' });
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
