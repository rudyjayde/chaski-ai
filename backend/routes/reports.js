const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');

// GET /api/reports/summary — KPIs del dashboard (hoy)
router.get('/summary', auth, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const [tripsRes, passengersRes, revenueRes, alertsRes, queueRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) as total FROM trips WHERE DATE(start_time) = $1`, [date]),
      pool.query(`SELECT COALESCE(SUM(total_passengers), 0) as total FROM manifests WHERE DATE(created_at) = $1 AND status = 'closed'`, [date]),
      pool.query(`SELECT COALESCE(SUM(total_revenue), 0) as total FROM manifests WHERE DATE(created_at) = $1 AND status = 'closed'`, [date]),
      pool.query(`SELECT COUNT(*) as total FROM speed_alerts WHERE DATE(occurred_at) = $1`, [date]),
      pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'departed') as departed FROM exit_queue WHERE queue_date = $1`, [date]),
    ]);

    res.json({
      date,
      trips:       parseInt(tripsRes.rows[0].total),
      passengers:  parseInt(passengersRes.rows[0].total),
      revenue:     parseFloat(revenueRes.rows[0].total),
      alerts:      parseInt(alertsRes.rows[0].total),
      queue_total:    parseInt(queueRes.rows[0].total),
      queue_departed: parseInt(queueRes.rows[0].departed),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/reports/revenue — ingresos por empresa
router.get('/revenue', auth, adminOnly, async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFrom = from || new Date().toISOString().split('T')[0];
    const dateTo   = to   || dateFrom;

    const { rows } = await pool.query(`
      SELECT c.name as company, c.code,
             COUNT(DISTINCT t.id) as trips,
             COALESCE(SUM(m.total_passengers), 0) as passengers,
             COALESCE(SUM(m.total_revenue), 0) as revenue
      FROM companies c
      LEFT JOIN vehicles v ON v.company_id = c.id
      LEFT JOIN trips t ON t.vehicle_id = v.id AND DATE(t.start_time) BETWEEN $1 AND $2
      LEFT JOIN manifests m ON m.id = t.manifest_id
      GROUP BY c.id, c.name, c.code
      ORDER BY revenue DESC
    `, [dateFrom, dateTo]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/reports/drivers — ranking de conductores
router.get('/drivers', auth, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const { rows } = await pool.query(`
      SELECT d.id, d.first_name || ' ' || d.last_name as driver_name,
             d.phone, v.plate, v.association_code,
             COUNT(DISTINCT t.id) as trips,
             COALESCE(SUM(m.total_passengers), 0) as passengers,
             COALESCE(SUM(m.total_revenue), 0) as revenue,
             COALESCE(MAX(sa.max_speed), 0) as max_speed_today,
             COUNT(DISTINCT sa.id) as speed_alerts
      FROM drivers d
      LEFT JOIN vehicles v ON d.vehicle_id = v.id
      LEFT JOIN trips t ON t.driver_id = d.id AND DATE(t.start_time) = $1
      LEFT JOIN manifests m ON m.id = t.manifest_id
      LEFT JOIN speed_alerts sa ON sa.driver_id = d.id AND DATE(sa.occurred_at) = $1
      WHERE d.active = true
      GROUP BY d.id, d.first_name, d.last_name, d.phone, v.plate, v.association_code
      ORDER BY revenue DESC
    `, [date]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/reports/alerts — historial de alertas de velocidad
router.get('/alerts', auth, async (req, res) => {
  try {
    const { date, limit = 50 } = req.query;
    const filterDate = date || new Date().toISOString().split('T')[0];
    const { rows } = await pool.query(`
      SELECT sa.id, sa.max_speed, sa.speed_limit, sa.duration_minutes,
             sa.severity, sa.occurred_at, sa.acknowledged,
             d.first_name || ' ' || d.last_name as driver_name,
             v.plate, v.association_code
      FROM speed_alerts sa
      JOIN vehicles v ON sa.vehicle_id = v.id
      LEFT JOIN drivers d ON sa.driver_id = d.id
      WHERE DATE(sa.occurred_at) = $1
      ORDER BY sa.occurred_at DESC
      LIMIT $2
    `, [filterDate, limit]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
