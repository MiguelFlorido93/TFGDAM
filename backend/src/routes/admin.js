const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

router.use(authRequired, requireRole('admin','operario'));

// GET /api/admin/stats - dashboard
router.get('/stats', async (_req, res) => {
    const [[totales]] = await pool.query(`
        SELECT
            (SELECT COUNT(*) FROM productos WHERE activo = 1) AS productos,
            (SELECT COUNT(*) FROM productos WHERE activo = 1 AND (stock - stock_reservado) <= stock_minimo) AS stock_bajo,
            (SELECT COUNT(*) FROM usuarios WHERE activo = 1) AS usuarios,
            (SELECT COUNT(*) FROM reservas WHERE estado = 'pendiente')   AS pendientes,
            (SELECT COUNT(*) FROM reservas WHERE estado = 'confirmada')  AS confirmadas,
            (SELECT COUNT(*) FROM reservas WHERE estado = 'entregada')   AS entregadas,
            (SELECT IFNULL(SUM(stock * precio), 0) FROM productos WHERE activo = 1) AS valor_inventario
    `);
    const [porCategoria] = await pool.query(`
        SELECT c.nombre, c.color, COUNT(p.id) AS productos, IFNULL(SUM(p.stock),0) AS stock_total
          FROM categorias c LEFT JOIN productos p ON p.categoria_id = c.id AND p.activo = 1
         GROUP BY c.id ORDER BY productos DESC`);
    const [reservasPorDia] = await pool.query(`
        SELECT DATE(fecha_reserva) AS dia, COUNT(*) AS total
          FROM reservas
         WHERE fecha_reserva >= DATE_SUB(NOW(), INTERVAL 14 DAY)
         GROUP BY DATE(fecha_reserva) ORDER BY dia`);
    const [topProductos] = await pool.query(`
        SELECT p.id, p.sku, p.nombre, COUNT(r.id) AS reservas
          FROM reservas r JOIN productos p ON p.id = r.producto_id
         GROUP BY p.id ORDER BY reservas DESC LIMIT 5`);
    res.json({ totales, porCategoria, reservasPorDia, topProductos });
});

// ----- Usuarios (admin solo) -----
router.get('/usuarios', requireRole('admin'), async (_req, res) => {
    const [rows] = await pool.query(
        'SELECT id, nombre, email, rol, activo, creado_en FROM usuarios ORDER BY creado_en DESC');
    res.json(rows);
});

router.post('/usuarios', requireRole('admin'), async (req, res) => {
    const { nombre, email, password, rol = 'cliente' } = req.body || {};
    if (!nombre || !email || !password) return res.status(400).json({ error: 'Faltan campos' });
    try {
        const hash = await bcrypt.hash(password, 10);
        const [r] = await pool.query(
            'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)',
            [nombre, email, hash, rol]);
        res.status(201).json({ id: r.insertId });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email duplicado' });
        res.status(500).json({ error: e.message });
    }
});

router.put('/usuarios/:id', requireRole('admin'), async (req, res) => {
    const { nombre, email, rol, activo, password } = req.body || {};
    let hash;
    if (password) hash = await bcrypt.hash(password, 10);
    await pool.query(
        `UPDATE usuarios SET
            nombre = COALESCE(?, nombre),
            email  = COALESCE(?, email),
            rol    = COALESCE(?, rol),
            activo = COALESCE(?, activo),
            password_hash = COALESCE(?, password_hash)
         WHERE id = ?`,
        [nombre, email, rol, activo, hash, req.params.id]);
    res.json({ ok: true });
});

// ----- Movimientos -----
router.get('/movimientos', async (req, res) => {
    const limit = Math.min(200, parseInt(req.query.limit || '50', 10));
    const [rows] = await pool.query(`
        SELECT m.id, m.tipo, m.cantidad, m.stock_anterior, m.stock_posterior, m.motivo, m.fecha,
               p.sku, p.nombre AS producto, u.nombre AS usuario
          FROM movimientos m
          JOIN productos p ON p.id = m.producto_id
          LEFT JOIN usuarios u ON u.id = m.usuario_id
         ORDER BY m.fecha DESC LIMIT ?`, [limit]);
    res.json(rows);
});

// Export CSV de reservas
router.get('/export/reservas.csv', async (_req, res) => {
    const [rows] = await pool.query(`
        SELECT r.id, u.nombre AS usuario, p.sku, p.nombre AS producto,
               r.cantidad, r.estado, r.fecha_reserva, r.fecha_recogida
          FROM reservas r
          JOIN usuarios u ON u.id = r.usuario_id
          JOIN productos p ON p.id = r.producto_id
         ORDER BY r.fecha_reserva DESC`);
    const headers = Object.keys(rows[0] || { id:'', usuario:'', sku:'', producto:'', cantidad:'', estado:'', fecha_reserva:'', fecha_recogida:'' });
    const csv = [
        headers.join(','),
        ...rows.map(r => headers.map(h => {
            const v = r[h] ?? '';
            const s = String(v).replace(/"/g, '""');
            return /[",\n]/.test(s) ? `"${s}"` : s;
        }).join(','))
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="reservas.csv"');
    res.send(csv);
});

module.exports = router;
