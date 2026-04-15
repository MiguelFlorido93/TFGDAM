# TFG DAM — Prototipo de gestión de reservas de almacén

Aplicación multiplataforma (escritorio + móvil, vía web responsive) para gestionar reservas de productos de un almacén.

Este repositorio contiene el **prototipo inicial**:

- Backend REST en **Node.js + Express** contra **MariaDB**.
- Frontend responsive en HTML/CSS/JS (sin framework) que funciona en escritorio y móvil.
- Base de datos con esquema completo y semilla de **500 productos de prueba**.

---

## Estructura

```
TFGDAM/
├── db/
│   └── schema.sql          # Esquema + 500 productos + usuarios/reservas de ejemplo
├── backend/
│   ├── server.js           # API REST
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── README.md
```

## Modelo de datos

- **usuarios** (admin / operario / cliente)
- **categorias** (10 categorías)
- **productos** (500 registros semilla con SKU, ubicación tipo `A-12-3`, stock, stock reservado, precio)
- **reservas** (usuario, producto, cantidad, estado, fecha)

## Puesta en marcha

### 1. Base de datos
Requiere MariaDB 10.4+ o MySQL 8+.
```bash
mysql -u root -p < db/schema.sql
```
Esto crea la BD `almacen_tfg` e inserta los 500 productos.

### 2. Backend
```bash
cd backend
cp .env.example .env     # edita credenciales si hace falta
npm install
npm start
```
API en `http://localhost:3001`.

### 3. Frontend
El propio backend sirve el frontend estático. Abre:
```
http://localhost:3001/
```
También puedes abrir `frontend/index.html` directamente; apuntará a `http://localhost:3001/api`.

## Endpoints principales

| Método | Ruta                     | Descripción                              |
|--------|--------------------------|------------------------------------------|
| GET    | /api/health              | Comprueba conexión con la BD             |
| GET    | /api/categorias          | Lista de categorías                      |
| GET    | /api/productos           | Listado paginado con `search`, `categoria`, `page`, `limit` |
| GET    | /api/productos/:id       | Detalle de producto                      |
| GET    | /api/usuarios            | Usuarios (para seleccionar en la UI)     |
| GET    | /api/reservas?usuario_id | Reservas de un usuario                   |
| POST   | /api/reservas            | Crea reserva (valida stock disponible)   |
| DELETE | /api/reservas/:id        | Cancela reserva y libera stock           |

## Funcionalidades del prototipo

- Listado paginado de productos con búsqueda por nombre/SKU y filtro por categoría.
- Creación de reservas con bloqueo transaccional del stock (usa `FOR UPDATE`).
- Vista "Mis reservas" por usuario, con cancelación que libera stock.
- Interfaz responsive: mismo frontend en escritorio y móvil.

## Próximos pasos previstos para el TFG

- Autenticación (JWT) y roles.
- App móvil nativa o PWA con escaneo de códigos de barras/QR.
- Panel admin para altas/bajas de productos y reporting.
- Notificaciones push de recordatorio de recogida.
