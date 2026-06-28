// ============================================================
// CHASKI AI 2.0 — Vehículos
// GET    /api/vehicles           → lista completa
// GET    /api/vehicles/:id       → detalle
// POST   /api/vehicles           → registrar
// PUT    /api/vehicles/:id       → editar
// DELETE /api/vehicles/:id       → desactivar
// PUT    /api/vehicles/:id/gps   → asignar GPS
// GET    /api/companies          → lista de empresas
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

// ── GET /api/companies ───────────────────────────────────────
router.get('/companies', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, code FROM companies ORDER BY name'
    );
    res.json({ ok: true, companies: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/vehicles ────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.id, v.association_code AS code, v.plate, v.brand, v.model,
             v.year, v.capacity, v.status, v.active, v.gps_device_id,
             COALESCE(d.first_name || ' ' || d.last_name, 'Sin conductor') AS driver_name,
             d.phone AS driver_phone,
             c.id    AS company_id,
             c.name  AS company,
             (
               SELECT recorded_at FROM gps_positions
               WHERE vehicle_id = v.id
               ORDER BY recorded_at DESC LIMIT 1
             ) AS last_gps_ping
      FROM vehicles v
      LEFT JOIN drivers   d ON d.vehicle_id = v.id
      LEFT JOIN companies c ON c.id = v.company_id
      WHERE v.active = true
      ORDER BY v.association_code
    `);
    res.json({ ok: true, vehicles: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/vehicles/:id ─────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.*, c.name AS company, c.id AS company_id,
             COALESCE(d.first_name || ' ' || d.last_name, 'Sin conductor') AS driver_name
      FROM vehicles v
      LEFT JOIN companies c ON c.id = v.company_id
      LEFT JOIN drivers   d ON d.vehicle_id = v.id
      WHERE v.id = $1
    `, [req.params.id]);

    if (!result.rows.length) return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json({ ok: true, vehicle: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/vehicles ────────────────────────────────────────
router.post('/', async (req, res) => {
  const { association_code, plate, company_id, brand, model, year, capacity, status } = req.body;

  if (!association_code || !plate || !company_id) {
    return res.status(400).json({ error: 'Código, placa y empresa son obligatorios' });
  }

  // Validar código único (solo dígitos, pad 3)
  const code = String(association_code).padStart(3, '0');

  try {
    // Verificar duplicados
    const dup = await pool.query(
      'SELECT id FROM vehicles WHERE association_code = $1 AND active = true', [code]
    );
    if (dup.rows.length) return res.status(409).json({ error: `Ya existe un vehículo con código ${code}` });

    const plateDup = await pool.query(
      'SELECT id FROM vehicles WHERE plate = $1 AND active = true', [plate.toUpperCase()]
    );
    if (plateDup.rows.length) return res.status(409).json({ error: `La placa ${plate.toUpperCase()} ya está registrada` });

    const result = await pool.query(`
      INSERT INTO vehicles (association_code, plate, company_id, brand, model, year, capacity, status, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING id, association_code AS code, plate
    `, [
      code,
      plate.toUpperCase(),
      company_id,
      brand  || null,
      model  || null,
      year   || null,
      capacity || null,
      status || 'waiting',
    ]);

    res.status(201).json({ ok: true, vehicle: result.rows[0] });
  } catch (err) {
    console.error('[POST /vehicles]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── PUT /api/vehicles/:id ─────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { plate, company_id, brand, model, year, capacity, status } = req.body;

  try {
    await pool.query(`
      UPDATE vehicles
      SET plate      = COALESCE($1, plate),
          company_id = COALESCE($2, company_id),
          brand      = $3,
          model      = $4,
          year       = $5,
          capacity   = $6,
          status     = COALESCE($7, status),
          updated_at = NOW()
      WHERE id = $8
    `, [
      plate?.toUpperCase() || null,
      company_id || null,
      brand  || null,
      model  || null,
      year   || null,
      capacity || null,
      status || null,
      req.params.id,
    ]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── DELETE /api/vehicles/:id ──────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      'UPDATE vehicles SET active = false, updated_at = NOW() WHERE id = $1',
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── PUT /api/vehicles/:id/gps ─────────────────────────────────
router.put('/:id/gps', async (req, res) => {
  const { gps_device_id } = req.body;
  if (!gps_device_id) return res.status(400).json({ error: 'gps_device_id requerido' });

  try {
    await pool.query(
      'UPDATE vehicles SET gps_device_id = $1, updated_at = NOW() WHERE id = $2',
      [gps_device_id, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
