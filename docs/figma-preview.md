# 🎨 Guía: preview / prototipo del proyecto en Figma

Esta guía explica cómo crear un **prototipo navegable en Figma** que represente fielmente el frontend de Stockly (login, productos, reservas, dashboard, inventario, usuarios). El objetivo es poder enseñar el flujo en la defensa sin necesidad de levantar el backend.

> Tiempo estimado: 90 min para un prototipo completo, 25 min para una preview rápida.

---

## 0. Requisitos

- Cuenta gratuita en https://figma.com (sirve la edición Starter).
- Plugin recomendado: **html.to.design** (importa HTML real a Figma).
- Opcional: **Figma Tokens / Variables** para reutilizar la paleta.

---

## 1. Opción A — Importar el HTML actual (la rápida, ~25 min)

Es la forma más fiel: Figma genera frames a partir del HTML servido por el backend.

### 1.1 Levanta el backend localmente
```bash
cd backend
npm install && npm start         # http://localhost:3001
```
Inicia sesión con un admin (`adrian@tfg.local` / `password123`).

### 1.2 Expón el localhost a internet
Figma necesita una URL pública. Usa cualquiera:
- `npx localtunnel --port 3001`
- `cloudflared tunnel --url http://localhost:3001`
- `ngrok http 3001`

Te dará una URL del tipo `https://tfg-xxx.trycloudflare.com`.

### 1.3 Instala el plugin html.to.design
1. Figma → **Plugins** → **Find more plugins** → buscar "html.to.design".
2. Instalar.

### 1.4 Importa cada vista
Abre el plugin y pega la URL pública varias veces, una por vista (cambia el hash o navega manualmente antes de capturar):
1. **Login** → URL pública con sesión cerrada.
2. **Catálogo** → tras login (vista por defecto).
3. **Reservas** → click en la pestaña "Reservas".
4. **Dashboard** → click en "Dashboard" (admin).
5. **Inventario** → click en "Inventario".
6. **Usuarios** → click en "Usuarios".
7. **Móvil** — repite cada vista cambiando el viewport del plugin a `375 × 812` (iPhone 13).

> Cada importación crea un frame independiente con texto, colores y layout copiados.

### 1.5 Convierte en prototipo navegable
1. Selecciona un botón (ej. la pestaña "Reservas") en el frame "Catálogo".
2. Pestaña **Prototype** del panel derecho → arrastra la flecha al frame "Reservas".
3. Trigger: `On click` · Action: `Navigate to` · Animation: `Smart animate`.
4. Repite para todos los enlaces principales (login → catálogo, reservar → modal, etc.).
5. Pulsa **Present** (▶) para probar.

---

## 2. Opción B — Diseño desde cero con tokens (~90 min)

Útil para presentar la **memoria** con mockups limpios sin elementos del navegador.

### 2.1 Crea los estilos / variables
Replica la paleta del CSS:
| Variable        | Light     | Dark      |
|-----------------|-----------|-----------|
| `bg`            | `#f3f5f8` | `#0b1220` |
| `surface`       | `#ffffff` | `#111a2e` |
| `border`        | `#e2e8f0` | `#1f2a44` |
| `text`          | `#0f172a` | `#e2e8f0` |
| `primary`       | `#1e3a8a` | `#60a5fa` |
| `primary-2`     | `#2563eb` | `#3b82f6` |
| `primary-soft`  | `#e0e7ff` | `#1e3a5f` |
| `ok / warn / danger` | `#059669 / #d97706 / #dc2626` | (mismos) |

Tipografía: Inter 14/16/20/24 pt, pesos 400/500/600/700.

### 2.2 Maqueta los frames base
- Desktop 1440 × 900 con cabecera 56 px y main centrado en 1280 px.
- Mobile 375 × 812 con bottom-nav 64 px.

### 2.3 Componentes a crear como _Components_ reutilizables
- `Button / primary | ghost | danger`
- `Card / producto`
- `Stat card`
- `Tab` (estados active / hover)
- `Chip` (filtros + estados)
- `Estado pill` (pendiente/confirmada/cancelada/entregada)
- `Topbar` y `Bottom nav`
- `Modal` (head, body, foot)

> Convertir cada bloque en componente con `Ctrl+Alt+K` permite cambiar el sistema entero al editar el master.

### 2.4 Pantallas a maquetar (8)
1. Login + Registro
2. Catálogo desktop
3. Catálogo móvil
4. Modal "Reservar"
5. Mis reservas (cliente + staff)
6. Dashboard (con gráficos)
7. Inventario (tabla + alta/edición)
8. Usuarios (tabla + alta/edición)

### 2.5 Flujos del prototipo
- Login → Catálogo
- Catálogo → Modal Reservar → Toast de éxito → vuelve al catálogo
- Catálogo ↔ Reservas ↔ Dashboard ↔ Inventario ↔ Usuarios
- En móvil, lo mismo desde la `bottom-nav`

---

## 3. Compartir la preview

1. **Share** (esquina superior derecha) → "Anyone with the link" → **Can view**.
2. Copia el enlace **Present** (no el de edición). Ejemplo:
   ```
   https://www.figma.com/proto/<id>/Almacen-TFG?node-id=…&starting-point-node-id=…
   ```
3. Pega el enlace en la memoria, en la bitácora y en el slide de la defensa.

> Para dejarlo embebido en una web propia, usa **Embed** → copia el `<iframe>`.

---

## 4. Exportar imágenes para la memoria

- Selecciona un frame → panel derecho → **Export** → PNG `2x` o PDF.
- O usa el plugin **Figma to PDF** para exportar todas las pantallas a un único PDF.
- Guárdalas en `docs/diagramas/figma/` para entregar junto a la memoria.

---

## 5. Consejos prácticos

- Mantén los **mismos nombres de capa** que los IDs/clases de la app (`#productos-grid`, `.card`, etc.). Hace que la defensa sea más fluida.
- Usa **Auto Layout** en filas de cards y tablas: redimensiona como una caja flex.
- Activa **Variables → Modes** para ofrecer modo claro y oscuro en el mismo prototipo (botón en la cabecera del prototipo).
- Si un revisor pide retoques visuales, edita en Figma primero — es 5× más rápido que tocar CSS.
