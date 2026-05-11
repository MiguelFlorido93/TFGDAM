# Stockly CLI

Cliente de consola en Java 17 que consume la API REST de Stockly. Cubre dos casos de uso:

1. **Cliente CLI general** — login, listado de productos, alertas de stock bajo, creación de reservas.
2. **Importador masivo** — carga productos desde un CSV vía `POST /api/productos`, con validación previa (modo dry-run por defecto).

Diseñado para administradores que quieran trabajar contra Stockly desde la terminal o desde tareas programadas (`cron` / Task Scheduler).

## Requisitos

- **JDK 17+** (`java -version`)
- **Maven 3.8+** (`mvn -version`)
- El backend Stockly accesible en `http://localhost:3001` (por defecto, configurable).

## Compilación

```bash
cd stockly-cli
mvn package
```

Genera `target/stockly.jar` (fat-jar autocontenido).

## Uso

Wrapper opcional:

```bash
alias stockly='java -jar target/stockly.jar'
```

### `login` — autenticarse

```bash
stockly login --email adrian@tfg.local --password password123
# o interactivo (no muestra la contraseña):
stockly login --email adrian@tfg.local
```

Guarda el token JWT y la URL base en `~/.stockly/config.properties`.

### `config` — ver/modificar configuración

```bash
stockly config
stockly config --set-url http://192.168.1.42:3001
stockly config --logout
```

### `productos` — listar catálogo

```bash
stockly productos
stockly productos --search taladro --page 1 --limit 20
```

### `stock-bajo` — alertas de stock

```bash
stockly stock-bajo
```

Exit codes: `0` si no hay alertas, `3` si hay productos bajo mínimo (útil para `cron`).

### `reservar` — crear reserva por SKU

```bash
stockly reservar --sku SKU-00001 --cantidad 2 --notas "Pedido cliente 4521"
```

### `import` — importación masiva de productos desde CSV

```bash
# Vista previa (dry-run, NO envía nada):
stockly import sample-productos.csv

# Aplicar realmente:
stockly import sample-productos.csv --apply
```

Cabecera esperada (separador coma, codificación UTF-8):

```
sku,nombre,descripcion,categoria,ubicacion,stock,stock_minimo,precio
```

- `sku` vacío → el servidor sugiere uno (`SKU-NNNNN`).
- `categoria` es el **nombre** de la categoría (se resuelve a id contra `/api/categorias`). Si no existe, la fila se marca como error.
- Los campos numéricos vacíos toman defaults (`0` para precio/stock, `5` para stock_minimo).
- En `--apply`, cada fila válida se envía como `POST /api/productos` individual con el token guardado.

Ver `sample-productos.csv` para un ejemplo.

## Estructura del proyecto

```
stockly-cli/
├── pom.xml
├── sample-productos.csv
└── src/main/java/com/stockly/cli/
    ├── Main.java                # dispatcher
    ├── api/
    │   ├── StocklyClient.java   # wrapper HTTP (java.net.http + Jackson)
    │   └── ApiException.java
    ├── config/
    │   └── Config.java          # persistencia en ~/.stockly/config.properties
    └── commands/
        ├── Command.java         # interfaz
        ├── Args.java            # parser de --flag value
        ├── LoginCommand.java
        ├── ConfigCommand.java
        ├── ProductsCommand.java
        ├── LowStockCommand.java
        ├── ReserveCommand.java
        └── ImportCommand.java
```

## Tecnologías

- **Java 17** (`java.net.http.HttpClient`, `Records`-friendly aunque no se usen, switch nuevo)
- **Jackson 2.17** — serialización/deserialización JSON
- **OpenCSV 5.9** — parser CSV robusto
- **Maven Shade Plugin** — fat-jar ejecutable

## Variables de entorno

- `STOCKLY_DEBUG=1` — imprime stacktrace completo al fallar (útil para depurar problemas de red o JSON malformado).

## Ejemplo de tarea programada (Windows Task Scheduler)

Cada mañana a las 8:00, generar alerta de stock bajo:

```
java -jar C:\ruta\a\stockly.jar stock-bajo
```

Si el exit code es 3, lanzar un correo (PowerShell):

```powershell
$out = java -jar stockly.jar stock-bajo
if ($LASTEXITCODE -eq 3) {
    Send-MailMessage -To "admin@empresa.com" -Subject "Stockly: stock bajo" -Body $out -From "stockly@empresa.com" -SmtpServer "smtp.empresa.com"
}
```
