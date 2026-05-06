const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { signToken, authRequired } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña obligatorios' });

    const [rows] = await pool.query(
        'SELECT id, nombre, email, password_hash, rol, activo FROM usuarios WHERE email = ? LIMIT 1',
        [email]
    );
    const user = rows[0];
    if (!user || !user.activo) return res.status(401).json({ error: 'Credenciales inválidas' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = signToken(user);
    res.json({
        token,
        user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }
    });
});

// POST /api/auth/register  (clientes pueden auto-registrarse)
router.post('/register', async (req, res) => {
    const { nombre, email, password } = req.body || {};
    if (!nombre || !email || !password) return res.status(400).json({ error: 'Faltan campos' });
    if (password.length < 6) return res.status(400).json({ error: 'Contraseña mínima 6 caracteres' });

    try {
        const hash = await bcrypt.hash(password, 10);
        const [r] = await pool.query(
            'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, "cliente")',
            [nombre, email, hash]
        );
        const user = { id: r.insertId, nombre, email, rol: 'cliente' };
        const token = signToken(user);
        res.status(201).json({ token, user });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email ya registrado' });
        res.status(500).json({ error: e.message });
    }
});

// GET /api/auth/me
router.get('/me', authRequired, (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
