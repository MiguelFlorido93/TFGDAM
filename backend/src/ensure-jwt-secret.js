// =============================================================
// Genera y persiste un JWT_SECRET fuerte la primera vez.
// Se ejecuta sincrónicamente al arrancar el servidor.
// =============================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PLACEHOLDERS = new Set([
    '',
    'cambia-esto-por-una-cadena-larga-y-aleatoria',
    'dev-secret-change-me',
    'change-me',
    'secret',
]);
const MIN_LEN = 32;

function looksWeak(value) {
    if (!value) return true;
    const v = String(value).trim();
    if (PLACEHOLDERS.has(v)) return true;
    if (v.length < MIN_LEN) return true;
    return false;
}

function generarSecreto() {
    return crypto.randomBytes(64).toString('hex'); // 128 chars
}

function actualizarEnv(envPath, key, value) {
    let texto = '';
    try {
        texto = fs.readFileSync(envPath, 'utf8');
    } catch {
        /* sin fichero */
    }

    const linea = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, 'm');

    let nuevo;
    if (re.test(texto)) {
        nuevo = texto.replace(re, linea);
    } else {
        nuevo = texto.length && !texto.endsWith('\n') ? texto + '\n' + linea + '\n' : texto + linea + '\n';
    }
    fs.writeFileSync(envPath, nuevo, 'utf8');
}

module.exports = function ensureJwtSecret() {
    if (!looksWeak(process.env.JWT_SECRET)) return; // ya hay uno bueno

    const secreto = generarSecreto();
    process.env.JWT_SECRET = secreto;

    // Persistir a .env (en la raíz del backend) para que sobreviva al reinicio
    const envPath = path.join(__dirname, '..', '.env');
    try {
        actualizarEnv(envPath, 'JWT_SECRET', secreto);
        console.log('🔑 JWT_SECRET generado y guardado en backend/.env (primera vez).');
    } catch (e) {
        console.warn('⚠ No se pudo persistir JWT_SECRET en .env:', e.message);
        console.warn('  Usando un secreto en memoria (los tokens se invalidarán al reiniciar).');
    }
};
