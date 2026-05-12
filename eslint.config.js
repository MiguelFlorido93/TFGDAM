// ESLint flat config (ESLint 9+) — backend Node + frontend navegador.
// Reglas calmadas para no inundar de warnings; foco en errores reales.

const js = require('@eslint/js');
const globals = require('globals');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
    js.configs.recommended,

    // -------- Globales / ignorar --------
    {
        ignores: [
            '**/node_modules/**',
            '**/target/**',
            '**/dist/**',
            '**/build/**',
            'stockly-cli/**',          // Java
            'backend/node_modules/**',
            'docs/**',
            '**/*.min.js',
            'scripts/**'
        ]
    },

    // -------- Backend (Node / CommonJS) --------
    {
        files: ['backend/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: { ...globals.node }
        },
        rules: {
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }],
            'no-console': 'off',
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-prototype-builtins': 'off'
        }
    },

    // -------- Frontend (navegador / global script) --------
    {
        files: ['frontend/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                ...globals.serviceworker   // sw.js usa self, caches, etc.
            }
        },
        rules: {
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }],
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-undef': 'warn'
        }
    },

    // Desactiva todas las reglas de formato (lo hace Prettier)
    prettierConfig
];
