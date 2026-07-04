const jwt  = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'chaski_secret';

if (!process.env.JWT_SECRET) {
  console.warn('[auth] WARNING: JWT_SECRET no está definido en .env — usando clave insegura de fallback. Configura JWT_SECRET en producción.');
}

async function auth(req, res, next) {
  // El guard global ya autenticó esta petición; evitar doble query a BD
  if (req.user) return next();

  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'Token requerido' });

  const token = header.startsWith('Bearer ') ? header.slice(7) : header;

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }

  try {
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
    // Error de BD: no enmascarar como "token inválido"
    console.error('[auth] Error consultando BD:', err.message);
    res.status(503).json({ error: 'Servicio no disponible temporalmente' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
  next();
}

module.exports = { auth, adminOnly };
