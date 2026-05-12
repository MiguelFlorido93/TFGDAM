// =============================================================
// Stockly - API REST + servidor de frontend
// TFG DAM · Autores: Adrián Bravo Santos y Miguel Ángel Florido
// =============================================================
require('dotenv').config();

// --- Asegura un JWT_SECRET fuerte antes de cargar nada que dependa de él ---
// Si .env tiene el placeholder de la plantilla o no tiene secreto, generamos
// uno aleatorio (64 bytes hex = 128 chars) y lo persistimos en .env para que
// sobreviva a reinicios (si no, todos los tokens se invalidarían cada vez).
require('./src/ensure-jwt-secret')();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');

const pool = require('./src/db');

const app = express();

// ---------- Middlewares globales ----------
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '4mb' })); // 4mb cubre imports CSV de hasta ~2000 productos
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// Rate limit en /api/auth para evitar fuerza bruta (deshabilitado en tests)
if (process.env.NODE_ENV !== 'test') {
    app.use(
        '/api/auth',
        rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 30,
            standardHeaders: true,
            legacyHeaders: false,
        })
    );
}

// ---------- Frontend estático ----------
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ---------- Rutas ----------
app.get('/api/health', async (_req, res) => {
    try {
        const [r] = await pool.query('SELECT 1 AS ok');
        res.json({ ok: true, db: r[0].ok === 1, ts: new Date().toISOString() });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/categorias', require('./src/routes/categorias'));
app.use('/api/productos', require('./src/routes/productos'));
app.use('/api/reservas', require('./src/routes/reservas'));
app.use('/api/admin', require('./src/routes/admin'));

// Error handler genérico
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
});

// ---------- Bootstrap: asegura hashes válidos en usuarios semilla ----------
async function ensureSeedHashes() {
    try {
        const [users] = await pool.query('SELECT id, password_hash FROM usuarios');
        const placeholder = '$2b$10$wH8QpZ1xGQK3Yk0QpZ1xGuXk6YkQpZ1xGQK3Yk0QpZ1xGQK3Yk0Qp';
        const validRegex = /^\$2[aby]\$\d{2}\$/;
        const needsFix = users.filter(u => u.password_hash === placeholder || !validRegex.test(u.password_hash || ''));
        if (!needsFix.length) return;
        const hash = await bcrypt.hash('password123', 10);
        await pool.query('UPDATE usuarios SET password_hash = ? WHERE id IN (?)', [hash, needsFix.map(u => u.id)]);
        console.log(`🔐 ${needsFix.length} usuarios semilla con password "password123"`);
    } catch (e) {
        console.warn('No se pudo verificar hashes semilla:', e.message);
    }
}

// Sólo abrir puerto si se ejecuta directamente (node server.js).
// Cuando los tests importan el módulo, el `app` se exporta sin escuchar.
if (require.main === module) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, async () => {
        console.log(`🚀 Stockly API → http://localhost:${PORT}`);
        console.log(`🌐 Frontend       → http://localhost:${PORT}/`);
        await ensureSeedHashes();
    });
}

module.exports = { app, ensureSeedHashes };
