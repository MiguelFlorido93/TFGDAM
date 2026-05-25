// =============================================================
// Especificación OpenAPI 3.0 de la API de Stockly.
// Se monta en /api/docs vía swagger-ui-express.
// =============================================================
const PORT = process.env.PORT || 3001;
const RAILWAY_URL = 'https://tfgdam-production.up.railway.app';

module.exports = {
    openapi: '3.0.3',
    info: {
        title: 'Stockly API',
        version: '1.1.0',
        description:
            'API REST de Stockly · sistema de gestión de inventario y reservas de almacén.\n\n' +
            '**TFG DAM** · Adrián Bravo Santos & Miguel Ángel Florido.\n\n' +
            'Autenticación con JWT (cabecera `Authorization: Bearer <token>`).\n\n' +
            'Roles: `cliente` · `operario` · `admin`.',
        contact: { name: 'Stockly TFG' },
        license: { name: 'MIT' },
    },
    servers: [
        { url: RAILWAY_URL, description: 'Producción (Railway)' },
        { url: `http://localhost:${PORT}`, description: 'Desarrollo local' },
    ],
    tags: [
        { name: 'Auth', description: 'Login, registro y perfil del usuario' },
        { name: 'Productos', description: 'Catálogo · CRUD · importación · movimientos' },
        { name: 'Categorías', description: 'Gestión de categorías' },
        { name: 'Reservas', description: 'Crear, listar y gestionar reservas + incidencias' },
        { name: 'Admin', description: 'KPIs, usuarios, exportaciones (solo admin/operario)' },
        { name: 'Health', description: 'Estado del servicio' },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Token JWT obtenido en `/api/auth/login`.',
            },
        },
        schemas: {
            Error: {
                type: 'object',
                properties: { error: { type: 'string', example: 'Token requerido' } },
            },
            Usuario: {
                type: 'object',
                properties: {
                    id: { type: 'integer', example: 3 },
                    nombre: { type: 'string', example: 'Laura Operaria' },
                    email: { type: 'string', format: 'email', example: 'laura@tfg.local' },
                    rol: { type: 'string', enum: ['cliente', 'operario', 'admin'] },
                },
            },
            LoginRequest: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: { type: 'string', format: 'email', example: 'laura@tfg.local' },
                    password: { type: 'string', format: 'password', example: 'password123' },
                },
            },
            LoginResponse: {
                type: 'object',
                properties: {
                    token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs…' },
                    user: { $ref: '#/components/schemas/Usuario' },
                },
            },
            RegisterRequest: {
                type: 'object',
                required: ['nombre', 'email', 'password'],
                properties: {
                    nombre: { type: 'string', example: 'Nuevo Cliente' },
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', format: 'password', minLength: 6 },
                },
            },
            Producto: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    sku: { type: 'string', example: 'SKU-00005' },
                    nombre: { type: 'string', example: 'Tubería PVC 2m ref 5' },
                    descripcion: { type: 'string', nullable: true },
                    categoria_id: { type: 'integer', nullable: true },
                    ubicacion: { type: 'string', example: 'E-05-5' },
                    stock: { type: 'integer' },
                    stock_reservado: { type: 'integer' },
                    stock_minimo: { type: 'integer' },
                    precio: { type: 'number', format: 'float', example: 10.05 },
                    activo: { type: 'integer', enum: [0, 1] },
                },
            },
            Categoria: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    nombre: { type: 'string', example: 'Tornillería' },
                    icono: { type: 'string', nullable: true },
                    color: { type: 'string', example: '#A8601A' },
                    descripcion: { type: 'string', nullable: true },
                },
            },
            ReservaListItem: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    cantidad: { type: 'integer' },
                    estado: { type: 'string', enum: ['pendiente', 'confirmada', 'entregada', 'cancelada'] },
                    fecha_reserva: { type: 'string', format: 'date-time' },
                    fecha_recogida: { type: 'string', format: 'date-time', nullable: true },
                    fecha_entrega: { type: 'string', format: 'date-time', nullable: true },
                    notas: { type: 'string', nullable: true },
                    usuario_id: { type: 'integer' },
                    usuario: { type: 'string' },
                    usuario_email: { type: 'string' },
                    producto_id: { type: 'integer' },
                    sku: { type: 'string' },
                    producto: { type: 'string' },
                    ubicacion: { type: 'string', nullable: true },
                    precio: { type: 'number' },
                },
            },
            ReservaDetalle: {
                allOf: [
                    { $ref: '#/components/schemas/ReservaListItem' },
                    {
                        type: 'object',
                        properties: {
                            producto_descripcion: { type: 'string', nullable: true },
                            confirmada_por_id: { type: 'integer', nullable: true },
                            entregada_por_id: { type: 'integer', nullable: true },
                            confirmada_por: { $ref: '#/components/schemas/Usuario', nullable: true },
                            entregada_por: { $ref: '#/components/schemas/Usuario', nullable: true },
                            incidencias: { type: 'array', items: { $ref: '#/components/schemas/Incidencia' } },
                        },
                    },
                ],
            },
            CrearReservaRequest: {
                type: 'object',
                required: ['producto_id', 'cantidad'],
                properties: {
                    producto_id: { type: 'integer', example: 5 },
                    cantidad: { type: 'integer', minimum: 1, example: 2 },
                    fecha_recogida: { type: 'string', format: 'date', nullable: true },
                    notas: { type: 'string', nullable: true },
                },
            },
            CambiarEstadoRequest: {
                type: 'object',
                required: ['estado'],
                properties: {
                    estado: { type: 'string', enum: ['confirmada', 'entregada', 'cancelada', 'pendiente'] },
                },
            },
            Incidencia: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    tipo: { type: 'string', enum: ['rotura', 'faltante', 'mal_estado', 'otro'] },
                    descripcion: { type: 'string' },
                    creado_en: { type: 'string', format: 'date-time' },
                    operario_id: { type: 'integer', nullable: true },
                    operario: { type: 'string', nullable: true },
                    operario_email: { type: 'string', nullable: true },
                },
            },
            CrearIncidenciaRequest: {
                type: 'object',
                required: ['descripcion'],
                properties: {
                    tipo: { type: 'string', enum: ['rotura', 'faltante', 'mal_estado', 'otro'], default: 'otro' },
                    descripcion: { type: 'string', maxLength: 2000 },
                },
            },
            Movimiento: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    producto_id: { type: 'integer' },
                    usuario_id: { type: 'integer' },
                    tipo: { type: 'string', enum: ['entrada', 'salida', 'ajuste', 'reserva', 'liberacion'] },
                    cantidad: { type: 'integer' },
                    stock_anterior: { type: 'integer' },
                    stock_posterior: { type: 'integer' },
                    motivo: { type: 'string' },
                    created_at: { type: 'string', format: 'date-time' },
                },
            },
            HealthResponse: {
                type: 'object',
                properties: {
                    ok: { type: 'boolean' },
                    db: { type: 'boolean' },
                    ts: { type: 'string', format: 'date-time' },
                },
            },
        },
    },
    security: [{ bearerAuth: [] }],
    paths: {
        '/api/health': {
            get: {
                tags: ['Health'],
                summary: 'Estado del servicio y conexión a BD',
                security: [],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } } },
                    500: { description: 'Error en BD' },
                },
            },
        },

        // ── Auth ─────────────────────────────────────────────────
        '/api/auth/login': {
            post: {
                tags: ['Auth'],
                summary: 'Login con email y contraseña',
                security: [],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
                responses: {
                    200: { description: 'Token emitido', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
                    401: { description: 'Credenciales inválidas', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    429: { description: 'Rate limit: 30 peticiones / 15 min por IP' },
                },
            },
        },
        '/api/auth/register': {
            post: {
                tags: ['Auth'],
                summary: 'Registro de cliente nuevo',
                security: [],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } } },
                responses: {
                    201: { description: 'Usuario creado', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
                    409: { description: 'Email ya registrado' },
                },
            },
        },
        '/api/auth/me': {
            get: {
                tags: ['Auth'],
                summary: 'Perfil del usuario autenticado',
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Usuario' } } } },
                    401: { description: 'Token faltante o inválido' },
                },
            },
            patch: {
                tags: ['Auth'],
                summary: 'Actualizar perfil propio',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: {
                        type: 'object',
                        properties: {
                            nombre: { type: 'string' },
                            email: { type: 'string', format: 'email' },
                            password: { type: 'string', format: 'password' },
                        },
                    } } },
                },
                responses: { 200: { description: 'Actualizado' }, 401: { description: 'No autenticado' } },
            },
        },

        // ── Productos ────────────────────────────────────────────
        '/api/productos': {
            get: {
                tags: ['Productos'],
                summary: 'Catálogo paginado con filtros',
                security: [],
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                    { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Substring en nombre o SKU' },
                    { name: 'categoria', in: 'query', schema: { type: 'integer' } },
                    { name: 'sort', in: 'query', schema: { type: 'string', enum: ['id', 'nombre', 'precio', 'stock'] } },
                    { name: 'dir', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
                ],
                responses: {
                    200: { description: 'Lista paginada de productos', content: { 'application/json': { schema: {
                        type: 'object',
                        properties: {
                            items: { type: 'array', items: { $ref: '#/components/schemas/Producto' } },
                            total: { type: 'integer' },
                            page: { type: 'integer' },
                            limit: { type: 'integer' },
                        },
                    } } } },
                },
            },
            post: {
                tags: ['Productos'],
                summary: 'Crear producto (admin / operario)',
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Producto' } } } },
                responses: { 201: { description: 'Creado' }, 403: { description: 'No autorizado' } },
            },
        },
        '/api/productos/{id}': {
            get: {
                tags: ['Productos'],
                summary: 'Detalle de producto',
                security: [],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Producto' } } } },
                    404: { description: 'No existe' },
                },
            },
            put: {
                tags: ['Productos'],
                summary: 'Editar producto',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Producto' } } } },
                responses: { 200: { description: 'Actualizado' }, 403: { description: 'No autorizado' } },
            },
            delete: {
                tags: ['Productos'],
                summary: 'Eliminar producto (solo admin)',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: { 204: { description: 'Eliminado' }, 403: { description: 'No autorizado' } },
            },
        },
        '/api/productos/{id}/movimientos': {
            get: {
                tags: ['Productos'],
                summary: 'Histórico de movimientos del producto',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'Lista de movimientos', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Movimiento' } } } } } },
            },
        },
        '/api/productos/import': {
            post: {
                tags: ['Productos'],
                summary: 'Importación masiva desde CSV',
                requestBody: { required: true, content: { 'application/json': { schema: {
                    type: 'object',
                    properties: { csv: { type: 'string', description: 'Contenido CSV con cabecera' } },
                } } } },
                responses: { 200: { description: 'Resumen de la importación' } },
            },
        },
        '/api/productos/sku-sugerido': {
            get: {
                tags: ['Productos'],
                summary: 'Genera un nuevo SKU disponible',
                responses: { 200: { description: 'SKU sugerido', content: { 'application/json': { schema: {
                    type: 'object', properties: { sku: { type: 'string', example: 'SKU-00501' } },
                } } } } },
            },
        },

        // ── Categorías ───────────────────────────────────────────
        '/api/categorias': {
            get: {
                tags: ['Categorías'],
                summary: 'Listado de categorías',
                security: [],
                responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Categoria' } } } } } },
            },
            post: {
                tags: ['Categorías'],
                summary: 'Crear categoría (admin)',
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Categoria' } } } },
                responses: { 201: { description: 'Creada' }, 403: { description: 'No autorizado' } },
            },
        },
        '/api/categorias/{id}': {
            patch: {
                tags: ['Categorías'],
                summary: 'Editar categoría',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Categoria' } } } },
                responses: { 200: { description: 'Actualizada' } },
            },
            delete: {
                tags: ['Categorías'],
                summary: 'Eliminar categoría',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: { 204: { description: 'Eliminada' } },
            },
        },
        '/api/categorias/{id}/merge': {
            post: {
                tags: ['Categorías'],
                summary: 'Fusionar productos de esta categoría en otra',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                requestBody: { required: true, content: { 'application/json': { schema: {
                    type: 'object', required: ['destino_id'], properties: { destino_id: { type: 'integer' } },
                } } } },
                responses: { 200: { description: 'Fusión completada' } },
            },
        },

        // ── Reservas ─────────────────────────────────────────────
        '/api/reservas': {
            get: {
                tags: ['Reservas'],
                summary: 'Listar reservas (filtros por estado, fecha, búsqueda)',
                parameters: [
                    { name: 'estado', in: 'query', schema: { type: 'string', example: 'pendiente,confirmada' }, description: 'Estados separados por coma' },
                    { name: 'activas', in: 'query', schema: { type: 'integer', enum: [0, 1] }, description: 'Atajo: pendiente + confirmada' },
                    { name: 'historico', in: 'query', schema: { type: 'integer', enum: [0, 1] }, description: 'Atajo: entregada + cancelada' },
                    { name: 'usuario_id', in: 'query', schema: { type: 'integer' } },
                    { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Búsqueda por id, SKU o nombre' },
                    { name: 'desde', in: 'query', schema: { type: 'string', format: 'date' } },
                    { name: 'hasta', in: 'query', schema: { type: 'string', format: 'date' } },
                ],
                responses: { 200: { description: 'Lista', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ReservaListItem' } } } } } },
            },
            post: {
                tags: ['Reservas'],
                summary: 'Crear reserva (usuario autenticado)',
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CrearReservaRequest' } } } },
                responses: {
                    201: { description: 'Creada', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'integer' } } } } } },
                    409: { description: 'Stock insuficiente' },
                },
            },
        },
        '/api/reservas/{id}': {
            get: {
                tags: ['Reservas'],
                summary: 'Detalle enriquecido (cliente, trazabilidad, incidencias)',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/ReservaDetalle' } } } },
                    404: { description: 'No existe' },
                },
            },
            delete: {
                tags: ['Reservas'],
                summary: 'Cancelar reserva (cliente propietario u operario/admin)',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'Cancelada' }, 403: { description: 'No autorizado' } },
            },
        },
        '/api/reservas/{id}/estado': {
            patch: {
                tags: ['Reservas'],
                summary: 'Cambiar estado (confirmar / entregar / cancelar)',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CambiarEstadoRequest' } } } },
                responses: {
                    200: { description: 'OK · registra confirmada_por_id / entregada_por_id con el JWT' },
                    400: { description: 'Transición inválida' },
                    403: { description: 'No autorizado' },
                },
            },
        },
        '/api/reservas/{id}/incidencias': {
            post: {
                tags: ['Reservas'],
                summary: 'Reportar incidencia (operario / admin)',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CrearIncidenciaRequest' } } } },
                responses: {
                    201: { description: 'Incidencia creada', content: { 'application/json': { schema: { $ref: '#/components/schemas/Incidencia' } } } },
                    400: { description: 'Descripción vacía o muy larga' },
                    404: { description: 'Reserva no encontrada' },
                },
            },
        },
        '/api/reservas/bulk': {
            post: {
                tags: ['Reservas'],
                summary: 'Acción masiva sobre varias reservas',
                requestBody: { required: true, content: { 'application/json': { schema: {
                    type: 'object',
                    required: ['ids', 'accion'],
                    properties: {
                        ids: { type: 'array', items: { type: 'integer' }, maxItems: 100 },
                        accion: { type: 'string', enum: ['confirmar', 'entregar', 'cancelar'] },
                    },
                } } } },
                responses: { 200: { description: 'Resumen', content: { 'application/json': { schema: {
                    type: 'object',
                    properties: {
                        aplicadas: { type: 'integer' },
                        fallidas: { type: 'integer' },
                        resultados: { type: 'array', items: {
                            type: 'object',
                            properties: {
                                id: { type: 'integer' },
                                ok: { type: 'boolean' },
                                error: { type: 'string' },
                            },
                        } },
                    },
                } } } } },
            },
        },

        // ── Admin ────────────────────────────────────────────────
        '/api/admin/stats': {
            get: {
                tags: ['Admin'],
                summary: 'KPIs del dashboard (admin/operario)',
                responses: { 200: { description: 'Métricas agregadas' } },
            },
        },
        '/api/admin/usuarios': {
            get: {
                tags: ['Admin'],
                summary: 'Listado de usuarios (admin)',
                responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Usuario' } } } } } },
            },
            post: {
                tags: ['Admin'],
                summary: 'Crear usuario (admin)',
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } } },
                responses: { 201: { description: 'Creado' } },
            },
        },
        '/api/admin/usuarios/{id}': {
            put: {
                tags: ['Admin'],
                summary: 'Editar usuario (admin)',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                requestBody: { required: true, content: { 'application/json': { schema: {
                    type: 'object',
                    properties: {
                        nombre: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                        rol: { type: 'string', enum: ['cliente', 'operario', 'admin'] },
                        activo: { type: 'integer', enum: [0, 1] },
                        password: { type: 'string', format: 'password', nullable: true },
                    },
                } } } },
                responses: { 200: { description: 'Actualizado' } },
            },
        },
        '/api/admin/movimientos': {
            get: {
                tags: ['Admin'],
                summary: 'Histórico global de movimientos',
                parameters: [
                    { name: 'producto_id', in: 'query', schema: { type: 'integer' } },
                    { name: 'tipo', in: 'query', schema: { type: 'string', enum: ['entrada', 'salida', 'ajuste', 'reserva', 'liberacion'] } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 200 } },
                ],
                responses: { 200: { description: 'Lista', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Movimiento' } } } } } },
            },
        },
        '/api/admin/export/reservas.csv': {
            get: {
                tags: ['Admin'],
                summary: 'Exportar reservas a CSV',
                responses: { 200: { description: 'Archivo CSV', content: { 'text/csv': {} } } },
            },
        },
        '/api/admin/export/inventario.csv': {
            get: {
                tags: ['Admin'],
                summary: 'Exportar inventario a CSV',
                responses: { 200: { description: 'Archivo CSV', content: { 'text/csv': {} } } },
            },
        },
    },
};
