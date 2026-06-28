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

// GET /api/reports/daily?from=&to= — viajes por día (gráfico de tendencia)
router.get('/daily', auth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFrom = from || new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0];
    const dateTo   = to   || new Date().toISOString().split('T')[0];

    const { rows } = await pool.query(`
      SELECT DATE(start_time) as date, COUNT(*) as trips
      FROM trips
      WHERE DATE(start_time) BETWEEN $1 AND $2
      GROUP BY DATE(start_time)
      ORDER BY date ASC
    `, [dateFrom, dateTo]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/reports/payment?from=&to= — distribución de métodos de pago
router.get('/payment', auth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFrom = from || new Date().toISOString().split('T')[0];
    const dateTo   = to   || dateFrom;

    const { rows } = await pool.query(`
      SELECT
        COALESCE(SUM(cash_passengers), 0)    as cash_passengers,
        COALESCE(SUM(digital_passengers), 0) as digital_passengers,
        COALESCE(SUM(total_cash), 0)         as total_cash,
        COALESCE(SUM(total_digital), 0)      as total_digital
      FROM manifests
      WHERE DATE(created_at) BETWEEN $1 AND $2
        AND status = 'closed'
    `, [dateFrom, dateTo]);
    res.json(rows[0] || { cash_passengers: 0, digital_passengers: 0, total_cash: 0, total_digital: 0 });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/reports/weekday?from=&to= — pasajeros por día de la semana
router.get('/weekday', auth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFrom = from || new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0];
    const dateTo   = to   || new Date().toISOString().split('T')[0];

    const { rows } = await pool.query(`
      SELECT EXTRACT(DOW FROM created_at) as dow,
             COALESCE(SUM(total_passengers), 0) as passengers
      FROM manifests
      WHERE DATE(created_at) BETWEEN $1 AND $2
        AND status = 'closed'
      GROUP BY EXTRACT(DOW FROM created_at)
      ORDER BY dow
    `, [dateFrom, dateTo]);

    const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const result = Array(7).fill(null).map((_, i) => ({ label: DAY_LABELS[i], passengers: 0 }));
    rows.forEach(r => { result[parseInt(r.dow)].passengers = parseInt(r.passengers); });
    // Reordenar: Lun a Dom
    res.json([...result.slice(1), result[0]]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
