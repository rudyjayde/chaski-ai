const jwt  = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'chaski_secret';

if (!process.env.JWT_SECRET) {
  console.warn('[auth] WARNING: JWT_SECRET no está definido en .env — usando clave insegura de fallback. Configura JWT_SECRET en producción.');
}

async function auth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'Token requerido' });

  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  try {
    const payload = jwt.verify(token, JWT_SECRET);

    // Verificar que el usuario existe y sigue activo en BD
    const result = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND active = true',
      [payload.id]
    );
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Usuario desactivado' });
    }

    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    }
    res.status(401).json({ error: 'Token inválido' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
  next();
}

module.exports = { auth, adminOnly };
