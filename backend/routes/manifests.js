const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');

function generateManifestNumber() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `MAN-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${Date.now().toString().slice(-4)}`;
}

// GET /api/manifests
router.get('/', auth, async (req, res) => {
  try {
    const { date, driver_id, status, limit = 50, offset = 0 } = req.query;
    const filters = [];
    const params = [];
    let i = 1;

    if (date)      { filters.push(`DATE(m.created_at) = $${i++}`); params.push(date); }
    if (driver_id) { filters.push(`m.driver_id = $${i++}`);        params.push(driver_id); }
    if (status)    { filters.push(`m.status = $${i++}`);           params.push(status); }

    const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

    const { rows } = await pool.query(`
      SELECT m.id, m.manifest_number, m.status, m.departure_time, m.arrival_time,
             m.total_passengers, m.total_revenue, m.cash_passengers, m.digital_passengers,
             m.total_cash, m.total_digital, m.created_at, m.closed_at,
             d.first_name || ' ' || d.last_name as driver_name,
             v.plate, v.association_code, r.name as route_name
      FROM manifests m
      JOIN drivers d ON m.driver_id = d.id
      JOIN vehicles v ON m.vehicle_id = v.id
      JOIN routes r ON m.route_id = r.id
      ${where}
      ORDER BY m.created_at DESC
      LIMIT $${i++} OFFSET $${i++}
    `, [...params, limit, offset]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/manifests/active — manifiesto abierto del conductor actual
router.get('/active', auth, async (req, res) => {
  try {
    const driverId = req.query.driver_id || req.user.driver_id;
    const { rows } = await pool.query(`
      SELECT m.*, d.first_name || ' ' || d.last_name as driver_name,
             v.plate, r.name as route_name
      FROM manifests m
      JOIN drivers d ON m.driver_id = d.id
      JOIN vehicles v ON m.vehicle_id = v.id
      JOIN routes r ON m.route_id = r.id
      WHERE m.driver_id = $1 AND m.status = 'open'
      ORDER BY m.created_at DESC LIMIT 1
    `, [driverId]);
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/manifests/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows: mRows } = await pool.query(`
      SELECT m.*, d.first_name || ' ' || d.last_name as driver_name, d.phone as driver_phone,
             v.plate, v.association_code, r.name as route_name, r.fare as base_fare
      FROM manifests m
      JOIN drivers d ON m.driver_id = d.id
      JOIN vehicles v ON m.vehicle_id = v.id
      JOIN routes r ON m.route_id = r.id
      WHERE m.id = $1
    `, [req.params.id]);
    if (!mRows.length) return res.status(404).json({ error: 'Manifiesto no encontrado' });

    const { rows: passengers } = await pool.query(
      `SELECT * FROM manifest_passengers WHERE manifest_id = $1 ORDER BY passenger_order`,
      [req.params.id]
    );
    res.json({ ...mRows[0], passengers });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/manifests
router.post('/', auth, async (req, res) => {
  try {
    const { driver_id, vehicle_id, route_id, departure_time } = req.body;
    const manifest_number = generateManifestNumber();

    const { rows } = await pool.query(`
      INSERT INTO manifests (manifest_number, vehicle_id, driver_id, route_id, departure_time)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [manifest_number, vehicle_id, driver_id, route_id, departure_time || new Date()]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/manifests/:id/passengers
router.post('/:id/passengers', auth, async (req, res) => {
  try {
    const { dni, full_name, phone, origin, destination, seat_number,
            payment_type, fare, boarding_point } = req.body;

    // Calcular siguiente orden
    const { rows: countRows } = await pool.query(
      `SELECT COALESCE(MAX(passenger_order), 0) + 1 as next_order FROM manifest_passengers WHERE manifest_id = $1`,
      [req.params.id]
    );

    const { rows } = await pool.query(`
      INSERT INTO manifest_passengers
        (manifest_id, passenger_order, dni, full_name, phone, origin, destination,
         seat_number, payment_type, fare, boarding_point)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [req.params.id, countRows[0].next_order, dni, full_name, phone,
        origin || 'Juli', destination || 'Puno', seat_number,
        payment_type || 'cash', fare || 7.00, boarding_point]);

    // Actualizar totales del manifiesto
    await pool.query(`
      UPDATE manifests SET
        total_passengers   = (SELECT COUNT(*) FROM manifest_passengers WHERE manifest_id = $1),
        total_revenue      = (SELECT COALESCE(SUM(fare), 0) FROM manifest_passengers WHERE manifest_id = $1),
        cash_passengers    = (SELECT COUNT(*) FROM manifest_passengers WHERE manifest_id = $1 AND payment_type = 'cash'),
        digital_passengers = (SELECT COUNT(*) FROM manifest_passengers WHERE manifest_id = $1 AND payment_type != 'cash'),
        total_cash         = (SELECT COALESCE(SUM(fare), 0) FROM manifest_passengers WHERE manifest_id = $1 AND payment_type = 'cash'),
        total_digital      = (SELECT COALESCE(SUM(fare), 0) FROM manifest_passengers WHERE manifest_id = $1 AND payment_type != 'cash'),
        updated_at         = NOW()
      WHERE id = $1
    `, [req.params.id]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// DELETE /api/manifests/:id/passengers/:pid
router.delete('/:id/passengers/:pid', auth, async (req, res) => {
  try {
    await pool.query(`DELETE FROM manifest_passengers WHERE id = $1 AND manifest_id = $2`, [req.params.pid, req.params.id]);
    // Recalcular totales
    await pool.query(`
      UPDATE manifests SET
        total_passengers   = (SELECT COUNT(*) FROM manifest_passengers WHERE manifest_id = $1),
        total_revenue      = (SELECT COALESCE(SUM(fare), 0) FROM manifest_passengers WHERE manifest_id = $1),
        updated_at         = NOW()
      WHERE id = $1
    `, [req.params.id]);
    res.json({ message: 'Pasajero eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT /api/manifests/:id/close
router.put('/:id/close', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      UPDATE manifests SET
        status     = 'closed',
        closed_at  = NOW(),
        arrival_time = NOW(),
        updated_at = NOW()
      WHERE id = $1 AND status = 'open'
      RETURNING *
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Manifiesto no encontrado o ya cerrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
