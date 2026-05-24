// =============================================================
// Bootstrap del schema en BD remota (Railway/Fly/Render).
// Si la tabla `usuarios` no existe, lee db/schema.sql, filtra los
// statements de nivel "DATABASE" (que no se pueden ejecutar en una
// BD gestionada porque no eres superuser) y aplica el resto.
//
// El schema.sql original usa `DELIMITER $$` y un `CREATE PROCEDURE`
// para sembrar 500 productos. Esa directiva sólo la entiende el
// cliente mysql CLI (lo usa el flujo local), no el servidor MySQL
// directamente. Aquí extraemos ese bloque y lo sustituimos por un
// seeder en JavaScript con la misma lógica determinista.
// =============================================================
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const pool = require('./db');

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'db', 'schema.sql');

async function tablaExiste(nombre) {
    const [rows] = await pool.query(
        'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
        [nombre]
    );
    return rows[0].n > 0;
}

async function columnaExiste(tabla, columna) {
    const [rows] = await pool.query(
        `SELECT COUNT(*) AS n FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        [tabla, columna]
    );
    return rows[0].n > 0;
}

// Migraciones incrementales — idempotentes, se ejecutan siempre tras el bootstrap.
// Cualquier migración nueva se añade aquí y se ejecuta una vez por instancia.
async function aplicarMigraciones() {
    // M001 — Trazabilidad de operario en reservas (necesario para la app móvil)
    if (await tablaExiste('reservas')) {
        if (!(await columnaExiste('reservas', 'confirmada_por_id'))) {
            await pool.query(
                `ALTER TABLE reservas
                 ADD COLUMN confirmada_por_id INT NULL,
                 ADD INDEX idx_confirmada_por (confirmada_por_id),
                 ADD CONSTRAINT fk_reservas_confirmada_por
                   FOREIGN KEY (confirmada_por_id) REFERENCES usuarios(id) ON DELETE SET NULL`
            );
            console.log('🔧 M001 → reservas.confirmada_por_id añadido');
        }
        if (!(await columnaExiste('reservas', 'entregada_por_id'))) {
            await pool.query(
                `ALTER TABLE reservas
                 ADD COLUMN entregada_por_id INT NULL,
                 ADD INDEX idx_entregada_por (entregada_por_id),
                 ADD CONSTRAINT fk_reservas_entregada_por
                   FOREIGN KEY (entregada_por_id) REFERENCES usuarios(id) ON DELETE SET NULL`
            );
            console.log('🔧 M001 → reservas.entregada_por_id añadido');
        }
    }

    // M002 — Tabla incidencias (alimentada por la app móvil del operario)
    if (!(await tablaExiste('incidencias'))) {
        await pool.query(`
            CREATE TABLE incidencias (
                id            INT AUTO_INCREMENT PRIMARY KEY,
                reserva_id    INT NOT NULL,
                operario_id   INT NULL,
                tipo          ENUM('rotura','faltante','mal_estado','otro') NOT NULL DEFAULT 'otro',
                descripcion   TEXT NOT NULL,
                creado_en     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_reserva (reserva_id),
                INDEX idx_operario (operario_id),
                CONSTRAINT fk_incidencias_reserva FOREIGN KEY (reserva_id) REFERENCES reservas(id) ON DELETE CASCADE,
                CONSTRAINT fk_incidencias_operario FOREIGN KEY (operario_id) REFERENCES usuarios(id) ON DELETE SET NULL
            )`);
        console.log('🔧 M002 → tabla incidencias creada');
    }
}

/**
 * Divide un bloque SQL en statements ejecutables uno por uno.
 * Quita comentarios `--` y separa por `;` al final de línea / EOF.
 */
function dividirEnStatements(sqlRaw) {
    const sinComentarios = sqlRaw
        .split(/\r?\n/)
        .filter(l => !l.trim().startsWith('--'))
        .join('\n');

    return sinComentarios
        .split(/;\s*(?:\r?\n|$)/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

/**
 * Parsea schema.sql y devuelve los statements separados en dos
 * fases (pre / post seeder de productos) más diagnóstico.
 *
 *   { pre, post }
 *
 * El procedure `seed_productos()` se descarta entero; en su lugar
 * el caller invoca seedProductos() entre las dos fases.
 */
function parsearSchema(sqlRaw) {
    // 1) Quitar líneas que requieren privilegios de superuser o que son
    //    directivas del cliente mysql CLI (no son SQL real).
    const lineasFiltradas = sqlRaw
        .split(/\r?\n/)
        .filter(linea => {
            const l = linea.trim().toUpperCase();
            return !(
                l.startsWith('DROP DATABASE') ||
                l.startsWith('CREATE DATABASE') ||
                l.startsWith('USE ') ||
                l.startsWith('SET NAMES') ||
                l.startsWith('SET CHARACTER SET') ||
                l.startsWith('DELIMITER')
            );
        })
        .join('\n');

    // 2) Aislar el bloque CREATE PROCEDURE ... END $$ (entre las dos
    //    directivas DELIMITER, ya eliminadas). Lo que queda es:
    //       DROP PROCEDURE IF EXISTS seed_productos $$
    //       CREATE PROCEDURE seed_productos() BEGIN ... END $$
    //    Detectamos el inicio (DROP PROCEDURE … $$ o CREATE PROCEDURE)
    //    y el final (END $$) y excisionamos el bloque entero.
    const reBloqueProc = /(?:DROP\s+PROCEDURE[^$]*\$\$\s*)?CREATE\s+PROCEDURE[\s\S]*?END\s*\$\$/i;
    const partes = lineasFiltradas.split(reBloqueProc);
    const preRaw = partes[0] || '';
    let postRaw = partes.slice(1).join('') || '';

    // 3) Tras el procedure quedan llamadas que ya no aplican porque
    //    el seeder lo hacemos en JS.
    postRaw = postRaw
        .split(/\r?\n/)
        .filter(l => {
            const u = l.trim().toUpperCase();
            return !(
                u.startsWith('CALL SEED_PRODUCTOS') ||
                u.startsWith('DROP PROCEDURE')
            );
        })
        .join('\n');

    return {
        pre: dividirEnStatements(preRaw),
        post: dividirEnStatements(postRaw),
    };
}

/**
 * Replica el procedure seed_productos() de schema.sql en JS.
 * Inserta 500 productos deterministas (SKU-00001…SKU-00500) con
 * categorías cíclicas, ubicaciones tipo A-01-1…H-20-5, stock y
 * precio calculados con la misma fórmula que el procedure original.
 */
async function seedProductos(conn) {
    const NOMBRES_POR_CAT = {
        1:  'Adaptador electrónico modelo ',
        2:  'Taladro percutor serie ',
        3:  'Caja de tornillos tipo ',
        4:  'Manguera de jardín 25m ref ',
        5:  'Tubería PVC 2m ref ',
        6:  'Cable eléctrico 100m ref ',
        7:  'Paquete folios A4 ref ',
        8:  'Caja cartón mediana ref ',
        9:  'Detergente industrial 5L ref ',
        10: 'Casco de seguridad ref ',
    };

    const filas = [];
    for (let i = 1; i <= 500; i++) {
        const vCat   = ((i - 1) % 10) + 1;
        const vSku   = `SKU-${String(i).padStart(5, '0')}`;
        const letra  = String.fromCharCode(65 + ((i - 1) % 8));
        const vUbic  = `${letra}-${String(((i - 1) % 20) + 1).padStart(2, '0')}-${((i - 1) % 5) + 1}`;
        const vStock = 10 + (i % 90);
        const vPrec  = Math.round((5 + (i % 200) + (i % 100) / 100) * 100) / 100;
        const vNom   = NOMBRES_POR_CAT[vCat] + i;
        const vDesc  = `Producto de prueba #${i} generado automáticamente.`;
        filas.push([vSku, vNom, vDesc, vCat, vUbic, vStock, vPrec]);
    }

    // Insert por lotes para no exceder max_allowed_packet ni saturar el log.
    const LOTE = 100;
    for (let i = 0; i < filas.length; i += LOTE) {
        const trozo = filas.slice(i, i + LOTE);
        const placeholders = trozo.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const valores = trozo.flat();
        await conn.query(
            `INSERT INTO productos
                (sku, nombre, descripcion, categoria_id, ubicacion, stock, precio)
             VALUES ${placeholders}`,
            valores
        );
    }
}

module.exports = async function ensureSchema() {
    // Si las tablas base ya existen, sólo aplicamos migraciones incrementales
    // (idempotentes) y salimos. No re-aplicamos schema.sql.
    try {
        if (await tablaExiste('usuarios')) {
            try {
                await aplicarMigraciones();
            } catch (e) {
                console.warn('Fallo aplicando migraciones incrementales:', e.message);
            }
            return false;
        }
    } catch (e) {
        console.warn('No se pudo comprobar si existe el schema:', e.message);
        return false;
    }

    if (!fs.existsSync(SCHEMA_PATH)) {
        console.warn(`⚠ No se encontró ${SCHEMA_PATH}; salto bootstrap del schema.`);
        return false;
    }

    console.log('🔧 Schema vacío detectado; aplicando db/schema.sql…');
    const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
    const { pre, post } = parsearSchema(sql);

    // Conexión dedicada con multipleStatements=false: ejecutamos uno a uno
    // para reportar exactamente dónde falla si algo va mal. Misma conn
    // para todo el bootstrap para que las @session vars (p.ej. @PWD) sobrevivan.
    const conn = await mysql.createConnection({
        host: pool.pool.config.connectionConfig.host,
        port: pool.pool.config.connectionConfig.port,
        user: pool.pool.config.connectionConfig.user,
        password: pool.pool.config.connectionConfig.password,
        database: pool.pool.config.connectionConfig.database,
        charset: 'utf8mb4',
        multipleStatements: false,
    });

    async function ejecutar(statements, etiqueta) {
        for (let i = 0; i < statements.length; i++) {
            try {
                await conn.query(statements[i]);
            } catch (e) {
                console.error(`❌ Fallo en ${etiqueta} ${i + 1}/${statements.length}:`, e.message);
                console.error(statements[i].slice(0, 200) + (statements[i].length > 200 ? '…' : ''));
                throw e;
            }
        }
    }

    try {
        await ejecutar(pre, 'pre-productos');
        console.log(`   • ${pre.length} statements pre-productos OK`);

        await seedProductos(conn);
        console.log('   • 500 productos sembrados (seeder JS)');

        await ejecutar(post, 'post-productos');
        console.log(`   • ${post.length} statements post-productos OK`);

        // Migraciones incrementales sobre el schema recién creado.
        try {
            await aplicarMigraciones();
        } catch (e) {
            console.warn('Fallo aplicando migraciones tras bootstrap:', e.message);
        }

        console.log('✅ Schema aplicado.');
        return true;
    } finally {
        await conn.end();
    }
};

// Exportar utilidades internas para tests / scripts de verificación.
module.exports.parsearSchema = parsearSchema;
module.exports.seedProductos = seedProductos;
