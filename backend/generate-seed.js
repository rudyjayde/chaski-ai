// generate-seed.js — writes database/seed.sql
const fs = require('fs');
const path = require('path');

// Real company names as they exist in the DB
const COMPANIES = [
  'Emp. Transp. Virgen de Fátima',
  'Emp. Transp. Surandino',
  'Emp. Transp. San Francisco de Borja',
  'Emp. Transp. Virgen de Fátima II',
  'Emp. Transp. San Miguel',
];

// 12 drivers used for the fleet grid in vehicles.js
const FLEET_DRIVERS = [
  'Eloy Mamani',
  'José Quispe',
  'Abraham Morales',
  'Juan Pérez',
  'Carlos Ticona',
  'Roberto Flores',
  'Marcos Huanca',
  'David Condori',
  'Felipe Apaza',
  'Héctor Larico',
  'Víctor Limachi',
  'Arturo Ccama',
];

// 20 drivers from drivers.js DRIVER_NAMES_20
const DRIVER_NAMES_20 = [
  'Eloy Mamani Quispe',
  'José Quispe Huanca',
  'Abraham Morales Apaza',
  'Juan Pérez Ccama',
  'Carlos Ticona Larico',
  'Roberto Flores Limachi',
  'Marcos Huanca Condori',
  'David Condori Mamani',
  'Felipe Apaza Torres',
  'Héctor Larico Soncco',
  'Víctor Limachi Calla',
  'Arturo Ccama Pari',
  'Pedro Soncco Quispe',
  'Miguel Torres Apaza',
  'Luis Calla Mamani',
  'Antonio Pari Huanca',
  'Raúl Quispe Flores',
  'Jorge Mamani Ticona',
  'Fernando Apaza Condori',
  'Ernesto Huanca Larico',
];

// DNI formula from drivers.js
function dni(i) {
  return 20000000 + ((i * 1234567) % 70000000);
}

// Username formula from drivers.js
function username(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '.');
}

// Company index for a given vehicle number (1-based), 2-per-company cycling
function companyIdx(vehicleNum) {
  return Math.floor((vehicleNum - 1) / 2) % 5;
}

// Fleet driver index for a given vehicle number (1-based) and company index
// dIdx = (v + ci * 2) % 12, where v = local index within company group
function fleetDriverIdx(vehicleNum, ci) {
  const v = (vehicleNum - 1) % 2; // 0 or 1 within the company pair
  return (v + ci * 2) % 12;
}

// bcrypt hash of 'admin123' (pre-computed)
const HASH = '$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu';

const lines = [];

lines.push('-- ============================================================');
lines.push('-- CHASKI AI 2.0 — Seed de sincronización frontend↔BD');
lines.push(`-- Generado: ${new Date().toISOString()}`);
lines.push('-- ============================================================');
lines.push('');
lines.push('BEGIN;');
lines.push('');

// ── 1. Las empresas ya existen — solo verificar ──────────────────────────
lines.push('-- 1. Verificar empresas existentes (no se insertan, ya existen)');
lines.push(`SELECT name, code FROM companies ORDER BY code;`);
lines.push('');

// ── 2. Actualizar conductores 1-5 con asignaciones correctas ─────────────
// Correct mapping from index.js VEHICLES_DB:
// 001 → Eloy Mamani     / Virgen de Fátima   (company 0)
// 002 → José Quispe     / Virgen de Fátima   (company 0)
// 003 → Abraham Morales / Surandino          (company 1)
// 004 → Juan Pérez      / Surandino          (company 1)
// 005 → Carlos Ticona   / San Francisco      (company 2)
lines.push('-- 2. Reasignar conductores 1-5 al vehículo correcto');
lines.push(`-- Primero, desasociar todos los vehículos de los conductores 1-5`);
lines.push(`UPDATE drivers SET vehicle_id = NULL WHERE id IN (
  SELECT id FROM drivers ORDER BY id LIMIT 5
);`);
lines.push('');

// Now assign each driver to the correct vehicle by association_code
const correctAssignments = [
  { code: '001', firstName: 'Eloy',     lastName: 'Mamani',  company: 'Emp. Transp. Virgen de Fátima' },
  { code: '002', firstName: 'José',     lastName: 'Quispe',  company: 'Emp. Transp. Virgen de Fátima' },
  { code: '003', firstName: 'Abraham',  lastName: 'Morales', company: 'Emp. Transp. Surandino' },
  { code: '004', firstName: 'Juan',     lastName: 'Pérez',   company: 'Emp. Transp. Surandino' },
  { code: '005', firstName: 'Carlos',   lastName: 'Ticona',  company: 'Emp. Transp. San Francisco de Borja' },
];

correctAssignments.forEach(({ code, firstName, lastName, company }) => {
  lines.push(`UPDATE drivers`);
  lines.push(`  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '${code}' AND active = true LIMIT 1),`);
  lines.push(`      company_id = (SELECT id FROM companies WHERE name = '${company}' LIMIT 1)`);
  lines.push(`  WHERE LOWER(first_name) ILIKE '${firstName.toLowerCase()}%'`);
  lines.push(`    AND LOWER(last_name)  ILIKE '${lastName.toLowerCase()}%';`);
  lines.push('');
});

// ── 3. Insertar vehículos 006–060 ────────────────────────────────────────
lines.push('-- 3. Vehículos 006–060');
for (let n = 6; n <= 60; n++) {
  const code  = String(n).padStart(3, '0');
  const plate = `PUN-${code}`;
  const ci    = companyIdx(n);
  lines.push(`INSERT INTO vehicles (association_code, plate, company_id, status, active)`);
  lines.push(`  VALUES (`);
  lines.push(`    '${code}', '${plate}',`);
  lines.push(`    (SELECT id FROM companies WHERE name = '${COMPANIES[ci]}' LIMIT 1),`);
  lines.push(`    'active', true`);
  lines.push(`  ) ON CONFLICT (plate) DO UPDATE SET`);
  lines.push(`    company_id = EXCLUDED.company_id,`);
  lines.push(`    status     = EXCLUDED.status,`);
  lines.push(`    active     = EXCLUDED.active;`);
}
lines.push('');

// ── 4. Insertar usuarios y conductores 6–20 ──────────────────────────────
lines.push('-- 4. Usuarios y conductores 6–20');
for (let i = 5; i < 20; i++) {
  const fullName  = DRIVER_NAMES_20[i];
  const parts     = fullName.split(' ');
  const firstName = parts[0];
  const lastName  = parts.slice(1).join(' ');
  const uname     = username(fullName);
  const d         = dni(i);
  const ci        = i % 5;
  const company   = COMPANIES[ci];

  lines.push(`-- Driver ${i + 1}: ${fullName}`);

  // Insert user first
  lines.push(`INSERT INTO users (username, password_hash, role, active)`);
  lines.push(`  VALUES ('${uname}', '${HASH}', 'driver', true)`);
  lines.push(`  ON CONFLICT (username) DO NOTHING;`);

  // Then insert driver linked to that user
  lines.push(`INSERT INTO drivers`);
  lines.push(`  (first_name, last_name, dni, phone, company_id, user_id, active)`);
  lines.push(`SELECT`);
  lines.push(`  '${firstName}', '${lastName.replace(/'/g, "''")}', '${d}',`);
  lines.push(`  '95${String(d).slice(-7)}',`);
  lines.push(`  (SELECT id FROM companies WHERE name = '${company}' LIMIT 1),`);
  lines.push(`  (SELECT id FROM users WHERE username = '${uname}' LIMIT 1),`);
  lines.push(`  true`);
  lines.push(`WHERE NOT EXISTS (`);
  lines.push(`  SELECT 1 FROM drivers WHERE dni = '${d}'`);
  lines.push(`);`);
  lines.push('');
}

// ── 5. Asignar conductores 6–20 a vehículos 006–060 ─────────────────────
lines.push('-- 5. Asignar conductores 6–20 a vehículos 006–020 (uno por vehículo)');
for (let i = 5; i < 20; i++) {
  const fullName  = DRIVER_NAMES_20[i];
  const parts     = fullName.split(' ');
  const firstName = parts[0];
  const lastName  = parts.slice(1).join(' ');
  const vehicleN  = i + 1; // driver 6 → vehicle 006, etc.
  const code      = String(vehicleN).padStart(3, '0');

  lines.push(`UPDATE drivers`);
  lines.push(`  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '${code}' AND active = true LIMIT 1)`);
  lines.push(`  WHERE LOWER(first_name) ILIKE '${firstName.toLowerCase()}%'`);
  lines.push(`    AND LOWER(last_name)  ILIKE '${lastName.toLowerCase().replace(/'/g, "''")}%'`);
  lines.push(`    AND vehicle_id IS NULL;`);
}
lines.push('');

lines.push('COMMIT;');
lines.push('');
lines.push('-- Verificación post-seed');
lines.push(`SELECT v.association_code, v.plate,`);
lines.push(`       d.first_name || ' ' || d.last_name AS conductor,`);
lines.push(`       c.name AS empresa`);
lines.push(`FROM vehicles v`);
lines.push(`LEFT JOIN drivers d ON d.vehicle_id = v.id`);
lines.push(`LEFT JOIN companies c ON c.id = v.company_id`);
lines.push(`ORDER BY v.association_code`);
lines.push(`LIMIT 25;`);

const outPath = path.join(__dirname, '..', 'database', 'seed.sql');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`✓ Seed generado en ${outPath}`);
console.log(`  Líneas: ${lines.length}`);
