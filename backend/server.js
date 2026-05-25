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

// Detrás del proxy de Railway/Render/Fly. Necesario para que express-rate-limit
// y la detección de IP real funcionen, y para que `req.ip` no sea siempre la del proxy.
app.set('trust proxy', 1);

// ---------- Middlewares globales ----------
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
// CORS: en producción aceptamos un origen explícito vía CORS_ORIGIN
// (o lista separada por comas). En dev abierto a todo.
const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
    : '*';
app.use(cors({ origin: corsOrigin }));
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

// ---------- Swagger UI (documentación interactiva) ----------
// Mount BEFORE el 404 handler, después de las rutas reales.
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./src/openapi');
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
    customSiteTitle: 'Stockly API · Docs',
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
}));
// Permite descargar el JSON de la spec por si se quiere usar con Postman/etc.
app.get('/api/openapi.json', (_req, res) => res.json(openapiSpec));

// Pequeño índice JSON en /api para que no devuelva 404 cuando se abre directamente.
app.get('/api', (_req, res) => res.json({
    name: 'Stockly API',
    version: openapiSpec.info.version,
    docs: '/api/docs',
    openapi: '/api/openapi.json',
    health: '/api/health',
}));

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
    const ensureSchema = require('./src/ensure-schema');
    // En 0.0.0.0 para que Railway/contenedores puedan exponerlo (en local sigue
    // siendo accesible por 127.0.0.1 igual).
    app.listen(PORT, '0.0.0.0', async () => {
        console.log(`🚀 Stockly API escuchando en :${PORT}`);
        try {
            await ensureSchema();
            await ensureSeedHashes();
        } catch (e) {
            console.error('Fallo en bootstrap:', e.message);
        }
    });
}

module.exports = { app, ensureSeedHashes };
