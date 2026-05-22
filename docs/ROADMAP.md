# 🗺️ Roadmap / Itinerario de tareas

Lista priorizada de mejoras de **aspecto** y **funcionalidad** de la aplicación, agrupadas por fases y con responsable orientativo (A = Adrián Bravo Santos, M = Miguel Ángel Florido, AM = ambos). Las marcas reflejan el estado real al final del Sprint 4.

Leyenda: ✅ hecho · 🟡 en curso · ⏳ pendiente

---

## Fase 1 — Núcleo funcional (Sprints 0-2) ✅

| # | Tarea                                                              | Responsable | Estado |
|---|--------------------------------------------------------------------|-------------|--------|
| 1.1 | Modelado E/R + esquema SQL + 500 productos semilla               | M           | ✅     |
| 1.2 | API REST: productos, categorías, reservas                        | A           | ✅     |
| 1.3 | Frontend SPA básico (catálogo + reservar)                        | A           | ✅     |
| 1.4 | Reservas concurrentes con `FOR UPDATE`                           | AM          | ✅     |
| 1.5 | Login + registro + JWT + bcrypt                                  | A           | ✅     |
| 1.6 | Roles cliente / operario / admin en API                          | A           | ✅     |

## Fase 2 — Mejora de UX y panel administrativo (Sprint 3) ✅

| # | Tarea                                                              | Responsable | Estado |
|---|--------------------------------------------------------------------|-------------|--------|
| 2.1 | Sistema de diseño (tokens CSS, espaciados, tipografía)            | A           | ✅     |
| 2.2 | Cambio de estado de reservas (confirmar / entregar / cancelar)    | A           | ✅     |
| 2.3 | Tabla `movimientos` y auditoría automática                        | M           | ✅     |
| 2.4 | Endpoint `/api/admin/stats` con KPIs                              | M           | ✅     |
| 2.5 | Vista Dashboard con gráficos en CSS                               | M           | ✅     |
| 2.6 | Vista Inventario con CRUD + alerta stock bajo                     | A           | ✅     |
| 2.7 | Vista Usuarios (alta/edición admin)                               | M           | ✅     |
| 2.8 | Export CSV de reservas                                            | M           | ✅     |

## Fase 3 — PWA, móvil y modo oscuro (Sprint 4) ✅

| # | Tarea                                                              | Responsable | Estado |
|---|--------------------------------------------------------------------|-------------|--------|
| 3.1 | Manifest + iconos                                                 | A           | ✅     |
| 3.2 | Service Worker (cache shell, offline-first del esqueleto)         | A           | ✅     |
| 3.3 | Bottom navigation en móvil                                        | A           | ✅     |
| 3.4 | Modo oscuro con preferencia del sistema + toggle                  | A           | ✅     |
| 3.5 | Diseño responsive: grid 2 columnas en móvil                       | A           | ✅     |
| 3.6 | Toasts y modales accesibles                                       | A           | ✅     |

## Fase 4 — Despliegue y documentación (Sprint 5, en curso) 🟡

| # | Tarea                                                              | Responsable | Estado |
|---|--------------------------------------------------------------------|-------------|--------|
| 4.0 | **Desplegar la app a Railway (sustituir localhost)** — backend Node + MySQL gestionado, URL pública `*.up.railway.app`. Código ya cloud-ready (`MYSQL_URL`, `trust proxy`, `CORS_ORIGIN`, bootstrap automático de schema, fail-fast si falta `JWT_SECRET`). Falta la acción en el panel de Railway. Ver `docs/hosting.md`. | A | 🟡 |
| 4.1 | Provisionar Railway (proyecto + plugin MySQL + variables)         | A           | 🟡     |
| 4.2 | Dominio propio (opcional; el subdominio gratuito es suficiente)   | A           | ⏳     |
| 4.3 | HTTPS (gestionado automáticamente por Railway)                    | A           | ✅     |
| 4.4 | Backup automatizado de la BD                                      | M           | ⏳     |
| 4.5 | Workflow GitHub Actions: build + deploy automático                | A           | ⏳     |
| 4.6 | Memoria PDF                                                       | AM          | 🟡     |
| 4.7 | Vídeo demo 3 min                                                  | AM          | ⏳     |
| 4.8 | Diagramas: E/R, casos de uso, despliegue                          | M           | 🟡     |

## Fase 5 — Mejoras de aspecto (UI/UX) ⏳

| # | Tarea                                                              | Prioridad |
|---|--------------------------------------------------------------------|-----------|
| 5.1 | Skeleton loaders mientras se cargan listados                      | media     |
| 5.2 | Animaciones sutiles entre vistas (View Transitions API)           | baja      |
| 5.3 | Imágenes reales de producto + lazy loading                        | media     |
| 5.4 | Modo "alta densidad" para inventario en pantallas grandes         | baja      |
| 5.5 | Toast con stack (varios mensajes apilables)                       | baja      |
| 5.6 | Gráficos avanzados con Chart.js (donut categorías, line)          | media     |
| 5.7 | Filtros guardados en URL (compartibles)                           | media     |
| 5.8 | Internacionalización es / en                                      | baja      |
| 5.9 | Atajos de teclado en escritorio (`/` para buscar, `n` nuevo)      | baja      |
| 5.10| Accesibilidad WCAG AA: foco visible, ARIA, contraste              | alta      |

## Fase 6 — Mejoras de funcionalidad ⏳

| # | Tarea                                                              | Prioridad |
|---|--------------------------------------------------------------------|-----------|
| 6.1 | Carrito: reservar varios productos a la vez                       | alta      |
| 6.2 | Notificaciones (Web Push) cuando una reserva se confirma          | media     |
| 6.3 | Lector de códigos QR/barras (cámara) para encontrar producto      | alta      |
| 6.4 | Historial de cambios de stock por producto (drilldown)            | media     |
| 6.5 | Gestión de proveedores y entradas de mercancía                    | media     |
| 6.6 | Caducidades y lotes                                               | baja      |
| 6.7 | Subida de imágenes de producto (multer + carpeta `uploads/`)      | alta      |
| 6.8 | Exportación PDF de albarán al entregar una reserva                | media     |
| 6.9 | Multi-almacén (almacenes con sus propias ubicaciones)             | baja      |
| 6.10| Recuperación de contraseña por email                              | media     |

## Fase 8 — App móvil Android nativa para el operario (Kotlin) ⏳

Aplicación **Android nativa en Kotlin** que consume la misma API REST. El empleado consulta reservas pendientes y confirmadas, ve el detalle (cliente, productos, cantidades), confirma el pedido y la entrega, y si hay un problema rellena un formulario de incidencia que queda adjunto a la reserva. El sistema registra **quién confirmó**, **quién entregó** y **quién reportó** cada incidencia para tener trazabilidad completa por empleado.

### 8.A Flujo funcional

| Estado de reserva | Acción del empleado | Transición                  | Quién queda registrado          |
|-------------------|---------------------|------------------------------|----------------------------------|
| `pendiente`       | Confirmar pedido    | `pendiente → confirmada`     | `confirmada_por_id`              |
| `confirmada`      | Confirmar entrega   | `confirmada → entregada`     | `entregada_por_id`               |
| Cualquier estado activo | Reportar incidencia | (no cambia estado, opcionalmente `incidencia`) | `incidencias.operario_id` |

### 8.B Pantallas

1. **Login** (email/password) → JWT guardado cifrado.
2. **Lista de reservas** filtrable por estado: `pendientes`, `confirmadas` (por defecto las dos). Muestra cliente, productos resumidos, fecha, estado.
3. **Detalle de reserva**: datos del cliente, lista de productos con cantidades y ubicación, historial de quién confirmó/entregó, incidencias previas si las hay. Tres botones contextuales:
   - "Confirmar pedido" (solo si estado = `pendiente`).
   - "Confirmar entrega" (solo si estado = `confirmada`).
   - "Reportar incidencia" (siempre disponible).
4. **Formulario de incidencia**: tipo (rotura / faltante / mal estado / otro), descripción libre, foto opcional. Al guardar, la incidencia se adjunta a la reserva.

### 8.C Tareas

| #    | Tarea                                                                                       | Prioridad |
|------|---------------------------------------------------------------------------------------------|-----------|
| 8.1  | Bootstrap del proyecto Android Studio (`mobile-android/`) — Kotlin + Jetpack Compose         | alta      |
| 8.2  | Capa de red: Retrofit + OkHttp + interceptor JWT contra la API pública                       | alta      |
| 8.3  | Login → guardar token con EncryptedSharedPreferences                                          | alta      |
| 8.4  | Lista de reservas filtrable por estado (`pendientes` / `confirmadas`)                         | alta      |
| 8.5  | Detalle de reserva con productos, cantidades, historial y botones contextuales                | alta      |
| 8.6  | Acción **Confirmar pedido** (`PATCH /api/reservas/:id/estado` con `accion=confirmar`)         | alta      |
| 8.7  | Acción **Confirmar entrega** (`PATCH /api/reservas/:id/estado` con `accion=entregar`)         | alta      |
| 8.8  | Formulario **Reportar incidencia** con tipo + descripción + foto, `POST /api/reservas/:id/incidencias` | alta |
| 8.9  | **Backend:** añadir columnas `reservas.confirmada_por_id`, `reservas.entregada_por_id` (FK a usuarios) y rellenarlas en los `PATCH` correspondientes | alta |
| 8.10 | **Backend:** crear tabla `incidencias (id, reserva_id, operario_id, tipo, descripcion, foto_url, created_at)` con FK a reservas y usuarios | alta |
| 8.11 | **Backend:** endpoint `POST /api/reservas/:id/incidencias` (rol operario o admin) y serialización de incidencias e historial en `GET /api/reservas/:id` | alta |
| 8.12 | Login con biometría (BiometricPrompt) sobre la sesión persistida                              | media     |
| 8.13 | Subida de foto de incidencia: multipart al backend (con `multer`)                             | media     |
| 8.14 | Push notifications al asignar reserva (FCM)                                                  | media     |
| 8.15 | Modo offline: cola local con Room para confirmaciones e incidencias sin red, sync al reconectar | baja    |
| 8.16 | Generación de APK/AAB firmada + canal de distribución interna (Play Console interna)         | baja      |

> Justificación: una app nativa Android específica para el operario reduce la fricción a "abrir → ver lista → tocar confirmar". El registro de **quién** confirma, entrega y reporta incidencia da trazabilidad real, que hoy se pierde con anotaciones en papel.

## Fase 7 — Calidad de código y operaciones ⏳

| # | Tarea                                                              | Prioridad |
|---|--------------------------------------------------------------------|-----------|
| 7.1 | Tests unitarios backend (Jest)                                    | alta      |
| 7.2 | Tests E2E (Playwright) sobre login y reserva                      | alta      |
| 7.3 | ESLint + Prettier                                                 | media     |
| 7.4 | Validación con Zod / Joi en API                                   | media     |
| 7.5 | Migraciones versionadas (Knex / Prisma migrate)                   | media     |
| 7.6 | Logging estructurado (pino) y rotación                            | baja      |
| 7.7 | Monitorización (Uptime Kuma / Better Stack)                       | baja      |

---

## Itinerario sugerido para terminar el TFG (8 semanas)

```
Sem 1  ▶ 4.1 + 4.2 + 4.3 (despliegue + dominio + HTTPS)
Sem 2  ▶ 5.10 (accesibilidad) + 6.1 (carrito)
Sem 3  ▶ 6.3 (escáner QR) + 5.1 (skeletons)
Sem 4  ▶ 6.7 (subida imágenes) + 5.3 (lazy load)
Sem 5  ▶ 7.1 + 7.2 (tests)
Sem 6  ▶ 4.8 (diagramas) + 4.5 (CI/CD)
Sem 7  ▶ 4.6 (memoria) + 4.7 (vídeo)
Sem 8  ▶ Defensa: ensayo + slides
```

> Post-defensa / continuación: Fase 8 (companion móvil del operario) como evolución natural — añade valor de negocio real y demuestra extensión de la arquitectura sin reescritura.
