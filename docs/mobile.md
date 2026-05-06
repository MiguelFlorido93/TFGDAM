# 📱 Guía: versión móvil

El frontend ya es **responsive + PWA**, así que móvil ≠ proyecto aparte. Esta guía resume:

1. Cómo se comporta la app en móvil hoy.
2. Cómo instalarla como PWA en Android e iOS.
3. Cómo empaquetarla como **APK Android** real con **Capacitor** (sin reescribir nada).

---

## 1. Comportamiento responsive actual

Punto de quiebre principal: **880 px**.

| Pantalla       | Comportamiento                                                                  |
|----------------|---------------------------------------------------------------------------------|
| > 880 px       | Topbar con tabs centradas, grid de productos auto-fill (mín. 240 px)            |
| 480-880 px     | Bottom navigation, topbar reducida, grid 2 columnas                             |
| < 480 px       | Stat cards 2×, modal con campos en una columna, modales a ancho completo        |

La hoja de estilos usa variables CSS y `safe-area-inset-bottom` para respetar la barra de gestos de iOS.

---

## 2. Instalar como PWA

### Android (Chrome / Edge)
1. Abre `https://tfg.tudominio.com`.
2. Menú ⋮ → **Instalar aplicación** (o aparece automáticamente un banner).
3. La app se añade al cajón con su icono y se abre en pantalla completa, sin barra del navegador.

### iOS (Safari ≥ 16)
1. Abre la URL en Safari.
2. Botón **Compartir** → **Añadir a pantalla de inicio**.
3. iOS no soporta todas las features PWA (push limitado), pero la app se ve como nativa.

### Escritorio
Edge / Chrome / Brave: icono ⊕ en la barra de direcciones → **Instalar Stockly**.

---

## 3. Convertir la PWA en APK / IPA con Capacitor

[Capacitor](https://capacitorjs.com/) envuelve cualquier web app en una WebView nativa. Es lo más rápido para tener una APK que enseñar en la defensa.

### 3.1 Requisitos
- Node 18+
- **Android Studio** instalado (incluye SDK + JDK).
- (iOS) macOS + Xcode si quieres `.ipa`.

### 3.2 Setup del proyecto Capacitor
Desde la raíz del repo:
```bash
mkdir mobile && cd mobile
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Stockly" "app.stockly" --web-dir ../frontend
```
Edita `mobile/capacitor.config.json`:
```json
{
  "appId": "app.stockly",
  "appName": "Stockly",
  "webDir": "../frontend",
  "server": {
    "url": "https://tfg.tudominio.com",
    "cleartext": false
  }
}
```
> Con `server.url` apuntando al dominio real, la APK funciona como un navegador kiosko siempre actualizado. Sin esa clave, empaqueta los archivos estáticos y se queda fija a esa versión.

### 3.3 Generar la APK
```bash
npx cap add android
npx cap sync android
npx cap open android        # se abre Android Studio
```
En Android Studio:
1. **Build → Generate Signed Bundle / APK** → APK.
2. Crea un keystore nuevo y guarda la contraseña en el gestor de contraseñas.
3. La APK queda en `mobile/android/app/release/app-release.apk` — instalable en cualquier Android.

### 3.4 iOS (opcional)
```bash
npm i @capacitor/ios
npx cap add ios
npx cap open ios            # abre Xcode
# Product → Archive → Distribute → Development
```

---

## 4. Mejoras móvil-first pendientes (ver ROADMAP §5-6)

| # | Mejora                                                                  | Beneficio móvil |
|---|-------------------------------------------------------------------------|-----------------|
| 1 | **Lector de códigos QR/barras** con `BarcodeDetector` o `@capacitor/barcode-scanner` | Buscar producto por SKU físico |
| 2 | **Push notifications** con OneSignal o Firebase                         | Avisar al cliente cuando su reserva pase a "Confirmada" |
| 3 | **Pull-to-refresh** en la lista de productos y reservas                 | Patrón nativo móvil |
| 4 | **Modo offline real** (no sólo shell) cacheando últimos productos vistos | Trabajadores en zonas con poca señal |
| 5 | **Compartir** una reserva (Web Share API) → manda el detalle por WhatsApp | Fácil coordinación |
| 6 | **Geolocalización** del trabajador para asignar reservas al más cercano | Almacenes grandes |

Cada item se puede convertir en una historia de usuario para Sprints 6-8.

---

## 5. Mini checklist para la defensa con móvil

- [ ] Móvil con la PWA instalada y datos demo cargados.
- [ ] APK generada y compartida por AirDrop / cable USB en otro dispositivo.
- [ ] Wifi del centro testeado para que la API responda durante la defensa.
- [ ] Modo avión activado para mostrar que la PWA al menos abre la shell offline.
- [ ] Capturas en `docs/diagramas/mobile/` para incluir en la memoria.
