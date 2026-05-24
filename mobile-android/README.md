# Stockly · App móvil Android (Kotlin + Jetpack Compose)

App nativa para el operario de almacén. Consume la API REST desplegada en
**`https://tfgdam-production.up.railway.app/`**.

## Funcionalidades

1. **Login** con email + contraseña; el JWT se guarda cifrado con `EncryptedSharedPreferences`.
2. **Lista de reservas** filtrable por estado (Activas / Pendientes / Confirmadas).
3. **Detalle de reserva** con producto, ubicación, cliente, trazabilidad (quién confirmó, quién entregó) e incidencias previas.
4. **Acciones contextuales**:
   - Confirmar pedido (estado `pendiente → confirmada`, registra `confirmada_por_id`).
   - Confirmar entrega (`confirmada → entregada`, descuenta stock, registra `entregada_por_id`).
   - Reportar incidencia (tipo + descripción → tabla `incidencias`, registra `operario_id`).

## Cómo abrir el proyecto

1. Instala **Android Studio** Ladybug o superior (incluye JDK 17 y SDK).
2. Abre la carpeta `mobile-android/` desde Android Studio (no abras el repo raíz: este es un proyecto Gradle independiente).
3. Espera al primer sync (descarga dependencias).
4. Conecta un dispositivo o lanza un emulador (API 26+).
5. Run ▶ (Shift+F10).

Usuario de prueba (ya creado por las semillas del backend):

- `laura@tfg.local` / `password123` (operario)
- `adrian@tfg.local` / `password123` (admin)

## Arquitectura

```
mobile-android/
├── build.gradle.kts          # Plugins de proyecto (AGP, Kotlin, Compose, Serialization)
├── settings.gradle.kts
├── gradle.properties
└── app/
    ├── build.gradle.kts      # Dependencias Compose, Retrofit, OkHttp, security-crypto
    └── src/main/
        ├── AndroidManifest.xml
        ├── res/              # Tema, icono adaptativo, recursos
        └── java/com/stockly/app/
            ├── StocklyApp.kt           # Application: contenedor manual de DI
            ├── MainActivity.kt         # setContent { Navigation() }
            ├── data/
            │   ├── ApiClient.kt        # Retrofit + Json + interceptor
            │   ├── StocklyApi.kt       # Endpoints Retrofit
            │   ├── AuthInterceptor.kt  # Authorization: Bearer <token>
            │   ├── TokenStore.kt       # EncryptedSharedPreferences
            │   └── ReservasRepository.kt
            ├── model/Models.kt         # @Serializable POJOs (LoginRequest, ReservaDetalle, Incidencia…)
            └── ui/
                ├── Navigation.kt       # NavHost (login → lista → detalle → incidencia)
                ├── theme/Theme.kt      # Material 3 con paleta industrial Stockly
                ├── login/LoginScreen.kt
                ├── lista/ListaReservasScreen.kt
                ├── detalle/DetalleReservaScreen.kt
                └── incidencia/IncidenciaFormScreen.kt
```

## URL del backend

Hardcodeada por simplicidad en `app/build.gradle.kts` como `buildConfigField`. Para
cambiar de entorno (staging vs producción) en el futuro, añade un *build variant*
con un valor distinto de `API_BASE_URL`.

## Empaquetar APK

```
./gradlew :app:assembleRelease
```

Genera `app/build/outputs/apk/release/app-release-unsigned.apk`. Para firmarla y
distribuirla por Play Console o canal interno, configura `signingConfigs` con tu
keystore.

## Limitaciones conocidas

- No tiene biometría todavía (ROADMAP 8.12).
- No tiene push notifications todavía (ROADMAP 8.14).
- No tiene escáner QR todavía (ROADMAP 8.15 — *renumerado de 8.12*).
- No tiene modo offline (ROADMAP 8.15 — *renumerado*).
- Las incidencias no permiten adjuntar foto todavía (solo tipo + descripción).
