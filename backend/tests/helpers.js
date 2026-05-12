/**
 * Helpers compartidos para los tests de humo.
 * Asume backend conectable a MySQL con la BD `stockly` cargada (seed por defecto).
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const request = require('supertest');
const { app } = require('../server');

const CREDS = {
    admin:    { email: 'adrian@tfg.local', password: 'password123' },
    operario: { email: 'laura@tfg.local',  password: 'password123' },
    cliente:  { email: 'marcos@tfg.local', password: 'password123' },
};

// Cache de tokens por rol (evita N logins por suite)
const _tokens = {};

/** Login con uno de los usuarios semilla. Devuelve { token, user }. */
async function login(rol = 'admin') {
    if (_tokens[rol]) return _tokens[rol];
    const r = await request(app).post('/api/auth/login').send(CREDS[rol]);
    if (r.status !== 200) throw new Error(`Login ${rol} falló: ${r.status} — ${JSON.stringify(r.body)}`);
    _tokens[rol] = r.body;
    return r.body;
}

/** Devuelve un agent con el header Authorization preseteado. */
async function auth(rol = 'admin') {
    const { token } = await login(rol);
    const hdr = { Authorization: `Bearer ${token}` };
    return {
        token,
        get:    p         => request(app).get(p).set(hdr),
        post:   (p, body) => request(app).post(p).set(hdr).send(body),
        put:    (p, body) => request(app).put(p).set(hdr).send(body),
        patch:  (p, body) => request(app).patch(p).set(hdr).send(body),
        delete: p         => request(app).delete(p).set(hdr),
    };
}

/** Cadena única para evitar colisiones de SKU/email entre tests. */
function unique() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

module.exports = { app, login, auth, unique, CREDS };
