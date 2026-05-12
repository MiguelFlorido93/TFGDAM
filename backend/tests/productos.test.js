const { auth, unique } = require('./helpers');

describe('Productos', () => {
    it('GET /api/productos lista paginada con totales', async () => {
        const a = await auth('cliente');
        const r = await a.get('/api/productos?page=1&limit=10');
        expect(r.status).toBe(200);
        expect(r.body.data).toBeInstanceOf(Array);
        expect(r.body.data.length).toBeGreaterThan(0);
        expect(typeof r.body.total).toBe('number');
        expect(r.body.total).toBeGreaterThan(0);
        expect(r.body.pages).toBeGreaterThan(0);

        const p = r.body.data[0];
        expect(p).toHaveProperty('sku');
        expect(p).toHaveProperty('nombre');
        expect(p).toHaveProperty('stock');
        expect(p).toHaveProperty('stock_reservado');
        expect(p).toHaveProperty('precio');
    });

    it('GET /api/productos?search=X filtra por nombre/SKU', async () => {
        const a = await auth('cliente');
        const r = await a.get('/api/productos?search=SKU-0000');
        expect(r.status).toBe(200);
        // Esperamos al menos un producto con SKU que empiece por SKU-0000
        expect(r.body.data.some(p => p.sku.startsWith('SKU-0000'))).toBe(true);
    });

    it('GET /api/productos?stock_bajo=1 filtra correctamente', async () => {
        const a = await auth('cliente');
        const r = await a.get('/api/productos?stock_bajo=1&limit=50');
        expect(r.status).toBe(200);
        // Cada producto devuelto debe cumplir disp <= mínimo
        for (const p of r.body.data) {
            expect(p.stock - p.stock_reservado).toBeLessThanOrEqual(p.stock_minimo);
        }
    });

    it('POST /api/productos como admin crea producto + movimiento entrada', async () => {
        const a = await auth('admin');
        const sku = 'TEST-' + unique().toUpperCase();
        const r = await a.post('/api/productos', {
            sku,
            nombre: 'Producto de test ' + sku,
            ubicacion: 'Z-99-99',
            stock: 10,
            stock_minimo: 3,
            precio: 19.95,
        });
        expect(r.status).toBe(201);
        expect(r.body.id).toBeGreaterThan(0);

        // Verifica que se ha creado el movimiento de entrada
        const mov = await a.get(`/api/productos/${r.body.id}/movimientos`);
        expect(mov.status).toBe(200);
        expect(mov.body.movimientos[0].tipo).toBe('entrada');
        expect(mov.body.movimientos[0].cantidad).toBe(10);
    });

    it('POST /api/productos como cliente → 403', async () => {
        const a = await auth('cliente');
        const r = await a.post('/api/productos', {
            sku: 'NOPE-' + unique(), nombre: 'X', ubicacion: 'Y-1',
        });
        expect(r.status).toBe(403);
    });

    it('POST /api/productos con SKU inválido → 400', async () => {
        const a = await auth('admin');
        const r = await a.post('/api/productos', {
            sku: 'no  válido!!',
            nombre: 'Algo',
            ubicacion: 'X-1',
        });
        expect(r.status).toBe(400);
        expect(r.body.error).toMatch(/SKU/i);
    });

    it('GET /api/productos/sku-sugerido → SKU-NNNNN', async () => {
        const a = await auth('admin');
        const r = await a.get('/api/productos/sku-sugerido');
        expect(r.status).toBe(200);
        expect(r.body.sku).toMatch(/^SKU-\d{5,}$/);
    });

    it('PUT /api/productos/:id ajusta stock y registra movimiento', async () => {
        const a = await auth('admin');
        const sku = 'PUT-' + unique().toUpperCase();
        const c = await a.post('/api/productos', {
            sku, nombre: 'Test PUT', ubicacion: 'Z-77', stock: 5, precio: 1,
        });
        const id = c.body.id;

        const putR = await a.put(`/api/productos/${id}`, { stock: 12 });
        expect(putR.status).toBe(200);

        const mov = await a.get(`/api/productos/${id}/movimientos`);
        const ajuste = mov.body.movimientos.find(m => m.tipo === 'ajuste');
        expect(ajuste).toBeTruthy();
        expect(ajuste.cantidad).toBe(7);   // 12 - 5
    });

    it('POST /api/productos/import importa filas con per-row results', async () => {
        const a = await auth('admin');
        const tag = unique();
        const r = await a.post('/api/productos/import', {
            productos: [
                { sku: 'IMP-' + tag.toUpperCase() + '-A', nombre: 'Importado A', ubicacion: 'X-1', stock: 5,  precio: 1.5 },
                { sku: 'IMP-' + tag.toUpperCase() + '-B', nombre: 'Importado B', ubicacion: 'X-2', stock: 0,  precio: 2.0 },
                { sku: '',  nombre: '',          ubicacion: 'X-3' },   // error: nombre vacío
            ],
        });
        expect(r.status).toBe(200);
        expect(r.body.creados).toBe(2);
        expect(r.body.fallidos).toBe(1);
        expect(r.body.resultados).toHaveLength(3);
    });
});
