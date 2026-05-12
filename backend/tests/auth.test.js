const request = require('supertest');
const { app, auth, unique, CREDS } = require('./helpers');

describe('Autenticación', () => {
    it('GET /api/health → 200 con db:true', async () => {
        const r = await request(app).get('/api/health');
        expect(r.status).toBe(200);
        expect(r.body.ok).toBe(true);
        expect(r.body.db).toBe(true);
    });

    it('POST /api/auth/login con credenciales correctas devuelve token', async () => {
        const r = await request(app).post('/api/auth/login').send(CREDS.admin);
        expect(r.status).toBe(200);
        expect(r.body.token).toMatch(/^eyJ/);          // JWT base64
        expect(r.body.user.rol).toBe('admin');
        expect(r.body.user.email).toBe(CREDS.admin.email);
    });

    it('POST /api/auth/login con contraseña incorrecta → 401', async () => {
        const r = await request(app).post('/api/auth/login').send({
            email: CREDS.admin.email,
            password: 'no-es-esta',
        });
        expect(r.status).toBe(401);
        expect(r.body.error).toBeTruthy();
    });

    it('POST /api/auth/login sin campos → 400', async () => {
        const r = await request(app).post('/api/auth/login').send({});
        expect(r.status).toBe(400);
    });

    it('GET /api/auth/me sin token → 401', async () => {
        const r = await request(app).get('/api/auth/me');
        expect(r.status).toBe(401);
    });

    it('GET /api/auth/me con token válido devuelve el usuario', async () => {
        const a = await auth('admin');
        const r = await a.get('/api/auth/me');
        expect(r.status).toBe(200);
        expect(r.body.user.email).toBe(CREDS.admin.email);
    });

    it('POST /api/auth/register crea nuevo cliente y emite token', async () => {
        const email = `test-${unique()}@stockly.test`;
        const r = await request(app).post('/api/auth/register').send({
            nombre: 'Tester ' + email,
            email,
            password: 'secret-test-1234',
        });
        expect(r.status).toBe(201);
        expect(r.body.user.email).toBe(email);
        expect(r.body.user.rol).toBe('cliente');
        expect(r.body.token).toMatch(/^eyJ/);
    });

    it('POST /api/auth/register con email duplicado → 409', async () => {
        const r = await request(app).post('/api/auth/register').send({
            nombre: 'Adrián Bis',
            email: CREDS.admin.email,
            password: 'secret-1234',
        });
        expect(r.status).toBe(409);
    });

    it('PATCH /api/auth/me actualiza el nombre y reemite token', async () => {
        // Creamos usuario fresco para no romper a Adrián
        const email = `patch-${unique()}@stockly.test`;
        const reg = await request(app).post('/api/auth/register').send({
            nombre: 'Original', email, password: 'secret-patch',
        });
        const tok = reg.body.token;

        const r = await request(app).patch('/api/auth/me')
            .set('Authorization', `Bearer ${tok}`)
            .send({ nombre: 'Modificado' });

        expect(r.status).toBe(200);
        expect(r.body.user.nombre).toBe('Modificado');
        expect(r.body.token).toMatch(/^eyJ/);
        expect(r.body.token).not.toBe(tok);   // reemitido
    });

    it('PATCH /api/auth/me con contraseña actual incorrecta → 401', async () => {
        const a = await auth('admin');
        const r = await a.patch('/api/auth/me', {
            password_actual: 'esto-no-es-la-correcta',
            password_nuevo:  'nueva-contraseña-123',
        });
        expect(r.status).toBe(401);
    });
});
