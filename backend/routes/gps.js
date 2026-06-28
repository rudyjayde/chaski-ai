// ============================================================
// CHASKI AI 2.0 — Rutas GPS (integración Traccar)
// GET /api/gps/live          → posiciones actuales desde Traccar
// GET /api/gps/history/:id   → historial de un vehículo (hoy)
// POST /api/gps/simulate     → inyectar posición de prueba
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

// ── Helper: llamar a la API de Traccar ───────────────────────
async function traccarFetch(path) {
  const base = process.env.TRACCAR_URL || 'http://147.182.187.28:8082';
  const user = process.env.TRACCAR_USER;
  const pass = process.env.TRACCAR_PASS;
  const auth = Buffer.from(`${user}:${pass}`).toString('base64');

  const res = await fetch(`${base}/api${path}`, {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) throw new Error(`Traccar ${res.status}: ${path}`);
  return res.json();
}

// ── GET /api/gps/live ────────────────────────────────────────
router.get('/live', async (req, res) => {
  try {
    // 1. Pedir dispositivos y posiciones a Traccar en paralelo
    const [traccarDevices, traccarPositions] = await Promise.all([
      traccarFetch('/devices'),
      traccarFetch('/positions'),
    ]);

    // 2. Mapa positionId → posición
    const posMap = {};
    for (const p of traccarPositions) {
      posMap[p.deviceId] = p;
    }

    // 3. Vehículos con GPS asignado desde nuestra BD
    const dbRes = await pool.query(`
      SELECT v.id   AS vehicle_id,
             v.association_code AS code,
             v.plate,
             gd.imei,
             COALESCE(d.first_name || ' ' || d.last_name, 'Sin conductor') AS driver
      FROM vehicles v
      JOIN gps_devices gd ON gd.vehicle_id = v.id
      LEFT JOIN drivers d ON d.vehicle_id = v.id
      WHERE v.active = true AND gd.active = true
    `);

    // 4. IMEI → datos de vehículo
    const imeiMap = {};
    for (const row of dbRes.rows) {
      imeiMap[row.imei] = row;
    }

    // 5. Combinar Traccar + BD
    const vehicles = [];

    for (const device of traccarDevices) {
      const pos = posMap[device.id];
      if (!pos || !pos.latitude) continue;

      // Traccar devuelve velocidad en nudos → convertir a km/h
      const speedKmh = Math.round((pos.speed || 0) * 1.852);
      const dbVehicle = imeiMap[device.uniqueId];

      vehicles.push({
        vehicle_id: dbVehicle?.vehicle_id || null,
        code:       dbVehicle?.code       || device.name,
        plate:      dbVehicle?.plate      || device.uniqueId,
        driver:     dbVehicle?.driver     || 'Sin asignar',
        gps_device_id: device.uniqueId,
        lat:        pos.latitude,
        lon:        pos.longitude,
        speed:      speedKmh,
        heading:    pos.course  || 0,
        satellites: pos.attributes?.sat || 0,
        timestamp:  pos.deviceTime || pos.serverTime,
        has_gps:    true,
        traccar_status: device.status,
      });

      // 6. Guardar en gps_positions solo si pasaron >25s desde el último registro
      if (dbVehicle?.vehicle_id) {
        pool.query(
          `INSERT INTO gps_positions
             (vehicle_id, latitude, longitude, speed, heading, device_id, recorded_at)
           SELECT $1, $2, $3, $4, $5, $6, NOW()
           WHERE NOT EXISTS (
             SELECT 1 FROM gps_positions
             WHERE vehicle_id = $1
               AND recorded_at > NOW() - INTERVAL '25 seconds'
           )`,
          [dbVehicle.vehicle_id, pos.latitude, pos.longitude,
           speedKmh, pos.course || 0, device.uniqueId]
        ).catch(() => {});
      }
    }

    res.json({ ok: true, vehicles });

  } catch (err) {
    console.error('[GPS /live Traccar]', err.message);

    // Fallback: leer desde nuestra BD si Traccar no responde
    try {
      const result = await pool.query(`
        SELECT DISTINCT ON (v.id)
          v.id          AS vehicle_id,
          v.association_code AS code,
          v.plate,
          v.gps_device_id,
          COALESCE(d.first_name || ' ' || d.last_name, 'Sin conductor') AS driver,
          p.latitude    AS lat,
          p.longitude   AS lon,
          p.speed,
          p.heading,
          p.satellites,
          p.recorded_at AS timestamp
        FROM vehicles v
        LEFT JOIN drivers d ON d.vehicle_id = v.id
        LEFT JOIN gps_positions p ON p.vehicle_id = v.id
        WHERE v.active = true
        ORDER BY v.id, p.recorded_at DESC
      `);

      const vehicles = result.rows.map(r => ({
        vehicle_id:    r.vehicle_id,
        code:          r.code,
        plate:         r.plate,
        driver:        r.driver,
        gps_device_id: r.gps_device_id,
        lat:           r.lat   ? parseFloat(r.lat)   : null,
        lon:           r.lon   ? parseFloat(r.lon)   : null,
        speed:         r.speed ? parseFloat(r.speed) : 0,
        heading:       r.heading ? parseFloat(r.heading) : 0,
        satellites:    r.satellites || 0,
        timestamp:     r.timestamp || null,
        has_gps:       r.lat !== null,
      }));

      res.json({ ok: true, vehicles, source: 'db_fallback' });
    } catch (dbErr) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }
});

// ── GET /api/gps/history/:vehicleId ─────────────────────────
router.get('/history/:vehicleId', async (req, res) => {
  const { vehicleId } = req.params;
  try {
    const result = await pool.query(`
      SELECT latitude AS lat, longitude AS lon, speed,
             heading, recorded_at AS timestamp
      FROM gps_positions
      WHERE vehicle_id = $1
        AND recorded_at >= CURRENT_DATE
      ORDER BY recorded_at DESC
      LIMIT 200
    `, [vehicleId]);

    res.json({ ok: true, positions: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/gps/simulate ───────────────────────────────────
router.post('/simulate', async (req, res) => {
  const { device_id, lat, lon, speed = 0, heading = 0 } = req.body;
  if (!device_id || !lat || !lon) {
    return res.status(400).json({ error: 'Se requieren device_id, lat y lon' });
  }

  try {
    const vRes = await pool.query(
      'SELECT id FROM vehicles WHERE gps_device_id = $1 LIMIT 1',
      [device_id]
    );
    if (!vRes.rows.length) {
      return res.status(404).json({ error: `No hay vehículo con gps_device_id = ${device_id}` });
    }

    await pool.query(
      `INSERT INTO gps_positions (vehicle_id, latitude, longitude, speed, heading, device_id, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [vRes.rows[0].id, lat, lon, speed, heading, device_id]
    );

    res.json({ ok: true, message: 'Posición simulada insertada' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
