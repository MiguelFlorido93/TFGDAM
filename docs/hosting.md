# Despliegue en Railway — Stockly

Guía paso a paso para desplegar **Stockly** en [Railway](https://railway.com) usando el subdominio gratuito `*.up.railway.app`. El plan gratuito de Railway viene con $5 de crédito/mes (suficiente para un proyecto TFG de uso esporádico) y MySQL gestionado incluido como plugin.

> **Lo que ya está preparado en el repo** (no tienes que tocar nada):
> - `nixpacks.toml` + `railway.json` con el comando de build (`cd backend && npm ci`) y de arranque (`node server.js`).
> - `backend/src/db.js` lee `MYSQL_URL` si está presente (lo provee el plugin MySQL de Railway).
> - `backend/src/ensure-schema.js` aplica `db/schema.sql` automáticamente la primera vez si la tabla `usuarios` no existe.
> - `backend/server.js` tiene `trust proxy`, escucha en `0.0.0.0:${PORT}` y `helmet` ya configurado.
> - `ensure-jwt-secret.js` falla con mensaje claro si `JWT_SECRET` no está definido en producción (mejor que generar uno que se invalida en cada deploy).
> - El frontend habla con `/api` (mismo origen), así que **no hay que cambiar URLs**.

---

## 1. Crear cuenta y proyecto

1. Entra en <https://railway.com> y crea cuenta con GitHub.
2. Pulsa **New Project → Deploy from GitHub repo**.
3. Autoriza Railway a leer tu repositorio `TFGDAM` y selecciónalo.
4. Railway detecta `nixpacks.toml` y empieza el primer build (fallará porque aún falta MySQL — normal).

## 2. Añadir MySQL gestionado

1. Dentro del proyecto, **+ New → Database → Add MySQL**.
2. Railway lanza una instancia. Te aparece como un servicio adicional en el mismo proyecto.

## 3. Conectar backend ↔ MySQL

1. Abre el servicio del backend (el que viene del repo).
2. Pestaña **Variables → New Variable Reference → MySQL → MYSQL_URL**.
   - Esto crea una variable `MYSQL_URL` que apunta dinámicamente al MySQL del paso 2 (formato `mysql://user:pass@host:port/db`).
3. Añade el resto de variables:

| Variable          | Valor                                                                 |
|-------------------|-----------------------------------------------------------------------|
| `NODE_ENV`        | `production`                                                          |
| `JWT_SECRET`      | Genera uno: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN`  | `8h` (o lo que prefieras)                                              |
| `CORS_ORIGIN`     | Déjalo vacío de momento (lo rellenas tras saber tu dominio en el paso 4) |

> **Importante:** no compartas el `JWT_SECRET` ni lo subas al repo. Si lo cambias, todas las sesiones activas se invalidan.

## 4. Generar el dominio público

1. En el backend, pestaña **Settings → Networking → Generate Domain**.
2. Railway crea algo como `stockly-production-abc123.up.railway.app`.
3. Copia esa URL.
4. Vuelve a **Variables** y rellena `CORS_ORIGIN` con esa URL (con `https://` por delante). Esto restringe quién puede llamar a la API desde otro origen.

## 5. Primer arranque

1. Railway re-despliega automáticamente al cambiar variables.
2. Mira los **Logs**. Deberías ver:
   ```
   🚀 Stockly API escuchando en :PORT
   🔧 Schema vacío detectado; aplicando db/schema.sql…
   ✅ Schema aplicado (N statements).
   🔐 N usuarios semilla con password "password123"
   ```
3. Abre `https://<tu-dominio>.up.railway.app/api/health` → debe responder `{"ok":true,"db":true,"ts":"…"}`.
4. Abre `https://<tu-dominio>.up.railway.app/` → carga el frontend.
5. Login con `adrian@tfg.local` / `password123` (admin).

## 6. Cambiar las contraseñas demo (importante)

Los usuarios semilla tienen `password123`. **Cambia las contraseñas en producción** desde la UI (perfil → cambiar contraseña) en cuanto puedas, o borra los usuarios demo y crea los reales.

## 7. Despliegues posteriores

Cada `git push` a `main` dispara un nuevo deploy en Railway. La BD persiste entre deploys (es el servicio MySQL aparte). El schema solo se aplica si las tablas no existen, así que **redeploys no pierden datos**.

---

## Coste estimado

- Plan gratuito de Railway: **$5 de crédito/mes** (no caduca durante el primer mes).
- Backend mínimo (~256 MB RAM, sleep cuando no hay tráfico) + MySQL pequeño ≈ **$3-4/mes** de consumo real para un TFG con uso esporádico.
- Conclusión: gratis durante la defensa, ~$5/mes si lo mantienes activo después.

## Si quieres dominio propio (opcional)

1. Compra dominio (ej. Namecheap, Cloudflare Registrar — ~7-12 €/año).
2. En Railway → **Settings → Networking → Custom Domain → Add Domain**.
3. Railway te da un `CNAME` que añades en el panel DNS de tu registrador.
4. Espera 5-30 min a que propague. Railway genera el TLS automáticamente.
5. Actualiza `CORS_ORIGIN` con el nuevo dominio.

---

## Resolución de problemas

| Síntoma                                            | Causa probable                                            | Solución                                              |
|----------------------------------------------------|------------------------------------------------------------|--------------------------------------------------------|
| Log `❌ JWT_SECRET ausente o débil en producción.`  | Falta la variable `JWT_SECRET` o tiene < 32 caracteres.   | Define una con `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`. |
| Health endpoint devuelve `db: false`                | `MYSQL_URL` mal referenciada                              | En Variables, asegúrate de que `MYSQL_URL` es una **referencia** al servicio MySQL, no texto literal. |
| Frontend carga pero el login falla con CORS error  | `CORS_ORIGIN` no incluye tu dominio                       | Ajusta `CORS_ORIGIN` y redeploy.                       |
| Tras un push se pierden los datos                   | Borraste el servicio MySQL                                | Restaura desde backup (Railway hace snapshots diarios en el plan Pro). |
| `Cannot find module` en deploy                       | Falta una dependencia en `backend/package.json`           | Añádela y push.                                        |
| Crash con `EACCES: write .env`                       | El código intentó escribir `.env` en runtime (no debería ocurrir tras el cambio) | Verifica que tienes la última versión del repo.        |

---

## Limpieza local opcional

Si ya no necesitas ejecutar el backend en local porque siempre usas el de Railway, puedes parar MySQL local con `stop.bat`. El frontend desplegado seguirá funcionando solo.
