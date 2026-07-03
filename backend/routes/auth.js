// ============================================================
// CHASKI AI 2.0 — Autenticación (Phase 5 — Secure)
// ============================================================
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const router   = express.Router();
const pool     = require('../config/db');
const { auth }                  = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');
const { validate }              = require('../middleware/validate');
const { log: auditLog }         = require('../middleware/audit');
const { csrfMiddleware }        = require('../middleware/csrf');

const JWT_SECRET           = process.env.JWT_SECRET || 'chaski_secret';
// '24h' mantiene compatibilidad con el frontend actual.
// Activar short tokens configurando JWT_EXPIRES_IN=15m en .env
// una vez que el frontend implemente auto-refresh.
const JWT_EXPIRES          = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_EXPIRES_DAYS = 7;
const LOCKOUT_WINDOW_MS    = 15 * 60 * 1000;
const LOCKOUT_MAX_FAILS    = 5;

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function isLocked(username, ip) {
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MS);
  const r = await pool.query(
    `SELECT COUNT(*) FROM login_attempts
     WHERE (username = $1 OR ip_address = $2) AND success = false AND attempted_at > $3`,
    [username, ip, since]
  );
  return parseInt(r.rows[0].count) >= LOCKOUT_MAX_FAILS;
}

async function recordAttempt(username, ip, success) {
  await pool.query(
    `INSERT INTO login_attempts (username, ip_address, success) VALUES ($1, $2, $3)`,
    [username, ip, success]
  );
}

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', loginLimiter, validate('login'), async (req, res, next) => {
  const { username, password } = req.body;
  const ip = req.ip;

  try {
    if (await isLocked(username, ip)) {
      return res.status(429).json({
        error: 'Cuenta bloqueada por múltiples intentos fallidos. Espere 15 minutos.'
      });
    }

    const result = await pool.query(
      `SELECT u.id, u.username, u.password_hash, u.role,
              a.name AS association_name
       FROM users u
       LEFT JOIN associations a ON a.id = u.association_id
       WHERE u.username = $1 AND u.active = true`,
      [username]
    );

    if (!result.rows.length) {
      await recordAttempt(username, ip, false);
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const user  = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await recordAttempt(username, ip, false);
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    await recordAttempt(username, ip, true);
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const csrfToken   = generateToken();
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role, csrfToken },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    const rawRefresh  = generateToken();
    const hashRefresh = hashToken(rawRefresh);
    const expiresAt   = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    const rtRow = await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [user.id, hashRefresh, expiresAt, ip, req.headers['user-agent'] || null]
    );

    await pool.query(
      `INSERT INTO session_history (user_id, refresh_token_id, action, ip_address, user_agent)
       VALUES ($1, $2, 'login', $3, $4)`,
      [user.id, rtRow.rows[0].id, ip, req.headers['user-agent'] || null]
    );

    auditLog({ req, action: 'auth.login', entityType: 'user', entityId: user.id }).catch(() => {});

    res.json({
      token:        accessToken,
      refreshToken: rawRefresh,
      csrfToken,
      user: {
        id:          user.id,
        username:    user.username,
        role:        user.role,
        name:        user.username,
        association: user.association_name,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token requerido.' });

  try {
    const hash = hashToken(refreshToken);
    const r    = await pool.query(
      `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked,
              u.username, u.role, u.active
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1`,
      [hash]
    );

    if (!r.rows.length)               return res.status(401).json({ error: 'Refresh token inválido.' });
    const rt = r.rows[0];
    if (rt.revoked)                   return res.status(401).json({ error: 'Refresh token revocado.' });
    if (!rt.active)                   return res.status(401).json({ error: 'Cuenta inactiva.' });
    if (new Date(rt.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Refresh token expirado.' });
    }

    // Revoke old — token rotation
    await pool.query(
      `UPDATE refresh_tokens SET revoked = true, revoked_at = NOW() WHERE id = $1`,
      [rt.id]
    );

    const csrfToken   = generateToken();
    const accessToken = jwt.sign(
      { id: rt.user_id, username: rt.username, role: rt.role, csrfToken },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    const rawRefresh  = generateToken();
    const hashRefresh = hashToken(rawRefresh);
    const expiresAt   = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    const newRt = await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [rt.user_id, hashRefresh, expiresAt, req.ip, req.headers['user-agent'] || null]
    );

    await pool.query(
      `INSERT INTO session_history (user_id, refresh_token_id, action, ip_address, user_agent)
       VALUES ($1, $2, 'token_refresh', $3, $4)`,
      [rt.user_id, newRt.rows[0].id, req.ip, req.headers['user-agent'] || null]
    );

    res.json({ token: accessToken, refreshToken: rawRefresh, csrfToken });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────
router.post('/logout', auth, csrfMiddleware, async (req, res, next) => {
  const { refreshToken } = req.body;
  try {
    if (refreshToken) {
      const hash = hashToken(refreshToken);
      await pool.query(
        `UPDATE refresh_tokens SET revoked = true, revoked_at = NOW()
         WHERE token_hash = $1 AND user_id = $2`,
        [hash, req.user.id]
      );
    }

    await pool.query(
      `INSERT INTO session_history (user_id, action, ip_address, user_agent)
       VALUES ($1, 'logout', $2, $3)`,
      [req.user.id, req.ip, req.headers['user-agent'] || null]
    );

    auditLog({ req, action: 'auth.logout' }).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/change-password ───────────────────────────
router.post('/change-password', auth, csrfMiddleware, validate('changePassword'), async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const r = await pool.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const valid = await bcrypt.compare(currentPassword, r.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Contraseña actual incorrecta.' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hashed, req.user.id]);

    await pool.query(
      `UPDATE refresh_tokens SET revoked = true, revoked_at = NOW()
       WHERE user_id = $1 AND revoked = false`,
      [req.user.id]
    );

    await pool.query(
      `INSERT INTO session_history (user_id, action, ip_address, user_agent)
       VALUES ($1, 'password_change', $2, $3)`,
      [req.user.id, req.ip, req.headers['user-agent'] || null]
    );

    auditLog({ req, action: 'auth.change_password', entityType: 'user', entityId: req.user.id }).catch(() => {});
    res.json({ ok: true, message: 'Contraseña actualizada correctamente.' });
  } catch (err) {
    next(err);
  }
});

// Reset de contraseña eliminado: sistema cerrado — el admin usa PUT /api/drivers/:id/password

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', auth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ── GET /api/auth/sessions ────────────────────────────────────
router.get('/sessions', auth, async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT action, ip_address, user_agent, created_at
       FROM session_history
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json({ sessions: r.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
