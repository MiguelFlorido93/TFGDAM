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
        user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
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

// PATCH /api/auth/me  — actualiza el perfil propio
// Body opcional: { nombre, email, password_actual, password_nuevo }
// - nombre/email se actualizan si vienen no vacíos.
// - Para cambiar contraseña: hay que mandar password_actual + password_nuevo.
router.patch('/me', authRequired, async (req, res) => {
    const userId = req.user.id;
    const { nombre, email, password_actual, password_nuevo } = req.body || {};

    const cambios = [];
    const valores = [];

    if (nombre !== undefined) {
        const n = String(nombre).trim();
        if (!n) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
        cambios.push('nombre = ?');
        valores.push(n);
    }

    if (email !== undefined) {
        const e = String(email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return res.status(400).json({ error: 'Email no válido' });
        cambios.push('email = ?');
        valores.push(e);
    }

    // Cambio de contraseña
    if (password_nuevo !== undefined && password_nuevo !== '') {
        if (!password_actual)
            return res.status(400).json({ error: 'Hay que indicar la contraseña actual para cambiarla' });
        if (String(password_nuevo).length < 6)
            return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });

        const [rows] = await pool.query('SELECT password_hash FROM usuarios WHERE id = ? LIMIT 1', [userId]);
        if (!rows[0]) return res.status(401).json({ error: 'Usuario no encontrado' });
        const ok = await bcrypt.compare(password_actual, rows[0].password_hash);
        if (!ok) return res.status(401).json({ error: 'La contraseña actual no es correcta' });

        const hash = await bcrypt.hash(password_nuevo, 10);
        cambios.push('password_hash = ?');
        valores.push(hash);
    }

    if (!cambios.length) return res.status(400).json({ error: 'No hay cambios que aplicar' });

    try {
        valores.push(userId);
        await pool.query(`UPDATE usuarios SET ${cambios.join(', ')} WHERE id = ?`, valores);

        const [rows] = await pool.query('SELECT id, nombre, email, rol FROM usuarios WHERE id = ? LIMIT 1', [userId]);
        const user = rows[0];

        // Re-emitimos token porque nombre/email viajan dentro del JWT
        const token = signToken(user);
        res.json({ token, user });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ese email ya está en uso' });
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
