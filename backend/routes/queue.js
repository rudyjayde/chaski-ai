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

// ── Auto-crear tabla si no existe ────────────────────────────
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS queue_entries (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        queue_date    DATE         NOT NULL DEFAULT CURRENT_DATE,
        route         VARCHAR(20)  NOT NULL DEFAULT 'juli-puno',
        turn_number   INTEGER,
        driver_id     UUID         REFERENCES drivers(id) ON DELETE CASCADE,
        vehicle_id    UUID         REFERENCES vehicles(id) ON DELETE SET NULL,
        position      VARCHAR(20)  NOT NULL DEFAULT 'waiting',
        registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        departure_at  TIMESTAMP WITH TIME ZONE,
        active        BOOLEAN      DEFAULT TRUE,
        UNIQUE(queue_date, route, driver_id)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_qe_date_route ON queue_entries(queue_date, route)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_qe_driver ON queue_entries(driver_id)`);
  } catch (err) {
    console.error('[queue] Error al crear tabla queue_entries:', err.message);
  }
})();

// ── Asignar posición inicial según turno ─────────────────────
function getInitialPosition(turnNumber) {
  const slots = ['calling', 'ramp1', 'ramp2', 'outside1', 'outside2'];
  return slots[turnNumber - 1] || 'waiting';
}

// ── Resolver user_id → driver record ─────────────────────────
// El frontend envía session.id que es users.id.
// Esta función resuelve al registro de la tabla drivers.
async function resolveDriver(userId) {
  const res = await pool.query(
    `SELECT d.id AS driver_id, d.vehicle_id, d.first_name, d.last_name
       FROM drivers d
      WHERE d.user_id = $1 AND d.active = TRUE`,
    [userId]
  );
  return res.rows[0] || null;
}

// ── GET /api/queue/fleet — Estado actual de toda la flota ─────
// Devuelve todos los conductores activos con su posición en cola (hoy o mañana)
router.get('/fleet', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        d.id              AS driver_id,
        d.first_name,
        d.last_name,
        u.username,
        v.association_code AS vehicle_code,
        v.plate,
        c.name            AS company,
        qe.id             AS entry_id,
        qe.position,
        qe.queue_date,
        qe.route,
        qe.turn_number,
        qe.registered_at,
        qe.departure_at
      FROM drivers d
      LEFT JOIN users u        ON u.id  = d.user_id
      LEFT JOIN vehicles v     ON v.id  = d.vehicle_id
      LEFT JOIN companies c    ON c.id  = v.company_id
      LEFT JOIN LATERAL (
        SELECT * FROM queue_entries qe2
        WHERE qe2.driver_id = d.id
          AND qe2.queue_date >= CURRENT_DATE
          AND qe2.active = TRUE
        ORDER BY qe2.queue_date ASC, qe2.registered_at DESC
        LIMIT 1
      ) qe ON TRUE
      WHERE d.active = TRUE
      ORDER BY
        CASE WHEN qe.position IS NULL THEN 2
             WHEN qe.position = 'departed' THEN 1
             ELSE 0 END,
        qe.turn_number ASC NULLS LAST,
        d.first_name ASC
    `);
    res.json({ ok: true, drivers: rows });
  } catch (err) {
    console.error('[queue fleet]', err.message);
    res.status(500).json({ error: 'Error al obtener estado de flota' });
  }
});

// ── GET /api/queue ────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { route = 'juli-puno', date } = req.query;
  const qDate = date || new Date().toISOString().split('T')[0];

  try {
    const { rows } = await pool.query(`
      SELECT
        qe.id,
        qe.vehicle_id,
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
        c.name         AS company
      FROM queue_entries qe
      JOIN drivers d ON d.id = qe.driver_id
      LEFT JOIN users u         ON u.id  = d.user_id
      LEFT JOIN vehicles v      ON v.id  = qe.vehicle_id
      LEFT JOIN companies c     ON c.id  = v.company_id
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
// driver_id puede ser users.id o drivers.id — se resuelve automáticamente
router.post('/register', async (req, res) => {
  const { driver_id, route = 'juli-puno', queue_date, vehicle_id } = req.body;
  if (!driver_id) return res.status(400).json({ error: 'driver_id requerido' });

  try {
    // Intentar resolver como user_id primero (caso habitual desde el panel conductor)
    let driverRecord = await resolveDriver(driver_id);

    // Si no encuentra por user_id, asumir que ya es un drivers.id
    let actualDriverId  = driverRecord ? driverRecord.driver_id  : driver_id;
    let actualVehicleId = vehicle_id   || (driverRecord ? driverRecord.vehicle_id : null);

    // Verificar que el driver existe en la tabla drivers
    if (!driverRecord) {
      const check = await pool.query('SELECT id FROM drivers WHERE id = $1', [driver_id]);
      if (!check.rows.length) {
        return res.status(404).json({ error: 'Conductor no encontrado. Verifica que el perfil esté registrado.' });
      }
    }

    // Fecha objetivo: si no se pasa, es el día siguiente
    const targetDate = queue_date || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
    })();

    // Número de turno: el mayor entre todos (incluye departed para orden)
    const turnRes = await pool.query(`
      SELECT COALESCE(MAX(turn_number), 0) + 1 AS next_turn
        FROM queue_entries
       WHERE queue_date = $1 AND route = $2 AND active = TRUE
    `, [targetDate, route]);
    const nextTurn = turnRes.rows[0].next_turn;

    // Posición inicial basada en conductores ACTIVOS (no departed/cancelled)
    // para que al re-inscribirse después de un viaje entren en la cola real
    const activeRes = await pool.query(`
      SELECT COUNT(*) AS count
        FROM queue_entries
       WHERE queue_date = $1 AND route = $2 AND active = TRUE
         AND position NOT IN ('departed', 'cancelled')
    `, [targetDate, route]);
    const activeCount   = parseInt(activeRes.rows[0].count);
    const initialPosition = getInitialPosition(activeCount + 1);

    const { rows } = await pool.query(`
      INSERT INTO queue_entries (queue_date, route, turn_number, driver_id, vehicle_id, position)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (queue_date, route, driver_id) DO UPDATE
        SET vehicle_id    = EXCLUDED.vehicle_id,
            active        = TRUE,
            turn_number   = EXCLUDED.turn_number,
            registered_at = NOW(),
            position      = CASE
              WHEN queue_entries.position IN ('calling','ramp1','ramp2','outside1','outside2')
                THEN queue_entries.position
              ELSE EXCLUDED.position
            END
      RETURNING *
    `, [targetDate, route, nextTurn, actualDriverId, actualVehicleId, initialPosition]);

    res.json({ ok: true, entry: rows[0], target_date: targetDate });
  } catch (err) {
    console.error('[queue register]', err.message);
    res.status(500).json({ error: 'Error al inscribir en cola: ' + err.message });
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
    if (turn_number !== undefined) { sets.push(`turn_number = $${idx++}`); params.push(turn_number); }
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
// Marca como salido y auto-avanza el resto de la cola
router.put('/:id/depart', async (req, res) => {
  try {
    // Obtener fecha y ruta de esta entrada
    const entryRes = await pool.query(
      'SELECT queue_date, route FROM queue_entries WHERE id = $1',
      [req.params.id]
    );
    if (!entryRes.rows.length) return res.status(404).json({ error: 'Entrada no encontrada' });
    const { queue_date, route } = entryRes.rows[0];

    // Marcar como salido
    await pool.query(`
      UPDATE queue_entries
         SET position = 'departed', departure_at = NOW()
       WHERE id = $1
    `, [req.params.id]);

    // Auto-avanzar posiciones del resto de la cola
    const remaining = await pool.query(`
      SELECT id FROM queue_entries
      WHERE queue_date = $1 AND route = $2
        AND active = TRUE
        AND position NOT IN ('departed', 'cancelled')
      ORDER BY turn_number ASC
    `, [queue_date, route]);

    const slots = ['calling', 'ramp1', 'ramp2', 'outside1', 'outside2'];
    for (let i = 0; i < remaining.rows.length; i++) {
      await pool.query(
        'UPDATE queue_entries SET position = $1 WHERE id = $2',
        [slots[i] || 'waiting', remaining.rows[i].id]
      );
    }

    res.json({ ok: true, advanced: remaining.rows.length });
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
