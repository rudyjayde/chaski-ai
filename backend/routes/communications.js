// ============================================================
// CHASKI AI 2.0 — Comunicados y notificaciones
//
// Admin:
//   GET  /api/communications               → lista de comunicados
//   POST /api/communications               → crea comunicado + fan-out a conductores activos
//   DELETE /api/communications/:id         → elimina comunicado
//   GET  /api/communications/driver-alerts → alertas SOS/incidentes de conductores
//   PUT  /api/communications/driver-alerts/resolve-all → resolver todas
//   PUT  /api/communications/driver-alerts/:id/resolve → resolver una
//
// Conductor (requiere JWT):
//   POST /api/communications/notifications → envía SOS o incidente al admin
//   GET  /api/communications/notifications → mis notificaciones del admin
//   PUT  /api/communications/notifications/:id/read   → marcar una como leída
//   PUT  /api/communications/notifications/read-all   → marcar todas como leídas
// ============================================================
const express             = require('express');
const router              = express.Router();
const pool                = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');

// ── Auto-crear tabla driver_alerts ───────────────────────────
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS driver_alerts (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        driver_id   UUID REFERENCES users(id) ON DELETE SET NULL,
        type        VARCHAR(20)  NOT NULL DEFAULT 'alert',
        title       VARCHAR(300) NOT NULL,
        body        TEXT,
        status      VARCHAR(20)  NOT NULL DEFAULT 'pending',
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
  } catch (err) {
    console.error('[driver_alerts init]', err.message);
  }
})();

// ── GET /api/communications ──────────────────────────────────
router.get('/', auth, adminOnly, async (req, res) => {
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
router.post('/', auth, adminOnly, async (req, res) => {
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

// ── PUT /api/communications/:id (editar reglamento) ─────────
router.put('/:id', auth, adminOnly, async (req, res) => {
  const { title, body, type } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'Título y cuerpo requeridos' });
  try {
    const { rows } = await pool.query(
      `UPDATE communications SET title=$1, body=$2, type=$3 WHERE id=$4 RETURNING *`,
      [title.trim(), body.trim(), type || 'info', req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Comunicado no encontrado' });
    res.json({ ok: true, communication: rows[0] });
  } catch (err) {
    console.error('[communications PUT]', err.message);
    res.status(500).json({ error: 'Error al actualizar comunicado' });
  }
});

// ── DELETE /api/communications/:id ──────────────────────────
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM communications WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[communications DELETE]', err.message);
    res.status(500).json({ error: 'Error al eliminar comunicado' });
  }
});

// ── GET /api/notifications (conductor) ──────────────────────
router.get('/notifications', auth, async (req, res) => {
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
router.put('/notifications/read-all', auth, async (req, res) => {
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
router.put('/notifications/:id/read', auth, async (req, res) => {
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

// ── POST /api/communications/notifications (conductor) ───────
// Recibe SOS e incidentes del conductor y los guarda para el admin
router.post('/notifications', auth, async (req, res) => {
  const { type = 'alert', title, body = '' } = req.body;
  if (!title) return res.status(400).json({ error: 'Título requerido' });
  try {
    await pool.query(
      `INSERT INTO driver_alerts (driver_id, type, title, body) VALUES ($1, $2, $3, $4)`,
      [req.user.id, type, title.trim(), body.trim()]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[driver_alerts POST]', err.message);
    res.status(500).json({ error: 'Error al registrar alerta' });
  }
});

// ── GET /api/communications/driver-alerts (admin) ────────────
router.get('/driver-alerts', auth, adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT da.id, da.type, da.title, da.body, da.status, da.created_at,
             u.username, u.name AS driver_name
        FROM driver_alerts da
        LEFT JOIN users u ON u.id = da.driver_id
       ORDER BY da.created_at DESC
       LIMIT 50
    `);
    const pending = rows.filter(r => r.status === 'pending').length;
    res.json({ ok: true, alerts: rows, pending });
  } catch (err) {
    console.error('[driver-alerts GET]', err.message);
    res.status(500).json({ error: 'Error al obtener alertas' });
  }
});

// ── PUT /api/communications/driver-alerts/resolve-all (admin)
router.put('/driver-alerts/resolve-all', auth, adminOnly, async (req, res) => {
  try {
    await pool.query(`UPDATE driver_alerts SET status = 'resolved' WHERE status = 'pending'`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[driver-alerts resolve-all]', err.message);
    res.status(500).json({ error: 'Error al resolver alertas' });
  }
});

// ── PUT /api/communications/driver-alerts/:id/resolve (admin)
router.put('/driver-alerts/:id/resolve', auth, adminOnly, async (req, res) => {
  try {
    await pool.query(
      `UPDATE driver_alerts SET status = 'resolved' WHERE id = $1`,
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[driver-alerts resolve]', err.message);
    res.status(500).json({ error: 'Error al resolver alerta' });
  }
});

module.exports = router;
