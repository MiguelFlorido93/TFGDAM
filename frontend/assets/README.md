# Iconos PWA

Genera `icon-192.png` (192×192) e `icon-512.png` (512×512) a partir de `icon.svg`.
Cualquiera de estas opciones funciona:

**Online (sin instalar nada):**
- https://cloudconvert.com/svg-to-png  → subir `icon.svg` y exportar a 192/512.

**Línea de comandos (con ImageMagick / `magick`):**
```bash
magick -background none -density 600 icon.svg -resize 192x192 icon-192.png
magick -background none -density 600 icon.svg -resize 512x512 icon-512.png
```

**Con `rsvg-convert`:**
```bash
rsvg-convert -w 192 -h 192 icon.svg > icon-192.png
rsvg-convert -w 512 -h 512 icon.svg > icon-512.png
```

Mientras no existan, navegadores que no soporten icono SVG mostrarán un icono por defecto. La PWA funciona igualmente.
