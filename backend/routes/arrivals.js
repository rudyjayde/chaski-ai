// ============================================================
// CHASKI AI 2.0 — Notificaciones de llegada (conductor → admin)
//
// POST /api/arrivals          → conductor registra llegada
// GET  /api/arrivals          → admin lista llegadas recientes
// PUT  /api/arrivals/seen-all → admin marca todas como vistas
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');

// ── Auto-crear tabla si no existe ────────────────────────────
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS arrival_logs (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username      VARCHAR(100),
        driver_name   VARCHAR(200),
        route         VARCHAR(20),
        arrived_city  VARCHAR(50),
        arrived_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        seen_by_admin BOOLEAN DEFAULT FALSE,
        seen_at       TIMESTAMP WITH TIME ZONE
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_arrivals_at ON arrival_logs(arrived_at DESC)`);
  } catch (err) {
    console.error('[arrivals] Error al crear tabla:', err.message);
  }
})();

// ── POST /api/arrivals ── conductor notifica llegada ─────────
router.post('/', auth, async (req, res) => {
  const { route, driver_name } = req.body;
  const username    = req.user?.username || 'desconocido';
  const cityMap     = { 'juli-puno': 'Puno', 'puno-juli': 'Juli' };
  const arrivedCity = cityMap[route] || 'destino';

  try {
    const { rows } = await pool.query(`
      INSERT INTO arrival_logs (username, driver_name, route, arrived_city)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [username, driver_name || username, route || 'juli-puno', arrivedCity]);

    res.json({ ok: true, arrival: rows[0] });
  } catch (err) {
    console.error('[arrivals POST]', err.message);
    res.status(500).json({ error: 'Error al registrar llegada' });
  }
});

// ── GET /api/arrivals ── admin ve llegadas recientes ─────────
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM arrival_logs
      WHERE arrived_at >= NOW() - INTERVAL '24 hours'
      ORDER BY arrived_at DESC
      LIMIT 30
    `);
    const unseen = rows.filter(r => !r.seen_by_admin).length;
    res.json({ ok: true, arrivals: rows, unseen });
  } catch (err) {
    console.error('[arrivals GET]', err.message);
    res.status(500).json({ error: 'Error al obtener llegadas' });
  }
});

// ── PUT /api/arrivals/seen-all ── marcar todas como vistas ───
router.put('/seen-all', auth, adminOnly, async (req, res) => {
  try {
    await pool.query(`
      UPDATE arrival_logs
         SET seen_by_admin = TRUE, seen_at = NOW()
       WHERE seen_by_admin = FALSE
    `);
    res.json({ ok: true });
  } catch (err) {
    console.error('[arrivals seen-all]', err.message);
    res.status(500).json({ error: 'Error al marcar vistas' });
  }
});

module.exports = router;
