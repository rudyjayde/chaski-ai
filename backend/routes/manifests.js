const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');

// ── Auto-crear tablas si no existen ──────────────────────────
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS routes (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(100) NOT NULL,
        slug        VARCHAR(50)  UNIQUE,
        origin      VARCHAR(50),
        destination VARCHAR(50),
        distance_km NUMERIC,
        fare        NUMERIC DEFAULT 7.00,
        active      BOOLEAN DEFAULT TRUE,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Migración: agregar columna slug si la tabla ya existía sin ella
    await pool.query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS slug VARCHAR(50)`);
    await pool.query(`
      UPDATE routes SET slug = CASE
        WHEN name ILIKE 'Juli%Puno%'   THEN 'juli-puno'
        WHEN name ILIKE 'Puno%Juli%'   THEN 'puno-juli'
        WHEN name ILIKE 'Juli%Desag%'  THEN 'juli-desaguadero'
        WHEN name ILIKE 'Puno%Desag%'  THEN 'puno-desaguadero'
        WHEN name ILIKE 'Juli%Ilave%'  THEN 'juli-ilave'
        ELSE slug
      END
      WHERE slug IS NULL
    `);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_routes_slug ON routes(slug)`);

    await pool.query(`
      INSERT INTO routes (name, slug, origin, destination, distance_km, fare) VALUES
        ('Juli → Puno',         'juli-puno',          'Juli',  'Puno',         98.5, 7.00),
        ('Puno → Juli',         'puno-juli',          'Puno',  'Juli',         98.5, 7.00),
        ('Juli → Desaguadero',  'juli-desaguadero',   'Juli',  'Desaguadero',  65.0, 5.00),
        ('Puno → Desaguadero',  'puno-desaguadero',   'Puno',  'Desaguadero',  50.0, 5.00),
        ('Juli → Ilave',        'juli-ilave',         'Juli',  'Ilave',        40.0, 4.00)
      ON CONFLICT (slug) DO NOTHING
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS manifests (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        manifest_number     VARCHAR(40) UNIQUE,
        vehicle_id          UUID REFERENCES vehicles(id) ON DELETE SET NULL,
        driver_id           UUID REFERENCES drivers(id) ON DELETE SET NULL,
        route_id            UUID REFERENCES routes(id) ON DELETE SET NULL,
        departure_time      TIMESTAMP WITH TIME ZONE,
        arrival_time        TIMESTAMP WITH TIME ZONE,
        total_passengers    INTEGER DEFAULT 0,
        total_revenue       NUMERIC  DEFAULT 0,
        cash_passengers     INTEGER DEFAULT 0,
        digital_passengers  INTEGER DEFAULT 0,
        total_cash          NUMERIC  DEFAULT 0,
        total_digital       NUMERIC  DEFAULT 0,
        status              VARCHAR(20) DEFAULT 'open',
        notes               TEXT,
        created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        closed_at           TIMESTAMP WITH TIME ZONE
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS manifest_passengers (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        manifest_id     UUID NOT NULL REFERENCES manifests(id) ON DELETE CASCADE,
        passenger_order INTEGER,
        dni             VARCHAR(20),
        full_name       VARCHAR(200),
        phone           VARCHAR(20),
        origin          VARCHAR(100),
        destination     VARCHAR(100),
        seat_number     INTEGER,
        payment_type    VARCHAR(20) DEFAULT 'cash',
        fare            NUMERIC DEFAULT 7.00,
        boarding_point  VARCHAR(100),
        created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vehicle_id  UUID REFERENCES vehicles(id) ON DELETE SET NULL,
        driver_id   UUID REFERENCES drivers(id) ON DELETE SET NULL,
        route_id    UUID REFERENCES routes(id) ON DELETE SET NULL,
        manifest_id UUID REFERENCES manifests(id) ON DELETE SET NULL,
        start_time  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        end_time    TIMESTAMP WITH TIME ZONE,
        status      VARCHAR(20) DEFAULT 'active',
        revenue     NUMERIC DEFAULT 0,
        avg_speed   NUMERIC,
        max_speed   NUMERIC,
        distance_km NUMERIC,
        notes       TEXT,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_manifests_driver ON manifests(driver_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_manifests_date ON manifests(created_at)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(start_time)`);
  } catch (err) {
    console.error('[manifests] Error al crear tablas:', err.message);
  }
})();

function generateManifestNumber() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `MAN-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${Date.now().toString().slice(-4)}`;
}

// POST /api/manifests/complete — guarda manifiesto completo + crea viaje en una transacción
router.post('/complete', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    let { driver_id, vehicle_id, route_name, departure_time, passengers = [] } = req.body;

    console.log('[manifests/complete] Recibido:', { driver_id, vehicle_id: vehicle_id || '(null)', route_name, passengers: passengers.length });

    if (!driver_id || !route_name) {
      console.warn('[manifests/complete] Faltan campos:', { driver_id, route_name });
      return res.status(400).json({ error: 'Faltan campos: driver_id, route_name' });
    }

    // Si no llega vehicle_id, buscarlo desde el perfil del conductor
    if (!vehicle_id) {
      const vRes = await client.query(
        'SELECT vehicle_id FROM drivers WHERE id = $1',
        [driver_id]
      );
      vehicle_id = vRes.rows[0]?.vehicle_id || null;
    }

    // Buscar route_id por slug
    const routeRes = await client.query(
      'SELECT id, name FROM routes WHERE slug = $1',
      [route_name]
    );
    if (!routeRes.rows.length) {
      return res.status(400).json({ error: `Ruta '${route_name}' no encontrada en la BD` });
    }
    const route_id = routeRes.rows[0].id;
    const depTime  = departure_time ? new Date(departure_time) : new Date();

    await client.query('BEGIN');

    // 1. Crear manifiesto
    const manifest_number = generateManifestNumber();
    const mRes = await client.query(`
      INSERT INTO manifests (manifest_number, vehicle_id, driver_id, route_id, departure_time)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [manifest_number, vehicle_id, driver_id, route_id, depTime]);
    const manifest_id = mRes.rows[0].id;

    // 2. Insertar pasajeros
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      await client.query(`
        INSERT INTO manifest_passengers
          (manifest_id, passenger_order, dni, full_name, origin, destination, seat_number, payment_type, fare)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [manifest_id, i + 1, p.dni, p.name, p.origin || 'Juli', p.dest || 'Puno', p.seat, p.pay || 'cash', parseFloat(p.fare) || 7.00]);
    }

    // 3. Actualizar totales y cerrar manifiesto
    const totalPassengers   = passengers.length;
    const cashPassengers    = passengers.filter(p => p.pay === 'cash').length;
    const digitalPassengers = passengers.filter(p => p.pay !== 'cash').length;
    const totalCash         = passengers.filter(p => p.pay === 'cash').reduce((s, p) => s + parseFloat(p.fare), 0);
    const totalDigital      = passengers.filter(p => p.pay !== 'cash').reduce((s, p) => s + parseFloat(p.fare), 0);
    const totalRevenue      = totalCash + totalDigital;

    await client.query(`
      UPDATE manifests SET
        total_passengers   = $1,
        cash_passengers    = $2,
        digital_passengers = $3,
        total_cash         = $4,
        total_digital      = $5,
        total_revenue      = $6,
        status             = 'closed',
        closed_at          = NOW(),
        updated_at         = NOW()
      WHERE id = $7
    `, [totalPassengers, cashPassengers, digitalPassengers, totalCash, totalDigital, totalRevenue, manifest_id]);

    // 4. Crear viaje activo (conductor en ruta — se completa cuando llega)
    const tRes = await client.query(`
      INSERT INTO trips (vehicle_id, driver_id, route_id, manifest_id, start_time, status, revenue)
      VALUES ($1, $2, $3, $4, $5, 'active', $6)
      RETURNING id
    `, [vehicle_id, driver_id, route_id, manifest_id, depTime, totalRevenue]);
    const trip_id = tRes.rows[0].id;

    await client.query('COMMIT');

    console.log('[manifests/complete] Guardado OK — manifest_id:', manifest_id, 'trip_id:', trip_id, 'pasajeros:', totalPassengers);
    res.status(201).json({ ok: true, manifest_id, trip_id, manifest_number, total_passengers: totalPassengers, total_revenue: totalRevenue });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[manifests/complete]', err.message);
    res.status(500).json({ error: 'Error al guardar manifiesto: ' + err.message });
  } finally {
    client.release();
  }
});

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
             v.plate, v.association_code, r.name as route_name,
             c.name as company_name
      FROM manifests m
      JOIN drivers d  ON m.driver_id  = d.id
      LEFT JOIN vehicles v  ON m.vehicle_id = v.id
      LEFT JOIN companies c ON v.company_id  = c.id
      JOIN routes r   ON m.route_id   = r.id
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
      JOIN drivers d       ON m.driver_id  = d.id
      LEFT JOIN vehicles v ON m.vehicle_id = v.id
      JOIN routes r        ON m.route_id   = r.id
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
      JOIN drivers d       ON m.driver_id  = d.id
      LEFT JOIN vehicles v ON m.vehicle_id = v.id
      JOIN routes r        ON m.route_id   = r.id
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
