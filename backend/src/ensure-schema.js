// =============================================================
// Bootstrap del schema en BD remota (Railway/Fly/Render).
// Si la tabla `usuarios` no existe, lee db/schema.sql, filtra los
// statements de nivel "DATABASE" (que no se pueden ejecutar en una
// BD gestionada porque no eres superuser) y aplica el resto.
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

function dividirEnStatements(sqlRaw) {
    // Eliminar líneas de "DROP DATABASE", "CREATE DATABASE", "USE", y SET NAMES
    // (en Railway/Fly no tenemos privilegios para crear BDs y SET NAMES lo gestiona el driver).
    const lineasFiltradas = sqlRaw
        .split(/\r?\n/)
        .filter(linea => {
            const l = linea.trim().toUpperCase();
            return !(
                l.startsWith('DROP DATABASE') ||
                l.startsWith('CREATE DATABASE') ||
                l.startsWith('USE ') ||
                l.startsWith('SET NAMES') ||
                l.startsWith('SET CHARACTER SET')
            );
        })
        .join('\n');

    // Quitar comentarios de línea -- y dividir por ; respetando que algunos INSERT
    // pueden ser muy largos (los hay con 500 filas).
    const sinComentarios = lineasFiltradas
        .split(/\r?\n/)
        .filter(l => !l.trim().startsWith('--'))
        .join('\n');

    return sinComentarios
        .split(/;\s*(?:\r?\n|$)/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

module.exports = async function ensureSchema() {
    try {
        if (await tablaExiste('usuarios')) return false; // ya está
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
    const statements = dividirEnStatements(sql);

    // Conexión dedicada con multipleStatements para ejecutar uno por uno y poder
    // reportar exactamente dónde falla si algo va mal.
    const conn = await mysql.createConnection({
        host: pool.pool.config.connectionConfig.host,
        port: pool.pool.config.connectionConfig.port,
        user: pool.pool.config.connectionConfig.user,
        password: pool.pool.config.connectionConfig.password,
        database: pool.pool.config.connectionConfig.database,
        charset: 'utf8mb4',
        multipleStatements: false,
    });
    try {
        for (let i = 0; i < statements.length; i++) {
            try {
                await conn.query(statements[i]);
            } catch (e) {
                console.error(`❌ Fallo en statement ${i + 1}/${statements.length}:`, e.message);
                console.error(statements[i].slice(0, 200) + (statements[i].length > 200 ? '…' : ''));
                throw e;
            }
        }
        console.log(`✅ Schema aplicado (${statements.length} statements).`);
        return true;
    } finally {
        await conn.end();
    }
};
