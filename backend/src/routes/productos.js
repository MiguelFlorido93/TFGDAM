const router = require('express').Router();
const pool = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

// ----- helpers de validación -----
const SKU_RE = /^[A-Z0-9][A-Z0-9_-]{1,19}$/i;
const UBIC_RE = /^[A-Z0-9_\-./]{1,20}$/i;

function validarProducto(body, { partial = false } = {}) {
    const errors = [];
    const { sku, nombre, ubicacion, stock, stock_minimo, precio, categoria_id } = body || {};

    if (!partial || sku !== undefined) {
        if (!sku) errors.push('SKU obligatorio');
        else if (!SKU_RE.test(sku)) errors.push('SKU no válido (1-20 alfanuméricos, _ o -)');
    }
    if (!partial || nombre !== undefined) {
        if (!nombre || nombre.trim().length < 3) errors.push('Nombre mínimo 3 caracteres');
        else if (nombre.length > 150) errors.push('Nombre máximo 150 caracteres');
    }
    if (!partial || ubicacion !== undefined) {
        if (!ubicacion) errors.push('Ubicación obligatoria');
        else if (!UBIC_RE.test(ubicacion)) errors.push('Ubicación no válida');
    }
    if (stock !== undefined && (!Number.isInteger(+stock) || +stock < 0)) errors.push('Stock debe ser entero ≥ 0');
    if (stock_minimo !== undefined && (!Number.isInteger(+stock_minimo) || +stock_minimo < 0))
        errors.push('Stock mínimo debe ser entero ≥ 0');
    if (precio !== undefined && (isNaN(+precio) || +precio < 0)) errors.push('Precio debe ser ≥ 0');
    if (categoria_id !== undefined && categoria_id !== null && !Number.isInteger(+categoria_id))
        errors.push('Categoría no válida');
    return errors;
}

// GET /api/productos
router.get('/', async (req, res) => {
    const search = (req.query.search || '').trim();
    const categoria = req.query.categoria ? parseInt(req.query.categoria, 10) : null;
    const stockBajo = req.query.stock_bajo === '1';
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const offset = (page - 1) * limit;
    const orderBy = ['nombre', 'sku', 'stock', 'precio'].includes(req.query.sort) ? req.query.sort : 'id';
    const orderDir = req.query.dir === 'desc' ? 'DESC' : 'ASC';

    const where = ['p.activo = 1'];
    const params = [];
    if (search) {
        where.push('(p.nombre LIKE ? OR p.sku LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
    }
    if (categoria) {
        where.push('p.categoria_id = ?');
        params.push(categoria);
    }
    if (stockBajo) {
        where.push('(p.stock - p.stock_reservado) <= p.stock_minimo');
    }

    const whereSql = 'WHERE ' + where.join(' AND ');

    const [rows] = await pool.query(
        `SELECT p.id, p.sku, p.nombre, p.descripcion, p.ubicacion,
                p.stock, p.stock_reservado, p.stock_minimo, p.precio, p.imagen_url,
                p.categoria_id, c.nombre AS categoria, c.icono AS categoria_icono, c.color AS categoria_color
           FROM productos p
           LEFT JOIN categorias c ON c.id = p.categoria_id
           ${whereSql}
           ORDER BY p.${orderBy} ${orderDir}
           LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM productos p ${whereSql}`, params);
    res.json({ data: rows, page, limit, total, pages: Math.ceil(total / limit) });
});

// POST /api/productos/import  → importación masiva (admin/operario)
// body: { productos: [ {sku?, nombre, descripcion?, categoria_id?, ubicacion, stock?, stock_minimo?, precio?}, ... ] }
// Devuelve por fila: { linea, ok, id?, error? }
router.post('/import', authRequired, requireRole('admin', 'operario'), async (req, res) => {
    const productos = Array.isArray(req.body?.productos) ? req.body.productos : null;
    if (!productos || !productos.length) return res.status(400).json({ error: 'Array "productos" vacío o ausente' });
    if (productos.length > 2000) return res.status(400).json({ error: 'Máximo 2000 filas por import' });

    // Pre-cargamos los SKUs ya generados con SKU-NNNNN para sugerir nuevos sin colisión
    const [[srow]] = await pool.query(
        `SELECT MAX(CAST(SUBSTRING(sku, 5) AS UNSIGNED)) AS max FROM productos WHERE sku LIKE 'SKU-%'`
    );
    let next = srow?.max || 0;
    const sugerir = () => 'SKU-' + String(++next).padStart(5, '0');

    const resultados = [];
    for (let i = 0; i < productos.length; i++) {
        const p = productos[i] || {};
        const ln = p.__linea ?? i + 2; // línea original del CSV (1 = cabecera)
        const sku = p.sku && String(p.sku).trim() ? String(p.sku).trim().toUpperCase() : sugerir();
        const fila = { ...p, sku };

        const errs = validarProducto(fila);
        if (errs.length) {
            resultados.push({ linea: ln, ok: false, error: errs.join('; ') });
            continue;
        }
        const { nombre, descripcion, categoria_id, ubicacion, stock = 0, stock_minimo = 5, precio = 0 } = fila;
        try {
            const [r] = await pool.query(
                `INSERT INTO productos (sku, nombre, descripcion, categoria_id, ubicacion, stock, stock_minimo, precio)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    sku,
                    String(nombre).trim(),
                    descripcion || null,
                    categoria_id || null,
                    String(ubicacion).trim().toUpperCase(),
                    +stock,
                    +stock_minimo,
                    +precio,
                ]
            );
            if (+stock > 0) {
                await pool.query(
                    `INSERT INTO movimientos (producto_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, motivo)
                     VALUES (?, ?, 'entrada', ?, 0, ?, 'Importación CSV')`,
                    [r.insertId, req.user.id, +stock, +stock]
                );
            }
            resultados.push({ linea: ln, ok: true, id: r.insertId, sku });
        } catch (e) {
            const msg = e.code === 'ER_DUP_ENTRY' ? `SKU '${sku}' duplicado` : e.message;
            resultados.push({ linea: ln, ok: false, error: msg });
        }
    }

    const creados = resultados.filter(r => r.ok).length;
    const fallidos = resultados.length - creados;
    res.json({ creados, fallidos, resultados });
});

// GET /api/productos/sku-sugerido  → siguiente SKU disponible (SKU-NNNNN)
router.get('/sku-sugerido', authRequired, requireRole('admin', 'operario'), async (_req, res) => {
    const [[row]] = await pool.query(
        `SELECT MAX(CAST(SUBSTRING(sku, 5) AS UNSIGNED)) AS max FROM productos WHERE sku LIKE 'SKU-%'`
    );
    const next = (row?.max || 0) + 1;
    res.json({ sku: 'SKU-' + String(next).padStart(5, '0') });
});

// GET /api/productos/:id/movimientos — histórico del producto (admin/operario)
router.get('/:id/movimientos', authRequired, requireRole('admin', 'operario'), async (req, res) => {
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '100', 10)));
    const [[prod]] = await pool.query(
        'SELECT id, sku, nombre, stock, stock_reservado, stock_minimo, ubicacion FROM productos WHERE id = ?',
        [req.params.id]
    );
    if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });

    const [movs] = await pool.query(
        `
        SELECT m.id, m.tipo, m.cantidad, m.stock_anterior, m.stock_posterior, m.motivo, m.fecha,
               u.nombre AS usuario
          FROM movimientos m
          LEFT JOIN usuarios u ON u.id = m.usuario_id
         WHERE m.producto_id = ?
         ORDER BY m.fecha DESC, m.id DESC
         LIMIT ?`,
        [req.params.id, limit]
    );

    // Totales agregados por tipo (útil en el header del modal)
    const totales = movs.reduce(
        (acc, m) => {
            acc[m.tipo] = (acc[m.tipo] || 0) + m.cantidad;
            acc._total++;
            return acc;
        },
        { _total: 0 }
    );

    res.json({ producto: prod, movimientos: movs, totales });
});

// GET /api/productos/:id
router.get('/:id', async (req, res) => {
    const [rows] = await pool.query(
        `SELECT p.*, c.nombre AS categoria, c.icono AS categoria_icono, c.color AS categoria_color
           FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id
          WHERE p.id = ?`,
        [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
});

// POST /api/productos  (admin/operario)
router.post('/', authRequired, requireRole('admin', 'operario'), async (req, res) => {
    const errs = validarProducto(req.body);
    if (errs.length) return res.status(400).json({ error: errs.join('; '), detalles: errs });
    const {
        sku,
        nombre,
        descripcion,
        categoria_id,
        ubicacion,
        stock = 0,
        stock_minimo = 5,
        precio = 0,
        imagen_url,
    } = req.body;
    try {
        const [r] = await pool.query(
            `INSERT INTO productos (sku, nombre, descripcion, categoria_id, ubicacion, stock, stock_minimo, precio, imagen_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                sku,
                nombre,
                descripcion || null,
                categoria_id || null,
                ubicacion,
                stock,
                stock_minimo,
                precio,
                imagen_url || null,
            ]
        );
        if (stock > 0) {
            await pool.query(
                `INSERT INTO movimientos (producto_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, motivo)
                 VALUES (?, ?, 'entrada', ?, 0, ?, 'Alta de producto')`,
                [r.insertId, req.user.id, stock, stock]
            );
        }
        res.status(201).json({ id: r.insertId });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'SKU ya existe' });
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/productos/:id
router.put('/:id', authRequired, requireRole('admin', 'operario'), async (req, res) => {
    const errs = validarProducto(req.body, { partial: true });
    if (errs.length) return res.status(400).json({ error: errs.join('; '), detalles: errs });
    const { sku, nombre, descripcion, categoria_id, ubicacion, stock, stock_minimo, precio, imagen_url, activo } =
        req.body;
    const [[prev]] = await pool.query('SELECT stock FROM productos WHERE id = ?', [req.params.id]);
    if (!prev) return res.status(404).json({ error: 'No encontrado' });
    try {
        await pool.query(
            `UPDATE productos SET
                sku = COALESCE(?, sku),
                nombre = COALESCE(?, nombre),
                descripcion = COALESCE(?, descripcion),
                categoria_id = COALESCE(?, categoria_id),
                ubicacion = COALESCE(?, ubicacion),
                stock = COALESCE(?, stock),
                stock_minimo = COALESCE(?, stock_minimo),
                precio = COALESCE(?, precio),
                imagen_url = COALESCE(?, imagen_url),
                activo = COALESCE(?, activo)
             WHERE id = ?`,
            [
                sku,
                nombre,
                descripcion,
                categoria_id,
                ubicacion,
                stock,
                stock_minimo,
                precio,
                imagen_url,
                activo,
                req.params.id,
            ]
        );
        if (stock !== undefined && stock !== prev.stock) {
            await pool.query(
                `INSERT INTO movimientos (producto_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, motivo)
                 VALUES (?, ?, 'ajuste', ?, ?, ?, 'Ajuste manual de stock')`,
                [req.params.id, req.user.id, stock - prev.stock, prev.stock, stock]
            );
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/productos/:id  (soft delete)
router.delete('/:id', authRequired, requireRole('admin'), async (req, res) => {
    const [r] = await pool.query('UPDATE productos SET activo = 0 WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true });
});

module.exports = router;
