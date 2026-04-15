// =============================================================
// TFG - API REST de gestión de reservas de almacén
// =============================================================
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const mysql   = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());

// Servir el frontend estático desde /public (../frontend)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ------------------- Pool de conexiones MariaDB ----------------
const pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     process.env.DB_PORT     || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'almacen_tfg',
    waitForConnections: true,
    connectionLimit: 10
});

// ------------------- Healthcheck ------------------------------
app.get('/api/health', async (_req, res) => {
    try {
        const [r] = await pool.query('SELECT 1 AS ok');
        res.json({ ok: true, db: r[0].ok === 1 });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ------------------- Categorías -------------------------------
app.get('/api/categorias', async (_req, res) => {
    const [rows] = await pool.query('SELECT id, nombre FROM categorias ORDER BY nombre');
    res.json(rows);
});

// ------------------- Productos --------------------------------
// GET /api/productos?search=taladro&categoria=2&page=1&limit=20
app.get('/api/productos', async (req, res) => {
    const search     = (req.query.search    || '').trim();
    const categoria  = req.query.categoria  ? parseInt(req.query.categoria, 10) : null;
    const page       = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit      = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const offset     = (page - 1) * limit;

    const where = [];
    const params = [];
    if (search) {
        where.push('(p.nombre LIKE ? OR p.sku LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
    }
    if (categoria) {
        where.push('p.categoria_id = ?');
        params.push(categoria);
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [rows] = await pool.query(
        `SELECT p.id, p.sku, p.nombre, p.descripcion, p.ubicacion,
                p.stock, p.stock_reservado, p.precio,
                c.nombre AS categoria
           FROM productos p
           LEFT JOIN categorias c ON c.id = p.categoria_id
           ${whereSql}
           ORDER BY p.id
           LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM productos p ${whereSql}`,
        params
    );
    res.json({ data: rows, page, limit, total });
});

app.get('/api/productos/:id', async (req, res) => {
    const [rows] = await pool.query(
        `SELECT p.*, c.nombre AS categoria
           FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id
          WHERE p.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
});

// ------------------- Reservas --------------------------------
app.get('/api/reservas', async (req, res) => {
    const usuario = req.query.usuario_id;
    const params = [];
    let where = '';
    if (usuario) { where = 'WHERE r.usuario_id = ?'; params.push(usuario); }

    const [rows] = await pool.query(
        `SELECT r.id, r.cantidad, r.estado, r.fecha_reserva, r.fecha_recogida, r.notas,
                u.nombre AS usuario,
                p.id AS producto_id, p.sku, p.nombre AS producto, p.ubicacion
           FROM reservas r
           JOIN usuarios  u ON u.id = r.usuario_id
           JOIN productos p ON p.id = r.producto_id
           ${where}
           ORDER BY r.fecha_reserva DESC`, params);
    res.json(rows);
});

app.post('/api/reservas', async (req, res) => {
    const { usuario_id, producto_id, cantidad, fecha_recogida, notas } = req.body;
    if (!usuario_id || !producto_id || !cantidad) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[prod]] = await conn.query(
            'SELECT stock, stock_reservado FROM productos WHERE id = ? FOR UPDATE',
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
        await conn.commit();
        res.status(201).json({ id: ins.insertId });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally {
        conn.release();
    }
});

app.delete('/api/reservas/:id', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[r]] = await conn.query(
            'SELECT producto_id, cantidad, estado FROM reservas WHERE id = ? FOR UPDATE',
            [req.params.id]);
        if (!r) { await conn.rollback(); return res.status(404).json({ error: 'Reserva inexistente' }); }
        if (r.estado === 'cancelada') { await conn.rollback(); return res.status(400).json({ error: 'Ya estaba cancelada' }); }

        await conn.query("UPDATE reservas SET estado = 'cancelada' WHERE id = ?", [req.params.id]);
        await conn.query(
            'UPDATE productos SET stock_reservado = GREATEST(0, stock_reservado - ?) WHERE id = ?',
            [r.cantidad, r.producto_id]);
        await conn.commit();
        res.json({ ok: true });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally {
        conn.release();
    }
});

// ------------------- Usuarios (para seleccionar en UI) --------
app.get('/api/usuarios', async (_req, res) => {
    const [rows] = await pool.query('SELECT id, nombre, rol FROM usuarios ORDER BY nombre');
    res.json(rows);
});

// ------------------- Arranque ---------------------------------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`API TFG Almacén escuchando en http://localhost:${PORT}`);
    console.log(`Frontend servido en http://localhost:${PORT}/`);
});
