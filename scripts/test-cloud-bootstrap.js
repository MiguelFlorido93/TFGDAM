#!/usr/bin/env node
/**
 * Simula el flujo de arranque en cloud (Railway/Fly/Render):
 *   1. Crea una BD vacía nueva (`stockly_cloudtest` por defecto).
 *   2. Apunta el backend a esa BD vía MYSQL_URL.
 *   3. Ejecuta ensureSchema() — el mismo código que correrá en Railway.
 *   4. Verifica que los conteos coincidan con lo esperado.
 *
 * Uso típico (Windows, MySQL local sin password):
 *
 *   node scripts\test-cloud-bootstrap.js
 *
 * Personalización por env vars:
 *
 *   MYSQL_ADMIN_URL=mysql://root@127.0.0.1:3306
 *   MYSQL_TEST_DB=stockly_cloudtest
 *
 * Flags:
 *
 *   --drop   Borra la BD de prueba al terminar.
 *            (Por defecto se conserva para inspección manual.)
 */

const path = require('path');
const BACKEND = path.join(__dirname, '..', 'backend');

// El cliente mysql2 vive en backend/node_modules para no duplicarlo.
const mysql = require(path.join(BACKEND, 'node_modules', 'mysql2', 'promise'));

const ADMIN_URL   = process.env.MYSQL_ADMIN_URL || 'mysql://root@127.0.0.1:3306';
const TEST_DB     = process.env.MYSQL_TEST_DB   || 'stockly_cloudtest';
const DROP_AT_END = process.argv.includes('--drop');

function urlToConfig(u) {
    const url = new URL(u);
    return {
        host: url.hostname,
        port: url.port ? Number(url.port) : 3306,
        user: decodeURIComponent(url.username || 'root'),
        password: decodeURIComponent(url.password || ''),
    };
}

async function main() {
    const adminCfg = urlToConfig(ADMIN_URL);
    console.log(`\n🔌 Admin → ${adminCfg.user}@${adminCfg.host}:${adminCfg.port}`);

    // (1) Recrear BD limpia
    const admin = await mysql.createConnection(adminCfg);
    try {
        console.log(`🧹 Recreando BD limpia '${TEST_DB}'`);
        await admin.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
        await admin.query(`CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    } finally {
        await admin.end();
    }

    // (2) Apuntar el backend a la nueva BD ANTES de requerir nada del backend
    //     (db.js construye el pool al cargarse, lee env vars en ese momento).
    const pwdParte = adminCfg.password ? `:${encodeURIComponent(adminCfg.password)}` : '';
    process.env.MYSQL_URL = `mysql://${adminCfg.user}${pwdParte}@${adminCfg.host}:${adminCfg.port}/${TEST_DB}`;
    process.env.NODE_ENV = 'production';
    // ensure-jwt-secret hace fail-fast en producción si no hay JWT_SECRET válido;
    // como este script no arranca el server, basta cualquier valor de >=32 chars.
    process.env.JWT_SECRET = 'a'.repeat(64);

    // (3) Cargar y ejecutar ensureSchema (es el mismo código que correrá en Railway)
    console.log('🚀 Ejecutando ensureSchema()…\n');
    const ensureSchema = require(path.join(BACKEND, 'src', 'ensure-schema'));
    const pool = require(path.join(BACKEND, 'src', 'db'));

    const aplicado = await ensureSchema();
    if (!aplicado) {
        console.error('❌ ensureSchema devolvió false (¿la BD ya tenía usuarios?). Inesperado.');
        await pool.end();
        process.exit(1);
    }

    // (4) Verificar conteos contra los esperados
    const verify = await mysql.createConnection({ ...adminCfg, database: TEST_DB });
    let ok = true;
    try {
        const esperado = {
            usuarios: 5,
            categorias: 10,
            productos: 500,
            reservas: 4,
            movimientos: 0,
        };

        console.log('\n📊 Conteos:');
        for (const tabla of Object.keys(esperado)) {
            const [r] = await verify.query(`SELECT COUNT(*) AS n FROM \`${tabla}\``);
            const real = r[0].n;
            const marca = real === esperado[tabla] ? '✅' : '❌';
            if (real !== esperado[tabla]) ok = false;
            console.log(`   ${marca} ${tabla.padEnd(12)} ${String(real).padStart(4)} (esperado ${esperado[tabla]})`);
        }

        // Verificación bonus: las reservas semilla apuntan a productos 5/42/88 con stock_reservado correcto.
        const [reservas] = await verify.query('SELECT id, producto_id, cantidad, estado FROM reservas ORDER BY id');
        console.log('\n📝 Reservas semilla:');
        for (const r of reservas) {
            console.log(`   #${r.id} → producto ${r.producto_id} × ${r.cantidad} (${r.estado})`);
        }

        const [stockResv] = await verify.query(
            'SELECT id, sku, stock_reservado FROM productos WHERE id IN (5, 42, 88) ORDER BY id'
        );
        console.log('\n🔒 stock_reservado en productos 5/42/88:');
        for (const p of stockResv) {
            const marca = p.stock_reservado > 0 ? '✅' : '❌';
            if (!p.stock_reservado) ok = false;
            console.log(`   ${marca} #${p.id} ${p.sku} → ${p.stock_reservado}`);
        }
    } finally {
        await verify.end();
    }

    await pool.end();

    if (DROP_AT_END) {
        const admin2 = await mysql.createConnection(adminCfg);
        try {
            await admin2.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
            console.log(`\n🧹 BD '${TEST_DB}' eliminada (--drop).`);
        } finally {
            await admin2.end();
        }
    } else {
        console.log(`\n💡 BD '${TEST_DB}' conservada. Para limpiarla:`);
        console.log(`   node scripts\\test-cloud-bootstrap.js --drop`);
    }

    if (!ok) {
        console.error('\n❌ Verificación fallida.');
        process.exit(1);
    }
    console.log('\n✅ Bootstrap cloud verificado correctamente.');
}

main().catch(e => {
    console.error('\n💥 Fallo inesperado:', e);
    process.exit(1);
});
