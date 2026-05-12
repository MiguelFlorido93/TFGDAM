// Configuración de Vitest para los tests de humo del backend.
// Tests serializados (single-threaded) para evitar deadlocks de InnoDB al
// modificar el mismo producto desde múltiples suites en paralelo.
module.exports = {
    test: {
        environment: 'node',
        globals: true,    // describe/it/expect/beforeAll disponibles sin import
        testTimeout: 20_000,
        hookTimeout: 30_000,
        include: ['tests/**/*.test.js'],
        // Una única "thread" / fork — los tests se ejecutan en serie
        pool: 'forks',
        poolOptions: {
            forks: { singleFork: true },
        },
        // Cierra el pool MySQL una sola vez al terminar todo
        globalTeardown: ['./tests/global-teardown.js'],
    },
};
