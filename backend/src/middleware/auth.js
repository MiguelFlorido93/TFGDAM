const jwt = require('jsonwebtoken');

// server.js llama a ensure-jwt-secret antes de cargar este módulo, así que a
// estas alturas process.env.JWT_SECRET siempre debe existir y ser fuerte.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET ausente o débil. Revisa backend/.env.');
}
const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

function signToken(user) {
    return jwt.sign(
        { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
        SECRET,
        { expiresIn: EXPIRES_IN }
    );
}

function authRequired(req, res, next) {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token requerido' });
    try {
        req.user = jwt.verify(token, SECRET);
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'No autenticado' });
        if (!roles.includes(req.user.rol)) {
            return res.status(403).json({ error: 'Permisos insuficientes' });
        }
        next();
    };
}

module.exports = { signToken, authRequired, requireRole, SECRET };
