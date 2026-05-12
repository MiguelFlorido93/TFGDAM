// Cierra el pool de MySQL UNA SOLA VEZ al finalizar todos los tests.
// Sin esto, cada test file haciendo pool.end() rompe los siguientes.
module.exports = async function teardown() {
    const pool = require('../src/db');
    await pool.end().catch(() => {});
};
