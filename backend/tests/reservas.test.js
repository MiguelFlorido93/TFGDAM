const { auth, unique } = require('./helpers');

describe('Reservas', () => {
    let admin, cliente, productoId;

    beforeAll(async () => {
        admin   = await auth('admin');
        cliente = await auth('cliente');

        // Creamos un producto fresco con stock controlado para no afectar a otros tests
        const sku = 'RES-' + unique().toUpperCase();
        const r = await admin.post('/api/productos', {
            sku, nombre: 'Producto reservas test', ubicacion: 'R-1', stock: 100, precio: 5,
        });
        productoId = r.body.id;
    });

    it('Cliente crea reserva y bloquea stock', async () => {
        const r = await cliente.post('/api/reservas', { producto_id: productoId, cantidad: 3 });
        expect(r.status).toBe(201);
        expect(r.body.id).toBeGreaterThan(0);

        const prod = await admin.get(`/api/productos/${productoId}`);
        expect(prod.body.stock_reservado).toBeGreaterThanOrEqual(3);
    });

    it('Cliente reserva > disponible → 409', async () => {
        const r = await cliente.post('/api/reservas', { producto_id: productoId, cantidad: 999999 });
        expect(r.status).toBe(409);
        expect(r.body.error).toMatch(/disponible/i);
    });

    it('Cliente lista sólo sus propias reservas', async () => {
        const r = await cliente.get('/api/reservas');
        expect(r.status).toBe(200);
        expect(r.body).toBeInstanceOf(Array);
        // Toda reserva del cliente tiene el mismo usuario
        const emails = new Set(r.body.map(x => x.usuario_email));
        expect(emails.size).toBeLessThanOrEqual(1);
    });

    it('Admin confirma reserva pendiente', async () => {
        const c = await cliente.post('/api/reservas', { producto_id: productoId, cantidad: 1 });
        const id = c.body.id;

        const r = await admin.patch(`/api/reservas/${id}/estado`, { estado: 'confirmada' });
        expect(r.status).toBe(200);

        const lista = await admin.get('/api/reservas?estado=confirmada');
        expect(lista.body.some(x => x.id === id)).toBe(true);
    });

    it('Admin no puede confirmar una reserva ya entregada', async () => {
        const c = await cliente.post('/api/reservas', { producto_id: productoId, cantidad: 1 });
        await admin.patch(`/api/reservas/${c.body.id}/estado`, { estado: 'entregada' });
        const r = await admin.patch(`/api/reservas/${c.body.id}/estado`, { estado: 'confirmada' });
        expect([400, 409]).toContain(r.status);
    });

    it('Entrega decrementa stock y crea movimiento salida', async () => {
        const prodAntes = await admin.get(`/api/productos/${productoId}`);
        const c = await cliente.post('/api/reservas', { producto_id: productoId, cantidad: 2 });

        const r = await admin.patch(`/api/reservas/${c.body.id}/estado`, { estado: 'entregada' });
        expect(r.status).toBe(200);

        const prodDespues = await admin.get(`/api/productos/${productoId}`);
        expect(prodDespues.body.stock).toBe(prodAntes.body.stock - 2);

        const mov = await admin.get(`/api/productos/${productoId}/movimientos`);
        expect(mov.body.movimientos[0].tipo).toBe('salida');
        expect(mov.body.movimientos[0].cantidad).toBe(2);
    });

    it('DELETE cancela y libera stock_reservado', async () => {
        const prodAntes = await admin.get(`/api/productos/${productoId}`);
        const reservadoAntes = prodAntes.body.stock_reservado;

        const c = await cliente.post('/api/reservas', { producto_id: productoId, cantidad: 4 });
        const r = await cliente.delete(`/api/reservas/${c.body.id}`);
        expect(r.status).toBe(200);

        const prodDespues = await admin.get(`/api/productos/${productoId}`);
        expect(prodDespues.body.stock_reservado).toBe(reservadoAntes);
    });

    it('Cliente NO puede cancelar reservas de otros', async () => {
        // Reserva creada por OTRO cliente (registramos uno nuevo)
        const request = require('supertest');
        const { app } = require('./helpers');
        const email = `otro-${unique()}@stockly.test`;
        const reg = await request(app).post('/api/auth/register').send({
            nombre: 'Otro', email, password: 'pwd-otro-1234',
        });
        const tok = reg.body.token;
        const c = await request(app).post('/api/reservas')
            .set('Authorization', `Bearer ${tok}`)
            .send({ producto_id: productoId, cantidad: 1 });

        // Intento de cancelar desde marcos@tfg.local
        const r = await cliente.delete(`/api/reservas/${c.body.id}`);
        expect([403, 404]).toContain(r.status);
    });

    it('POST /api/reservas/bulk aplica una misma acción a varias', async () => {
        const c1 = await cliente.post('/api/reservas', { producto_id: productoId, cantidad: 1 });
        const c2 = await cliente.post('/api/reservas', { producto_id: productoId, cantidad: 1 });
        const c3 = await cliente.post('/api/reservas', { producto_id: productoId, cantidad: 1 });
        const ids = [c1.body.id, c2.body.id, c3.body.id];

        const r = await admin.post('/api/reservas/bulk', { ids, accion: 'confirmar' });
        expect(r.status).toBe(200);
        expect(r.body.aplicadas).toBe(3);
        expect(r.body.fallidas).toBe(0);
    });

    it('Bulk con un id inexistente reporta fallida pero no aborta', async () => {
        const c = await cliente.post('/api/reservas', { producto_id: productoId, cantidad: 1 });
        const r = await admin.post('/api/reservas/bulk', {
            ids: [c.body.id, 99999999],
            accion: 'cancelar',
        });
        expect(r.status).toBe(200);
        expect(r.body.aplicadas).toBe(1);
        expect(r.body.fallidas).toBe(1);
    });

    it('Cliente bulk sólo puede usar accion=cancelar', async () => {
        const r = await cliente.post('/api/reservas/bulk', { ids: [1], accion: 'entregar' });
        expect(r.status).toBe(403);
    });
});
