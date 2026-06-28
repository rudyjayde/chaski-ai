// ============================================================
// CHASKI AI 2.0 — Autenticación
// POST /api/auth/login
// GET  /api/auth/me
// ============================================================
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const router   = express.Router();
const pool     = require('../config/db');

const JWT_SECRET  = process.env.JWT_SECRET  || 'chaski_secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '24h';

// ── POST /api/auth/login ─────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.password_hash, u.role,
              a.name AS association_name
       FROM users u
       LEFT JOIN associations a ON a.id = u.association_id
       WHERE u.username = $1 AND u.active = true`,
      [username]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      token,
      user: {
        id:         user.id,
        username:   user.username,
        role:       user.role,
        name:       user.username,
        association: user.association_name,
      },
    });
  } catch (err) {
    console.error('[auth/login]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Sin token' });

  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ ok: true, user: decoded });
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
});

module.exports = router;
