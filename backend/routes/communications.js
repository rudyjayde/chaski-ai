// ============================================================
// CHASKI AI 2.0 — Comunicados y notificaciones
//
// Admin:
//   GET  /api/communications          → lista de comunicados
//   POST /api/communications          → crea comunicado + fan-out a conductores activos
//   DELETE /api/communications/:id    → elimina comunicado
//
// Conductor (requiere JWT):
//   GET /api/notifications            → mis notificaciones
//   PUT /api/notifications/:id/read   → marcar una como leída
//   PUT /api/notifications/read-all   → marcar todas como leídas
// ============================================================
const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const pool    = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'chaski_secret';

function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Sin token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// ── GET /api/communications ──────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.title, c.body, c.type, c.created_at, c.active,
             u.username AS created_by_username,
             (SELECT COUNT(*) FROM driver_notifications dn WHERE dn.communication_id = c.id) AS total_sent,
             (SELECT COUNT(*) FROM driver_notifications dn WHERE dn.communication_id = c.id AND dn.read = TRUE) AS total_read
        FROM communications c
        LEFT JOIN users u ON u.id = c.created_by
       ORDER BY c.created_at DESC
       LIMIT 50
    `);
    res.json({ ok: true, communications: rows });
  } catch (err) {
    console.error('[communications GET]', err.message);
    res.status(500).json({ error: 'Error al obtener comunicados' });
  }
});

// ── POST /api/communications ─────────────────────────────────
router.post('/', async (req, res) => {
  const { title, body, type = 'info', created_by } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'Título y cuerpo requeridos' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Crear comunicado
    const commRes = await client.query(`
      INSERT INTO communications (title, body, type, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [title.trim(), body.trim(), type, created_by || null]);
    const comm = commRes.rows[0];

    // 2. Fan-out: insertar notificación para cada conductor activo
    const driversRes = await client.query(`
      SELECT id FROM users
       WHERE role = 'driver' AND active = TRUE
    `);

    if (driversRes.rows.length > 0) {
      const values = driversRes.rows
        .map((_, i) => `($1, $${i + 2})`)
        .join(', ');
      const params = [comm.id, ...driversRes.rows.map(r => r.id)];
      await client.query(`
        INSERT INTO driver_notifications (communication_id, user_id)
        VALUES ${values}
      `, params);
    }

    await client.query('COMMIT');

    res.json({
      ok: true,
      communication: comm,
      sent_to: driversRes.rows.length,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[communications POST]', err.message);
    res.status(500).json({ error: 'Error al crear comunicado' });
  } finally {
    client.release();
  }
});

// ── DELETE /api/communications/:id ──────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM communications WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[communications DELETE]', err.message);
    res.status(500).json({ error: 'Error al eliminar comunicado' });
  }
});

// ── GET /api/notifications (conductor) ──────────────────────
router.get('/notifications', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT dn.id, dn.read, dn.read_at, dn.created_at,
             c.title, c.body, c.type
        FROM driver_notifications dn
        JOIN communications c ON c.id = dn.communication_id
       WHERE dn.user_id = $1
       ORDER BY dn.created_at DESC
       LIMIT 50
    `, [req.user.id]);

    const unread = rows.filter(n => !n.read).length;
    res.json({ ok: true, notifications: rows, unread });
  } catch (err) {
    console.error('[notifications GET]', err.message);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// ── PUT /api/notifications/read-all ─────────────────────────
router.put('/notifications/read-all', verifyToken, async (req, res) => {
  try {
    await pool.query(`
      UPDATE driver_notifications
         SET read = TRUE, read_at = NOW()
       WHERE user_id = $1 AND read = FALSE
    `, [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[notifications read-all]', err.message);
    res.status(500).json({ error: 'Error al marcar notificaciones' });
  }
});

// ── PUT /api/notifications/:id/read ─────────────────────────
router.put('/notifications/:id/read', verifyToken, async (req, res) => {
  try {
    await pool.query(`
      UPDATE driver_notifications
         SET read = TRUE, read_at = NOW()
       WHERE id = $1 AND user_id = $2
    `, [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[notifications read]', err.message);
    res.status(500).json({ error: 'Error al marcar notificación' });
  }
});

module.exports = router;
