const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');

// GET /api/trips
router.get('/', auth, async (req, res) => {
  try {
    const { date, driver_id, vehicle_id, from, to, limit = 50, offset = 0 } = req.query;
    const filters = [];
    const params = [];
    let i = 1;

    if (date)      { filters.push(`DATE(t.start_time) = $${i++}`);  params.push(date); }
    if (from)      { filters.push(`DATE(t.start_time) >= $${i++}`); params.push(from); }
    if (to)        { filters.push(`DATE(t.start_time) <= $${i++}`); params.push(to); }
    if (driver_id) { filters.push(`t.driver_id = $${i++}`);         params.push(driver_id); }
    if (vehicle_id){ filters.push(`t.vehicle_id = $${i++}`);        params.push(vehicle_id); }

    const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

    const { rows } = await pool.query(`
      SELECT t.id, t.start_time, t.end_time, t.status, t.revenue,
             t.avg_speed, t.max_speed, t.distance_km,
             d.first_name || ' ' || d.last_name as driver_name,
             v.plate, v.association_code,
             r.name as route_name,
             m.manifest_number, m.total_passengers,
             c.name as company_name
      FROM trips t
      JOIN drivers d ON t.driver_id = d.id
      JOIN vehicles v ON t.vehicle_id = v.id
      JOIN routes r ON t.route_id = r.id
      LEFT JOIN manifests m ON t.manifest_id = m.id
      LEFT JOIN companies c ON v.company_id = c.id
      ${where}
      ORDER BY t.start_time DESC
      LIMIT $${i++} OFFSET $${i++}
    `, [...params, limit, offset]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/trips/today/summary — resumen del día para el dashboard
router.get('/today/summary', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'active')    as active,
        COALESCE(SUM(revenue), 0)                    as total_revenue,
        COALESCE(SUM(m.total_passengers), 0)         as total_passengers
      FROM trips t
      LEFT JOIN manifests m ON t.manifest_id = m.id
      WHERE DATE(t.start_time) = CURRENT_DATE
    `);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/trips/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*, d.first_name || ' ' || d.last_name as driver_name,
             v.plate, r.name as route_name,
             m.manifest_number, m.total_passengers, m.total_revenue
      FROM trips t
      JOIN drivers d ON t.driver_id = d.id
      JOIN vehicles v ON t.vehicle_id = v.id
      JOIN routes r ON t.route_id = r.id
      LEFT JOIN manifests m ON t.manifest_id = m.id
      WHERE t.id = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Viaje no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/trips — iniciar viaje
router.post('/', auth, async (req, res) => {
  try {
    const { vehicle_id, driver_id, route_id, manifest_id } = req.body;
    const { rows } = await pool.query(`
      INSERT INTO trips (vehicle_id, driver_id, route_id, manifest_id, start_time)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `, [vehicle_id, driver_id, route_id, manifest_id || null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT /api/trips/:id/end — finalizar viaje
router.put('/:id/end', auth, async (req, res) => {
  try {
    const { revenue, notes } = req.body;
    const { rows } = await pool.query(`
      UPDATE trips SET
        status   = 'completed',
        end_time = NOW(),
        revenue  = COALESCE($1, revenue),
        notes    = COALESCE($2, notes)
      WHERE id = $3 AND status = 'active'
      RETURNING *
    `, [revenue || null, notes || null, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Viaje no encontrado o ya finalizado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
