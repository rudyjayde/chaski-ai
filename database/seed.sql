-- ============================================================
-- CHASKI AI 2.0 — Seed de sincronización frontend↔BD
-- Generado: 2026-05-09T20:30:54.386Z
-- ============================================================

BEGIN;

-- 1. Verificar empresas existentes (no se insertan, ya existen)
SELECT name, code FROM companies ORDER BY code;

-- 2. Reasignar conductores 1-5 al vehículo correcto
-- Primero, desasociar todos los vehículos de los conductores 1-5
UPDATE drivers SET vehicle_id = NULL WHERE id IN (
  SELECT id FROM drivers ORDER BY id LIMIT 5
);

UPDATE drivers
  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '001' AND active = true LIMIT 1),
      company_id = (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima' LIMIT 1)
  WHERE LOWER(first_name) ILIKE 'eloy%'
    AND LOWER(last_name)  ILIKE 'mamani%';

UPDATE drivers
  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '002' AND active = true LIMIT 1),
      company_id = (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima' LIMIT 1)
  WHERE LOWER(first_name) ILIKE 'josé%'
    AND LOWER(last_name)  ILIKE 'quispe%';

UPDATE drivers
  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '003' AND active = true LIMIT 1),
      company_id = (SELECT id FROM companies WHERE name = 'Emp. Transp. Surandino' LIMIT 1)
  WHERE LOWER(first_name) ILIKE 'abraham%'
    AND LOWER(last_name)  ILIKE 'morales%';

UPDATE drivers
  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '004' AND active = true LIMIT 1),
      company_id = (SELECT id FROM companies WHERE name = 'Emp. Transp. Surandino' LIMIT 1)
  WHERE LOWER(first_name) ILIKE 'juan%'
    AND LOWER(last_name)  ILIKE 'pérez%';

UPDATE drivers
  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '005' AND active = true LIMIT 1),
      company_id = (SELECT id FROM companies WHERE name = 'Emp. Transp. San Francisco de Borja' LIMIT 1)
  WHERE LOWER(first_name) ILIKE 'carlos%'
    AND LOWER(last_name)  ILIKE 'ticona%';

-- 3. Vehículos 006–060
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '006', 'PUN-006',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Francisco de Borja' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '007', 'PUN-007',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima II' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '008', 'PUN-008',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima II' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '009', 'PUN-009',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Miguel' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '010', 'PUN-010',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Miguel' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '011', 'PUN-011',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '012', 'PUN-012',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '013', 'PUN-013',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Surandino' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '014', 'PUN-014',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Surandino' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '015', 'PUN-015',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Francisco de Borja' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '016', 'PUN-016',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Francisco de Borja' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '017', 'PUN-017',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima II' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '018', 'PUN-018',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima II' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '019', 'PUN-019',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Miguel' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '020', 'PUN-020',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Miguel' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '021', 'PUN-021',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '022', 'PUN-022',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '023', 'PUN-023',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Surandino' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '024', 'PUN-024',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Surandino' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '025', 'PUN-025',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Francisco de Borja' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '026', 'PUN-026',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Francisco de Borja' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '027', 'PUN-027',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima II' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '028', 'PUN-028',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima II' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '029', 'PUN-029',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Miguel' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '030', 'PUN-030',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Miguel' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '031', 'PUN-031',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '032', 'PUN-032',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '033', 'PUN-033',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Surandino' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '034', 'PUN-034',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Surandino' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '035', 'PUN-035',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Francisco de Borja' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '036', 'PUN-036',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Francisco de Borja' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '037', 'PUN-037',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima II' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '038', 'PUN-038',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima II' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '039', 'PUN-039',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Miguel' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '040', 'PUN-040',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Miguel' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '041', 'PUN-041',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '042', 'PUN-042',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '043', 'PUN-043',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Surandino' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '044', 'PUN-044',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Surandino' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '045', 'PUN-045',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Francisco de Borja' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '046', 'PUN-046',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Francisco de Borja' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '047', 'PUN-047',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima II' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '048', 'PUN-048',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima II' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '049', 'PUN-049',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Miguel' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '050', 'PUN-050',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Miguel' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '051', 'PUN-051',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '052', 'PUN-052',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '053', 'PUN-053',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Surandino' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '054', 'PUN-054',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Surandino' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '055', 'PUN-055',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Francisco de Borja' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '056', 'PUN-056',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Francisco de Borja' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '057', 'PUN-057',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima II' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '058', 'PUN-058',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima II' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '059', 'PUN-059',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Miguel' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;
INSERT INTO vehicles (association_code, plate, company_id, status, active)
  VALUES (
    '060', 'PUN-060',
    (SELECT id FROM companies WHERE name = 'Emp. Transp. San Miguel' LIMIT 1),
    'active', true
  ) ON CONFLICT (plate) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    status     = EXCLUDED.status,
    active     = EXCLUDED.active;

-- 4. Usuarios y conductores 6–20
-- Driver 6: Roberto Flores Limachi
INSERT INTO users (username, password_hash, role, active)
  VALUES ('roberto.flores.limachi', '$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu', 'driver', true)
  ON CONFLICT (username) DO NOTHING;
INSERT INTO drivers
  (first_name, last_name, dni, phone, company_id, user_id, active)
SELECT
  'Roberto', 'Flores Limachi', '26172835',
  '956172835',
  (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima' LIMIT 1),
  (SELECT id FROM users WHERE username = 'roberto.flores.limachi' LIMIT 1),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM drivers WHERE dni = '26172835'
);

-- Driver 7: Marcos Huanca Condori
INSERT INTO users (username, password_hash, role, active)
  VALUES ('marcos.huanca.condori', '$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu', 'driver', true)
  ON CONFLICT (username) DO NOTHING;
INSERT INTO drivers
  (first_name, last_name, dni, phone, company_id, user_id, active)
SELECT
  'Marcos', 'Huanca Condori', '27407402',
  '957407402',
  (SELECT id FROM companies WHERE name = 'Emp. Transp. Surandino' LIMIT 1),
  (SELECT id FROM users WHERE username = 'marcos.huanca.condori' LIMIT 1),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM drivers WHERE dni = '27407402'
);

-- Driver 8: David Condori Mamani
INSERT INTO users (username, password_hash, role, active)
  VALUES ('david.condori.mamani', '$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu', 'driver', true)
  ON CONFLICT (username) DO NOTHING;
INSERT INTO drivers
  (first_name, last_name, dni, phone, company_id, user_id, active)
SELECT
  'David', 'Condori Mamani', '28641969',
  '958641969',
  (SELECT id FROM companies WHERE name = 'Emp. Transp. San Francisco de Borja' LIMIT 1),
  (SELECT id FROM users WHERE username = 'david.condori.mamani' LIMIT 1),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM drivers WHERE dni = '28641969'
);

-- Driver 9: Felipe Apaza Torres
INSERT INTO users (username, password_hash, role, active)
  VALUES ('felipe.apaza.torres', '$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu', 'driver', true)
  ON CONFLICT (username) DO NOTHING;
INSERT INTO drivers
  (first_name, last_name, dni, phone, company_id, user_id, active)
SELECT
  'Felipe', 'Apaza Torres', '29876536',
  '959876536',
  (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima II' LIMIT 1),
  (SELECT id FROM users WHERE username = 'felipe.apaza.torres' LIMIT 1),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM drivers WHERE dni = '29876536'
);

-- Driver 10: Héctor Larico Soncco
INSERT INTO users (username, password_hash, role, active)
  VALUES ('hector.larico.soncco', '$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu', 'driver', true)
  ON CONFLICT (username) DO NOTHING;
INSERT INTO drivers
  (first_name, last_name, dni, phone, company_id, user_id, active)
SELECT
  'Héctor', 'Larico Soncco', '31111103',
  '951111103',
  (SELECT id FROM companies WHERE name = 'Emp. Transp. San Miguel' LIMIT 1),
  (SELECT id FROM users WHERE username = 'hector.larico.soncco' LIMIT 1),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM drivers WHERE dni = '31111103'
);

-- Driver 11: Víctor Limachi Calla
INSERT INTO users (username, password_hash, role, active)
  VALUES ('victor.limachi.calla', '$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu', 'driver', true)
  ON CONFLICT (username) DO NOTHING;
INSERT INTO drivers
  (first_name, last_name, dni, phone, company_id, user_id, active)
SELECT
  'Víctor', 'Limachi Calla', '32345670',
  '952345670',
  (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima' LIMIT 1),
  (SELECT id FROM users WHERE username = 'victor.limachi.calla' LIMIT 1),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM drivers WHERE dni = '32345670'
);

-- Driver 12: Arturo Ccama Pari
INSERT INTO users (username, password_hash, role, active)
  VALUES ('arturo.ccama.pari', '$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu', 'driver', true)
  ON CONFLICT (username) DO NOTHING;
INSERT INTO drivers
  (first_name, last_name, dni, phone, company_id, user_id, active)
SELECT
  'Arturo', 'Ccama Pari', '33580237',
  '953580237',
  (SELECT id FROM companies WHERE name = 'Emp. Transp. Surandino' LIMIT 1),
  (SELECT id FROM users WHERE username = 'arturo.ccama.pari' LIMIT 1),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM drivers WHERE dni = '33580237'
);

-- Driver 13: Pedro Soncco Quispe
INSERT INTO users (username, password_hash, role, active)
  VALUES ('pedro.soncco.quispe', '$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu', 'driver', true)
  ON CONFLICT (username) DO NOTHING;
INSERT INTO drivers
  (first_name, last_name, dni, phone, company_id, user_id, active)
SELECT
  'Pedro', 'Soncco Quispe', '34814804',
  '954814804',
  (SELECT id FROM companies WHERE name = 'Emp. Transp. San Francisco de Borja' LIMIT 1),
  (SELECT id FROM users WHERE username = 'pedro.soncco.quispe' LIMIT 1),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM drivers WHERE dni = '34814804'
);

-- Driver 14: Miguel Torres Apaza
INSERT INTO users (username, password_hash, role, active)
  VALUES ('miguel.torres.apaza', '$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu', 'driver', true)
  ON CONFLICT (username) DO NOTHING;
INSERT INTO drivers
  (first_name, last_name, dni, phone, company_id, user_id, active)
SELECT
  'Miguel', 'Torres Apaza', '36049371',
  '956049371',
  (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima II' LIMIT 1),
  (SELECT id FROM users WHERE username = 'miguel.torres.apaza' LIMIT 1),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM drivers WHERE dni = '36049371'
);

-- Driver 15: Luis Calla Mamani
INSERT INTO users (username, password_hash, role, active)
  VALUES ('luis.calla.mamani', '$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu', 'driver', true)
  ON CONFLICT (username) DO NOTHING;
INSERT INTO drivers
  (first_name, last_name, dni, phone, company_id, user_id, active)
SELECT
  'Luis', 'Calla Mamani', '37283938',
  '957283938',
  (SELECT id FROM companies WHERE name = 'Emp. Transp. San Miguel' LIMIT 1),
  (SELECT id FROM users WHERE username = 'luis.calla.mamani' LIMIT 1),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM drivers WHERE dni = '37283938'
);

-- Driver 16: Antonio Pari Huanca
INSERT INTO users (username, password_hash, role, active)
  VALUES ('antonio.pari.huanca', '$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu', 'driver', true)
  ON CONFLICT (username) DO NOTHING;
INSERT INTO drivers
  (first_name, last_name, dni, phone, company_id, user_id, active)
SELECT
  'Antonio', 'Pari Huanca', '38518505',
  '958518505',
  (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima' LIMIT 1),
  (SELECT id FROM users WHERE username = 'antonio.pari.huanca' LIMIT 1),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM drivers WHERE dni = '38518505'
);

-- Driver 17: Raúl Quispe Flores
INSERT INTO users (username, password_hash, role, active)
  VALUES ('raul.quispe.flores', '$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu', 'driver', true)
  ON CONFLICT (username) DO NOTHING;
INSERT INTO drivers
  (first_name, last_name, dni, phone, company_id, user_id, active)
SELECT
  'Raúl', 'Quispe Flores', '39753072',
  '959753072',
  (SELECT id FROM companies WHERE name = 'Emp. Transp. Surandino' LIMIT 1),
  (SELECT id FROM users WHERE username = 'raul.quispe.flores' LIMIT 1),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM drivers WHERE dni = '39753072'
);

-- Driver 18: Jorge Mamani Ticona
INSERT INTO users (username, password_hash, role, active)
  VALUES ('jorge.mamani.ticona', '$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu', 'driver', true)
  ON CONFLICT (username) DO NOTHING;
INSERT INTO drivers
  (first_name, last_name, dni, phone, company_id, user_id, active)
SELECT
  'Jorge', 'Mamani Ticona', '40987639',
  '950987639',
  (SELECT id FROM companies WHERE name = 'Emp. Transp. San Francisco de Borja' LIMIT 1),
  (SELECT id FROM users WHERE username = 'jorge.mamani.ticona' LIMIT 1),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM drivers WHERE dni = '40987639'
);

-- Driver 19: Fernando Apaza Condori
INSERT INTO users (username, password_hash, role, active)
  VALUES ('fernando.apaza.condori', '$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu', 'driver', true)
  ON CONFLICT (username) DO NOTHING;
INSERT INTO drivers
  (first_name, last_name, dni, phone, company_id, user_id, active)
SELECT
  'Fernando', 'Apaza Condori', '42222206',
  '952222206',
  (SELECT id FROM companies WHERE name = 'Emp. Transp. Virgen de Fátima II' LIMIT 1),
  (SELECT id FROM users WHERE username = 'fernando.apaza.condori' LIMIT 1),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM drivers WHERE dni = '42222206'
);

-- Driver 20: Ernesto Huanca Larico
INSERT INTO users (username, password_hash, role, active)
  VALUES ('ernesto.huanca.larico', '$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu', 'driver', true)
  ON CONFLICT (username) DO NOTHING;
INSERT INTO drivers
  (first_name, last_name, dni, phone, company_id, user_id, active)
SELECT
  'Ernesto', 'Huanca Larico', '43456773',
  '953456773',
  (SELECT id FROM companies WHERE name = 'Emp. Transp. San Miguel' LIMIT 1),
  (SELECT id FROM users WHERE username = 'ernesto.huanca.larico' LIMIT 1),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM drivers WHERE dni = '43456773'
);

-- 5. Asignar conductores 6–20 a vehículos 006–020 (uno por vehículo)
UPDATE drivers
  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '006' AND active = true LIMIT 1)
  WHERE LOWER(first_name) ILIKE 'roberto%'
    AND LOWER(last_name)  ILIKE 'flores limachi%'
    AND vehicle_id IS NULL;
UPDATE drivers
  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '007' AND active = true LIMIT 1)
  WHERE LOWER(first_name) ILIKE 'marcos%'
    AND LOWER(last_name)  ILIKE 'huanca condori%'
    AND vehicle_id IS NULL;
UPDATE drivers
  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '008' AND active = true LIMIT 1)
  WHERE LOWER(first_name) ILIKE 'david%'
    AND LOWER(last_name)  ILIKE 'condori mamani%'
    AND vehicle_id IS NULL;
UPDATE drivers
  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '009' AND active = true LIMIT 1)
  WHERE LOWER(first_name) ILIKE 'felipe%'
    AND LOWER(last_name)  ILIKE 'apaza torres%'
    AND vehicle_id IS NULL;
UPDATE drivers
  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '010' AND active = true LIMIT 1)
  WHERE LOWER(first_name) ILIKE 'héctor%'
    AND LOWER(last_name)  ILIKE 'larico soncco%'
    AND vehicle_id IS NULL;
UPDATE drivers
  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '011' AND active = true LIMIT 1)
  WHERE LOWER(first_name) ILIKE 'víctor%'
    AND LOWER(last_name)  ILIKE 'limachi calla%'
    AND vehicle_id IS NULL;
UPDATE drivers
  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '012' AND active = true LIMIT 1)
  WHERE LOWER(first_name) ILIKE 'arturo%'
    AND LOWER(last_name)  ILIKE 'ccama pari%'
    AND vehicle_id IS NULL;
UPDATE drivers
  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '013' AND active = true LIMIT 1)
  WHERE LOWER(first_name) ILIKE 'pedro%'
    AND LOWER(last_name)  ILIKE 'soncco quispe%'
    AND vehicle_id IS NULL;
UPDATE drivers
  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '014' AND active = true LIMIT 1)
  WHERE LOWER(first_name) ILIKE 'miguel%'
    AND LOWER(last_name)  ILIKE 'torres apaza%'
    AND vehicle_id IS NULL;
UPDATE drivers
  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '015' AND active = true LIMIT 1)
  WHERE LOWER(first_name) ILIKE 'luis%'
    AND LOWER(last_name)  ILIKE 'calla mamani%'
    AND vehicle_id IS NULL;
UPDATE drivers
  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '016' AND active = true LIMIT 1)
  WHERE LOWER(first_name) ILIKE 'antonio%'
    AND LOWER(last_name)  ILIKE 'pari huanca%'
    AND vehicle_id IS NULL;
UPDATE drivers
  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '017' AND active = true LIMIT 1)
  WHERE LOWER(first_name) ILIKE 'raúl%'
    AND LOWER(last_name)  ILIKE 'quispe flores%'
    AND vehicle_id IS NULL;
UPDATE drivers
  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '018' AND active = true LIMIT 1)
  WHERE LOWER(first_name) ILIKE 'jorge%'
    AND LOWER(last_name)  ILIKE 'mamani ticona%'
    AND vehicle_id IS NULL;
UPDATE drivers
  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '019' AND active = true LIMIT 1)
  WHERE LOWER(first_name) ILIKE 'fernando%'
    AND LOWER(last_name)  ILIKE 'apaza condori%'
    AND vehicle_id IS NULL;
UPDATE drivers
  SET vehicle_id = (SELECT id FROM vehicles WHERE association_code = '020' AND active = true LIMIT 1)
  WHERE LOWER(first_name) ILIKE 'ernesto%'
    AND LOWER(last_name)  ILIKE 'huanca larico%'
    AND vehicle_id IS NULL;

COMMIT;

-- Verificación post-seed
SELECT v.association_code, v.plate,
       d.first_name || ' ' || d.last_name AS conductor,
       c.name AS empresa
FROM vehicles v
LEFT JOIN drivers d ON d.vehicle_id = v.id
LEFT JOIN companies c ON c.id = v.company_id
ORDER BY v.association_code
LIMIT 25;