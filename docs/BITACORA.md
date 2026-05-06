# 📓 Cuaderno de bitácora — TFG DAM "Stockly"

> Trabajo Fin de Grado · Ciclo Formativo de Grado Superior — DAM
> Autores: **Adrián Bravo Santos** y **Miguel Ángel Florido**
> Tutor/a: _por completar_
> Curso académico: 2025-2026

Este documento registra el día a día del proyecto: decisiones, problemas encontrados, soluciones aplicadas, reparto de trabajo y reflexión técnica. Se actualiza al menos una vez por semana.

---

## 0. Datos del proyecto

| Campo               | Valor                                                            |
|---------------------|------------------------------------------------------------------|
| Título              | Stockly — Gestión inteligente de almacén y reservas              |
| Tipo                | Aplicación web multiplataforma (PWA, escritorio + móvil)         |
| Stack               | Node.js + Express · MariaDB · HTML/CSS/JS (PWA)                  |
| Repositorio         | _añadir URL del repo_                                            |
| Entorno desarrollo  | Windows 11 + VS Code · Node 18 LTS · MariaDB 10.11               |
| Metodología         | Iterativa por sprints semanales con tablero Trello/GitHub Projects |

### Reparto general de roles

| Área                                    | Responsable principal | Apoyo  |
|-----------------------------------------|-----------------------|--------|
| Modelado de datos y base de datos       | Miguel Á. Florido      | A. Bravo |
| API REST (rutas, autenticación, lógica) | A. Bravo Santos        | Miguel Á. |
| Frontend (UI/UX, vistas, PWA)           | A. Bravo Santos        | Miguel Á. |
| Panel admin / dashboard / reporting     | Miguel Á. Florido      | A. Bravo |
| Despliegue, dominio, hosting            | A. Bravo Santos        | Miguel Á. |
| Documentación + memoria                 | Miguel Á. Florido      | A. Bravo |

> El reparto es orientativo: ambos hacen revisión cruzada de Pull Requests.

---

## 1. Decisiones técnicas clave

| Fecha       | Decisión                                                       | Motivo                                                                 |
|-------------|----------------------------------------------------------------|------------------------------------------------------------------------|
| 2026-01-12  | Stack Node + Express + MariaDB + vainilla JS                    | Cubre todas las competencias del módulo de Acceso a Datos y Programación Multimedia sin dependencias frágiles |
| 2026-01-15  | PWA en lugar de app nativa para la versión móvil               | Mismo código sirve a escritorio y móvil; se puede empaquetar con Capacitor si se requiere APK |
| 2026-01-22  | JWT + bcrypt para autenticación                                | Estándar industrial, libre de sesiones de servidor, fácil de explicar en defensa |
| 2026-02-03  | Reservas con `SELECT ... FOR UPDATE`                           | Garantiza que dos usuarios no reserven el último ítem a la vez         |
| 2026-02-12  | Tabla `movimientos` para auditoría                             | Demuestra trazabilidad real, requisito importante en almacenes         |
| 2026-03-01  | Modo oscuro y bottom navigation                                | Ergonomía móvil + accesibilidad                                        |
| 2026-03-18  | Dashboard con gráficos en CSS puro                             | Evita dependencia pesada de Chart.js para una visualización sencilla   |

---

## 2. Sprints / iteraciones

### Sprint 0 — Análisis y arranque (2026-01-08 → 2026-01-19)
- ✅ Definición del problema: gestión de reservas en almacén con concurrencia.
- ✅ Identificación de casos de uso por rol.
- ✅ Diagrama E/R inicial (usuarios, categorías, productos, reservas).
- ✅ Repositorio Git creado, README inicial.
- ✅ Esquema SQL con 500 productos semilla.
- **Aprendizajes**: importancia de definir la cardinalidad antes de tocar código.

### Sprint 1 — Prototipo funcional (2026-01-20 → 2026-02-02)
- ✅ API REST básica (productos, reservas) sin auth.
- ✅ Frontend HTML/JS con grid de productos y modal de reserva.
- ✅ Reservas con bloqueo transaccional (problema corregido tras detectar carrera en pruebas).
- 🐛 Bug: el contador `stock_reservado` quedaba descuadrado al cancelar reservas concurrentes → resuelto envolviendo en transacción.
- **Aprendizaje**: cualquier cambio que afecte a stock debe ir dentro de una transacción.

### Sprint 2 — Autenticación y roles (2026-02-03 → 2026-02-16)
- ✅ Login + registro + JWT.
- ✅ Middleware `authRequired` y `requireRole`.
- ✅ Rate-limit en `/api/auth`.
- ✅ Roles cliente / operario / admin.
- ⚠️ Decisión: la BD guarda únicamente el hash; las contraseñas semilla se generan en el primer arranque del backend.

### Sprint 3 — Panel admin y dashboard (2026-02-17 → 2026-03-09)
- ✅ Endpoint `/api/admin/stats`.
- ✅ KPIs, gráficos en CSS y top productos.
- ✅ Tabla de movimientos con auditoría.
- ✅ Export CSV de reservas.
- **Aprendizaje**: agregar columnas `creado_en`, `actualizado_en`, `activo` desde el principio nos hubiera ahorrado migraciones.

### Sprint 4 — UI/UX y PWA (2026-03-10 → 2026-03-30)
- ✅ Sistema de diseño con tokens (modo claro y oscuro).
- ✅ Bottom navigation y diseño responsive.
- ✅ Manifest + service worker.
- ✅ Iconos generados desde un único SVG.

### Sprint 5 — Despliegue y documentación (2026-04-01 → 2026-04-20)
- ⏳ Despliegue en VPS / Render con dominio propio.
- ⏳ Memoria + bitácora consolidada.
- ⏳ Vídeo demo de 3 minutos.
- ⏳ Defensa.

---

## 3. Incidencias notables

| Fecha       | Incidencia                                              | Solución                                                  |
|-------------|---------------------------------------------------------|-----------------------------------------------------------|
| 2026-01-29  | El frontend no leía la API en otro puerto              | Configuración explícita de CORS + URL absoluta cuando el origin no es 3001 |
| 2026-02-08  | Conflictos al cancelar reservas en paralelo            | Bloqueo `FOR UPDATE` y comprobación de estado previo      |
| 2026-02-22  | Token JWT no se enviaba en peticiones `fetch`          | Helper `api()` centralizado que añade el header           |
| 2026-03-05  | Reload del Service Worker no aplicaba CSS nuevo        | Versionado de `CACHE` y `clients.claim()` en `activate`   |
| 2026-03-12  | Móvil: el toast quedaba debajo de la bottom-nav        | `bottom: calc(80px + safe-area-inset-bottom)`             |

---

## 4. Reparto semanal (ejemplo de plantilla)

> Plantilla a copiar al final del documento cada sprint.

```
### Semana del DD/MM al DD/MM
- Adrián Bravo Santos: _qué hizo_, _bloqueos_, _siguientes pasos_.
- Miguel Ángel Florido: _qué hizo_, _bloqueos_, _siguientes pasos_.
- Hitos cerrados: _PR #x, ticket #y_.
- Pendiente: _items para próxima semana_.
- Notas / aprendizajes: _qué nos llevamos como equipo_.
```

---

## 5. Reflexión técnica final (a completar al cierre)

- _Qué cambiaríamos del modelo de datos en una v2._
- _Qué partes del código nos sentimos orgullosos de cómo quedaron._
- _Qué dependencia o framework hubiera ahorrado tiempo._
- _Qué métricas reales obtuvimos en producción (tamaño bundle, tiempos de respuesta)._

---

## 6. Material entregable (checklist final)

- [ ] Repositorio público con commits limpios.
- [ ] README + bitácora + roadmap.
- [ ] BD versionada en `db/schema.sql`.
- [ ] URL del despliegue accesible.
- [ ] Vídeo demo (≤ 3 min) subido a YouTube/no listado.
- [ ] Memoria PDF (~30-50 páginas).
- [ ] Presentación de defensa (≤ 15 slides).
- [ ] Diagramas (E/R, casos de uso, despliegue) en `docs/diagramas/`.
