// ============================================================
// CHASKI AI 2.0 — Cola de Salida Diaria
//
// GET  /api/queue            → lista de la cola (filtro por route y date)
// POST /api/queue/register   → inscribir conductor para mañana
// PUT  /api/queue/:id        → cambiar posición (admin)
// PUT  /api/queue/:id/depart → marcar como salido
// DELETE /api/queue/:id      → cancelar entrada
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

// ── GET /api/queue ────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { route = 'juli-puno', date } = req.query;
  const qDate = date || new Date().toISOString().split('T')[0];

  try {
    const { rows } = await pool.query(`
      SELECT
        qe.id,
        qe.turn_number,
        qe.position,
        qe.route,
        qe.registered_at,
        qe.departure_at,
        d.id           AS driver_id,
        d.first_name,
        d.last_name,
        u.username,
        v.association_code AS vehicle_code,
        v.plate,
        a.name         AS company
      FROM queue_entries qe
      JOIN drivers d ON d.id = qe.driver_id
      LEFT JOIN users u    ON u.id  = d.user_id
      LEFT JOIN vehicles v ON v.id  = qe.vehicle_id
      LEFT JOIN associations a ON a.id = v.company_id
      WHERE qe.queue_date = $1
        AND qe.route      = $2
        AND qe.active     = TRUE
      ORDER BY qe.turn_number ASC NULLS LAST, qe.registered_at ASC
    `, [qDate, route]);

    res.json({ ok: true, entries: rows, date: qDate, route });
  } catch (err) {
    console.error('[queue GET]', err.message);
    res.status(500).json({ error: 'Error al obtener cola' });
  }
});

// ── POST /api/queue/register ──────────────────────────────────
router.post('/register', async (req, res) => {
  const { driver_id, vehicle_id, route = 'juli-puno', queue_date } = req.body;
  if (!driver_id) return res.status(400).json({ error: 'driver_id requerido' });

  // Fecha objetivo: si no se pasa, es el día siguiente
  const targetDate = queue_date || (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })();

  try {
    // Obtener siguiente número de turno
    const turnRes = await pool.query(`
      SELECT COALESCE(MAX(turn_number), 0) + 1 AS next_turn
        FROM queue_entries
       WHERE queue_date = $1 AND route = $2 AND active = TRUE
    `, [targetDate, route]);
    const nextTurn = turnRes.rows[0].next_turn;

    const { rows } = await pool.query(`
      INSERT INTO queue_entries (queue_date, route, turn_number, driver_id, vehicle_id, position)
      VALUES ($1, $2, $3, $4, $5, 'waiting')
      ON CONFLICT (queue_date, route, driver_id) DO UPDATE
        SET vehicle_id = EXCLUDED.vehicle_id, active = TRUE
      RETURNING *
    `, [targetDate, route, nextTurn, driver_id, vehicle_id || null]);

    res.json({ ok: true, entry: rows[0] });
  } catch (err) {
    console.error('[queue register]', err.message);
    res.status(500).json({ error: 'Error al inscribir en cola' });
  }
});

// ── PUT /api/queue/:id ────────────────────────────────────────
// Cambia posición: { position: 'calling' | 'ramp1' | ... }
router.put('/:id', async (req, res) => {
  const { position, turn_number } = req.body;
  try {
    const sets   = [];
    const params = [];
    let idx = 1;
    if (position)    { sets.push(`position = $${idx++}`);    params.push(position); }
    if (turn_number) { sets.push(`turn_number = $${idx++}`); params.push(turn_number); }
    if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });

    params.push(req.params.id);
    await pool.query(
      `UPDATE queue_entries SET ${sets.join(', ')} WHERE id = $${idx}`,
      params
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[queue PUT]', err.message);
    res.status(500).json({ error: 'Error al actualizar posición' });
  }
});

// ── PUT /api/queue/:id/depart ─────────────────────────────────
router.put('/:id/depart', async (req, res) => {
  try {
    await pool.query(`
      UPDATE queue_entries
         SET position = 'departed', departure_at = NOW()
       WHERE id = $1
    `, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[queue depart]', err.message);
    res.status(500).json({ error: 'Error al marcar salida' });
  }
});

// ── DELETE /api/queue/:id ─────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      `UPDATE queue_entries SET active = FALSE, position = 'cancelled' WHERE id = $1`,
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[queue DELETE]', err.message);
    res.status(500).json({ error: 'Error al cancelar' });
  }
});

module.exports = router;
