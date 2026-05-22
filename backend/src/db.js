// =============================================================
// Pool MySQL — soporta dos modos de configuración:
// 1) MYSQL_URL  → URL completa estilo mysql://user:pass@host:port/db
//    (lo que provee el plugin MySQL de Railway/Fly/Render automáticamente).
// 2) Variables sueltas DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
//    (lo que se usa en desarrollo local con start.bat).
// =============================================================
const mysql = require('mysql2/promise');

function buildConfig() {
    const url = process.env.MYSQL_URL || process.env.DATABASE_URL;
    if (url) {
        const u = new URL(url);
        return {
            host: u.hostname,
            port: u.port ? Number(u.port) : 3306,
            user: decodeURIComponent(u.username || 'root'),
            password: decodeURIComponent(u.password || ''),
            database: (u.pathname || '/').slice(1) || 'stockly',
        };
    }
    return {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'stockly',
    };
}

const pool = mysql.createPool({
    ...buildConfig(),
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
    charset: 'utf8mb4',
});

module.exports = pool;
