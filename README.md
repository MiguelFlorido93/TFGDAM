# 📦 Stockly — Gestión inteligente de almacén

**Trabajo Fin de Grado · CFGS DAM (Desarrollo de Aplicaciones Multiplataforma)**
Autores: **Adrián Bravo Santos** y **Miguel Ángel Florido** · Curso 2025-2026

**Stockly** es una aplicación web multiplataforma (escritorio + móvil, instalable como PWA) para gestionar el catálogo de un almacén y las reservas de sus productos, con roles diferenciados de cliente, operario y administrador.

> Pantallas: catálogo con búsqueda y filtros, mis reservas con cambios de estado, dashboard con KPIs y gráficos, gestión de inventario y de usuarios.

---

## 🧭 Estructura

```
TFGDAM/
├── db/
│   └── schema.sql              # Esquema + 500 productos + reservas y usuarios de ejemplo
├── backend/
│   ├── server.js               # Bootstrap Express + middlewares
│   ├── src/
│   │   ├── db.js               # Pool MySQL/MariaDB
│   │   ├── middleware/auth.js  # JWT + control de roles
│   │   └── routes/             # auth, productos, categorías, reservas, admin
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html              # Login + SPA (productos, reservas, dashboard, inventario, usuarios)
│   ├── styles.css              # Sistema de diseño (claro + oscuro, responsive, móvil)
│   ├── app.js                  # Lógica SPA (vanilla JS)
│   ├── manifest.webmanifest    # Instalable como PWA
│   ├── sw.js                   # Service Worker (offline shell)
│   └── assets/icon.svg         # Icono base
├── docs/
│   ├── BITACORA.md             # Cuaderno de bitácora del proyecto
│   ├── ROADMAP.md              # Itinerario de tareas / fases
│   ├── figma-preview.md        # Guía: preview en Figma
│   ├── hosting.md              # Guía: hostear con dominio
│   └── mobile.md               # Guía: versión móvil (PWA + Capacitor)
└── scripts/
    └── reset_mysql.bat         # Script de reinicio rápido de la BD
```

---

## 🚀 Puesta en marcha (local)

### 1. Base de datos
Requiere **MariaDB 10.4+** o **MySQL 8+**:
```bash
mysql -u root -p < db/schema.sql
```
Esto crea la BD `stockly` con 500 productos y 5 usuarios semilla.

### 2. Backend
```bash
cd backend
cp .env.example .env       # ajusta credenciales y JWT_SECRET
npm install
npm start                  # arranca en http://localhost:3001
```
La primera vez, el backend detecta los hashes placeholder de los usuarios semilla y los reemplaza por hashes válidos de la contraseña `password123`.

### 3. Frontend
El backend sirve el frontend estático en `http://localhost:3001/`.
Al ser una PWA, también se puede instalar desde el navegador (icono "Instalar" en la barra de direcciones).

---

## 👤 Cuentas demo

| Rol      | Email               | Contraseña    |
|----------|---------------------|---------------|
| admin    | adrian@tfg.local    | password123   |
| admin    | miguel@tfg.local    | password123   |
| operario | laura@tfg.local     | password123   |
| cliente  | marcos@tfg.local    | password123   |
| cliente  | ana@tfg.local       | password123   |

> Cualquiera puede registrarse desde la pantalla de login (rol cliente por defecto).

---

## 🔌 API REST resumida

Todas las rutas devuelven JSON. Las marcadas con 🔒 requieren `Authorization: Bearer <jwt>`.

### Auth
| Método | Ruta                  | Descripción                       |
|--------|-----------------------|-----------------------------------|
| POST   | /api/auth/login       | Login → `{ token, user }`         |
| POST   | /api/auth/register    | Auto-registro (rol cliente)       |
| GET    | /api/auth/me          | 🔒 Datos del usuario del token    |

### Productos
| Método | Ruta                          | Rol mínimo | Descripción                       |
|--------|-------------------------------|------------|-----------------------------------|
| GET    | /api/productos                | público    | `search`, `categoria`, `page`, `limit`, `sort`, `dir`, `stock_bajo` |
| GET    | /api/productos/:id            | público    | Detalle                           |
| POST   | /api/productos                | operario   | Alta                              |
| PUT    | /api/productos/:id            | operario   | Modificación + log de movimiento  |
| DELETE | /api/productos/:id            | admin      | Baja lógica                       |

### Reservas
| Método | Ruta                          | Descripción                                  |
|--------|-------------------------------|----------------------------------------------|
| GET    | /api/reservas?estado=         | 🔒 Cliente: las suyas. Staff: todas.         |
| POST   | /api/reservas                 | 🔒 Crear (transacción `FOR UPDATE`)          |
| PATCH  | /api/reservas/:id/estado      | 🔒 Operario: confirmar/entregar              |
| DELETE | /api/reservas/:id             | 🔒 Cancelar (libera stock)                   |

### Admin
| Método | Ruta                              | Descripción                                |
|--------|-----------------------------------|--------------------------------------------|
| GET    | /api/admin/stats                  | KPIs, gráficos, top productos              |
| GET    | /api/admin/movimientos            | Historial de movimientos de stock          |
| GET    | /api/admin/usuarios               | Listado (admin)                            |
| POST   | /api/admin/usuarios               | Alta (admin)                               |
| PUT    | /api/admin/usuarios/:id           | Edición (admin)                            |
| GET    | /api/admin/export/reservas.csv    | Exportación CSV                            |

---

## ✨ Funcionalidades

- **Autenticación JWT** con bcrypt, expiración configurable, rate-limit en `/api/auth`.
- **Roles**: cliente, operario, admin (UI y API ajustadas por rol).
- **Catálogo** con búsqueda, filtro por categoría, ordenación y paginación.
- **Reserva con bloqueo transaccional** (`SELECT ... FOR UPDATE`) — sin sobrerreserva.
- **Flujo de estados**: pendiente → confirmada → entregada (o cancelada).
- **Auditoría**: tabla `movimientos` con cada entrada/salida/ajuste/reserva/liberación.
- **Dashboard** con KPIs, gráficos de barras (reservas últimos 14 días, stock por categoría) y top de productos.
- **Inventario** con CRUD y resaltado de productos en stock bajo.
- **Gestión de usuarios** (alta, edición, cambio de rol/contraseña).
- **Export CSV** de reservas.
- **PWA** instalable + service worker (shell offline).
- **Modo claro/oscuro** y diseño responsive con bottom navigation en móvil.
- **Seguridad**: helmet, compression, CORS, rate-limit, JWT.

---

## 📚 Documentación adicional

- 📓 [docs/BITACORA.md](docs/BITACORA.md) — Cuaderno de bitácora del proyecto
- 🗺️ [docs/ROADMAP.md](docs/ROADMAP.md) — Itinerario de tareas y fases
- 🎨 [docs/figma-preview.md](docs/figma-preview.md) — Cómo prototipar / preview en Figma
- 🌐 [docs/hosting.md](docs/hosting.md) — Cómo hostear el proyecto en internet con un dominio
- 📱 [docs/mobile.md](docs/mobile.md) — Versión móvil (PWA + Capacitor)

---

## 🛠️ Stack

- **Backend**: Node.js 18+, Express, MySQL2, JWT, bcryptjs, helmet, morgan, compression, express-rate-limit
- **Base de datos**: MariaDB / MySQL
- **Frontend**: HTML + CSS + JavaScript (sin framework), PWA, Service Worker
- **Despliegue**: ver `docs/hosting.md`

---

© 2026 · Stockly · Adrián Bravo Santos y Miguel Ángel Florido · TFG DAM
