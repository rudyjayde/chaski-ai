// ============================================================
// CHASKI AI 2.0 — Gestión de Dispositivos GPS
// GET    /api/gps-devices          → listar todos
// POST   /api/gps-devices          → registrar nuevo
// PUT    /api/gps-devices/:id      → editar
// PUT    /api/gps-devices/:id/assign → asignar a vehículo por código
// DELETE /api/gps-devices/:id      → eliminar
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

async function traccarFetch(path) {
  const base = process.env.TRACCAR_URL || 'http://147.182.187.28:8082';
  const auth = Buffer.from(`${process.env.TRACCAR_USER}:${process.env.TRACCAR_PASS}`).toString('base64');
  const res  = await fetch(`${base}/api${path}`, {
    headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Traccar ${res.status}`);
  return res.json();
}

// ── GET /api/gps-devices ─────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        d.id, d.imei, d.alias, d.model, d.sim_number,
        d.notes, d.active, d.registered_at,
        v.id             AS vehicle_id,
        v.association_code AS vehicle_code,
        v.plate          AS vehicle_plate,
        COALESCE(dr.first_name || ' ' || dr.last_name, 'Sin conductor') AS driver_name,
        (
          SELECT recorded_at FROM gps_positions
          WHERE device_id = d.imei
          ORDER BY recorded_at DESC LIMIT 1
        ) AS last_ping,
        (
          SELECT speed FROM gps_positions
          WHERE device_id = d.imei
          ORDER BY recorded_at DESC LIMIT 1
        ) AS last_speed
      FROM gps_devices d
      LEFT JOIN vehicles v  ON v.id = d.vehicle_id
      LEFT JOIN drivers  dr ON dr.vehicle_id = v.id
      ORDER BY d.registered_at DESC
    `);

    // Consultar estado real de Traccar (con fallback si no responde)
    let traccarMap = {};
    try {
      const [tDevices, tPositions] = await Promise.all([
        traccarFetch('/devices'),
        traccarFetch('/positions'),
      ]);
      const posMap = {};
      for (const p of tPositions) posMap[p.deviceId] = p;
      for (const d of tDevices) {
        const pos = posMap[d.id];
        traccarMap[d.uniqueId] = {
          online:    d.status === 'online',
          lastUpdate: pos?.deviceTime || pos?.serverTime || d.lastUpdate,
          speed:     pos ? Math.round((pos.speed || 0) * 1.852) : 0,
        };
      }
    } catch (_) { /* Traccar no disponible, usamos BD */ }

    const now = new Date();
    const devices = result.rows.map(r => {
      let status   = 'sin_asignar';
      let lastPing = r.last_ping;
      let lastSpeed = r.last_speed;

      if (r.vehicle_id) {
        const t = traccarMap[r.imei];
        if (t) {
          status    = t.online ? 'online' : 'offline';
          lastPing  = t.lastUpdate || r.last_ping;
          lastSpeed = t.speed ?? r.last_speed;
        } else if (r.last_ping) {
          const diffMin = (now - new Date(r.last_ping)) / 60000;
          status = diffMin < 5 ? 'online' : diffMin < 60 ? 'reciente' : 'offline';
        } else {
          status = 'sin_señal';
        }
      }
      return { ...r, status, last_ping: lastPing, last_speed: lastSpeed };
    });

    res.json({ ok: true, devices });
  } catch (err) {
    console.error('[gps-devices GET]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/gps-devices ─────────────────────────────────────
router.post('/', async (req, res) => {
  const { imei, alias, model, sim_number, notes } = req.body;
  if (!imei) return res.status(400).json({ error: 'El IMEI es requerido' });

  try {
    const result = await pool.query(
      `INSERT INTO gps_devices (imei, alias, model, sim_number, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [imei.trim(), alias || null, model || 'Teltonika FMC130', sim_number || null, notes || null]
    );
    res.status(201).json({ ok: true, device: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: `El IMEI ${imei} ya está registrado` });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── PUT /api/gps-devices/:id ──────────────────────────────────
router.put('/:id', async (req, res) => {
  const { imei, alias, model, sim_number, notes, active } = req.body;
  try {
    await pool.query(
      `UPDATE gps_devices
       SET imei=$1, alias=$2, model=$3, sim_number=$4, notes=$5,
           active=$6, updated_at=NOW()
       WHERE id=$7`,
      [imei, alias, model, sim_number, notes, active ?? true, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'IMEI duplicado' });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── PUT /api/gps-devices/:id/assign ──────────────────────────
// Asigna un dispositivo a un vehículo por su código (ej: "001")
router.put('/:id/assign', async (req, res) => {
  const { vehicle_code } = req.body;

  try {
    // Si vehicle_code es null o vacío → desasignar
    if (!vehicle_code) {
      const cur = await pool.query('SELECT vehicle_id, imei FROM gps_devices WHERE id=$1', [req.params.id]);
      if (cur.rows[0]?.vehicle_id) {
        await pool.query('UPDATE vehicles SET gps_device_id=NULL, updated_at=NOW() WHERE id=$1', [cur.rows[0].vehicle_id]);
      }
      await pool.query('UPDATE gps_devices SET vehicle_id=NULL, updated_at=NOW() WHERE id=$1', [req.params.id]);
      return res.json({ ok: true, message: 'Dispositivo desasignado' });
    }

    // Buscar vehículo por código
    const vRes = await pool.query(
      'SELECT id, plate FROM vehicles WHERE association_code=$1 AND active=true LIMIT 1',
      [vehicle_code.toString().padStart(3, '0')]
    );
    if (!vRes.rows.length) {
      return res.status(404).json({ error: `No existe el vehículo con código ${vehicle_code}` });
    }
    const vehicle = vRes.rows[0];

    // Verificar que ese vehículo no tenga ya otro GPS
    const existingGps = await pool.query(
      'SELECT id, imei FROM gps_devices WHERE vehicle_id=$1 AND id!=$2 LIMIT 1',
      [vehicle.id, req.params.id]
    );
    if (existingGps.rows.length) {
      return res.status(409).json({
        error: `El vehículo ${vehicle_code} ya tiene asignado el GPS IMEI ${existingGps.rows[0].imei}. Desasígnalo primero.`
      });
    }

    // Obtener IMEI del dispositivo
    const devRes = await pool.query('SELECT imei FROM gps_devices WHERE id=$1', [req.params.id]);
    if (!devRes.rows.length) return res.status(404).json({ error: 'Dispositivo no encontrado' });
    const imei = devRes.rows[0].imei;

    // Actualizar ambas tablas
    await pool.query('UPDATE gps_devices SET vehicle_id=$1, updated_at=NOW() WHERE id=$2', [vehicle.id, req.params.id]);
    await pool.query('UPDATE vehicles SET gps_device_id=$1, updated_at=NOW() WHERE id=$2', [imei, vehicle.id]);

    res.json({ ok: true, message: `GPS asignado a vehículo ${vehicle_code} (${vehicle.plate})` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── DELETE /api/gps-devices/:id ───────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    // Limpiar referencia en vehicles
    const dev = await pool.query('SELECT vehicle_id FROM gps_devices WHERE id=$1', [req.params.id]);
    if (dev.rows[0]?.vehicle_id) {
      await pool.query('UPDATE vehicles SET gps_device_id=NULL WHERE id=$1', [dev.rows[0].vehicle_id]);
    }
    await pool.query('DELETE FROM gps_devices WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
