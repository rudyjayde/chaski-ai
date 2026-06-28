// ============================================================
// CHASKI AI 2.0 — Conductores
// GET  /api/drivers           → lista completa
// POST /api/drivers           → registrar conductor + crear cuenta
// PUT  /api/drivers/:id       → editar datos
// PUT  /api/drivers/:id/vehicle → asignar vehículo por código
// PUT  /api/drivers/:id/password → cambiar contraseña
// DELETE /api/drivers/:id     → desactivar
// ============================================================
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const pool    = require('../config/db');

// ── GET /api/drivers ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.id, d.first_name, d.last_name, d.dni, d.phone,
             d.license_number, d.active,
             c.id   AS company_id,
             c.name AS company,
             v.id   AS vehicle_id,
             v.association_code AS vehicle_code,
             v.plate AS vehicle_plate,
             u.id       AS user_id,
             u.username,
             u.active   AS account_active,
             u.last_login
      FROM drivers d
      LEFT JOIN companies c ON c.id = d.company_id
      LEFT JOIN vehicles  v ON v.id = d.vehicle_id
      LEFT JOIN users     u ON u.id = d.user_id
      WHERE d.active = true
      ORDER BY d.last_name, d.first_name
    `);
    res.json({ ok: true, drivers: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/drivers ─────────────────────────────────────────
// Crea cuenta de usuario + perfil de conductor
router.post('/', async (req, res) => {
  const {
    first_name, last_name, dni, phone,
    license_number, company_id,
    vehicle_code,
    password,
  } = req.body;

  if (!first_name || !last_name || !dni || !password) {
    return res.status(400).json({ error: 'Nombre, apellido, DNI y contraseña son obligatorios' });
  }

  // Generar username: eloy.mamani.quispe → eloy.mamani
  const rawUser = `${first_name.trim().split(' ')[0]}.${last_name.trim().split(' ')[0]}`
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar DNI único
    const dupDni = await client.query('SELECT id FROM drivers WHERE dni = $1', [dni]);
    if (dupDni.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Ya existe un conductor con DNI ${dni}` });
    }

    // Generar username único (añadir sufijo si existe)
    let username = rawUser;
    let suffix   = 1;
    while (true) {
      const dupUser = await client.query('SELECT id FROM users WHERE username = $1', [username]);
      if (!dupUser.rows.length) break;
      username = `${rawUser}${suffix++}`;
    }

    // Crear usuario
    const hash    = await bcrypt.hash(password, 10);
    const userRes = await client.query(`
      INSERT INTO users (username, password_hash, role, association_id, active)
      VALUES ($1, $2, 'driver',
        (SELECT id FROM associations LIMIT 1),
        true)
      RETURNING id, username
    `, [username, hash]);
    const userId = userRes.rows[0].id;

    // Resolver vehículo por código
    let vehicleId = null;
    if (vehicle_code) {
      const code  = String(vehicle_code).padStart(3, '0');
      const vRes  = await client.query(
        'SELECT id FROM vehicles WHERE association_code = $1 AND active = true LIMIT 1', [code]
      );
      if (!vRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Vehículo con código ${code} no encontrado` });
      }
      vehicleId = vRes.rows[0].id;

      // Desasignar conductor previo del vehículo
      await client.query(
        'UPDATE drivers SET vehicle_id = NULL WHERE vehicle_id = $1', [vehicleId]
      );
    }

    // Crear conductor
    const driverRes = await client.query(`
      INSERT INTO drivers
        (first_name, last_name, dni, phone, license_number, company_id, vehicle_id, user_id, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING id, first_name, last_name
    `, [
      first_name.trim(), last_name.trim(), dni.trim(),
      phone || null, license_number || null,
      company_id || null, vehicleId, userId,
    ]);

    await client.query('COMMIT');
    res.status(201).json({
      ok: true,
      driver: { ...driverRes.rows[0], username },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /drivers]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

// ── PUT /api/drivers/:id ──────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { first_name, last_name, phone, license_number, company_id } = req.body;
  try {
    await pool.query(`
      UPDATE drivers
      SET first_name      = COALESCE($1, first_name),
          last_name       = COALESCE($2, last_name),
          phone           = $3,
          license_number  = $4,
          company_id      = COALESCE($5, company_id)
      WHERE id = $6
    `, [first_name || null, last_name || null, phone || null,
        license_number || null, company_id || null, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── PUT /api/drivers/:id/vehicle ──────────────────────────────
router.put('/:id/vehicle', async (req, res) => {
  const { vehicle_code } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (!vehicle_code) {
      // Desasignar
      await client.query('UPDATE drivers SET vehicle_id = NULL WHERE id = $1', [req.params.id]);
      await client.query('COMMIT');
      return res.json({ ok: true, message: 'Vehículo desasignado' });
    }

    const code = String(vehicle_code).padStart(3, '0');
    const vRes = await client.query(
      'SELECT id FROM vehicles WHERE association_code = $1 AND active = true LIMIT 1', [code]
    );
    if (!vRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Vehículo ${code} no encontrado` });
    }
    const vehicleId = vRes.rows[0].id;

    // Quitar conductor previo del vehículo
    await client.query('UPDATE drivers SET vehicle_id = NULL WHERE vehicle_id = $1 AND id != $2',
      [vehicleId, req.params.id]);

    await client.query('UPDATE drivers SET vehicle_id = $1 WHERE id = $2',
      [vehicleId, req.params.id]);

    await client.query('COMMIT');
    res.json({ ok: true, vehicle_code: code });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

// ── PUT /api/drivers/:id/password ─────────────────────────────
router.put('/:id/password', async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  try {
    const dRes = await pool.query('SELECT user_id FROM drivers WHERE id = $1', [req.params.id]);
    if (!dRes.rows.length) return res.status(404).json({ error: 'Conductor no encontrado' });

    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2',
      [hash, dRes.rows[0].user_id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── DELETE /api/drivers/:id ───────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('UPDATE drivers SET active = false WHERE id = $1', [req.params.id]);
    await pool.query(`
      UPDATE users SET active = false
      WHERE id = (SELECT user_id FROM drivers WHERE id = $1)
    `, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
