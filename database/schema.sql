-- ============================================================
-- CHASKI AI 2.0 — Base de Datos
-- Database: chaski ai2
-- Creado para: Asociación TipCar · Juli, Puno
-- ============================================================

-- Ejecutar en PgAdmin:
-- 1. Crear base de datos: CREATE DATABASE "chaski ai2";
-- 2. Conectarse a "chaski ai2"
-- 3. Ejecutar este script

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ASOCIACIONES
-- ============================================================
CREATE TABLE associations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(150) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(100),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- EMPRESAS DE TRANSPORTE
-- ============================================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  association_id UUID NOT NULL REFERENCES associations(id),
  name VARCHAR(150) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  ruc VARCHAR(11),
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(100),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TIPOS DE VEHÍCULO
-- ============================================================
CREATE TABLE vehicle_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  capacity INTEGER NOT NULL,
  description TEXT
);

INSERT INTO vehicle_types (name, capacity, description) VALUES
  ('Toyota HiAce 2020+', 12, 'Van mediana de alta capacidad'),
  ('Mercedes Benz Sprinter', 19, 'Van grande de pasajeros'),
  ('Renault Master 2020+', 15, 'Van mediana europea');

-- ============================================================
-- USUARIOS DEL SISTEMA
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'driver', 'supervisor')),
  association_id UUID REFERENCES associations(id),
  active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- VEHÍCULOS (60 unidades en TipCar)
-- ============================================================
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  association_code VARCHAR(10) NOT NULL,  -- 001, 002 ... 060
  plate VARCHAR(10) UNIQUE NOT NULL,
  vehicle_type_id UUID REFERENCES vehicle_types(id),
  year INTEGER,
  brand VARCHAR(50),
  model VARCHAR(50),
  color VARCHAR(30),
  capacity INTEGER NOT NULL DEFAULT 12,
  gps_device_id VARCHAR(50),             -- ID Teltonika FMC130
  gps_phone VARCHAR(20),
  iape_qr_url TEXT,
  iape_phone VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- CONDUCTORES
-- ============================================================
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id),
  vehicle_id UUID REFERENCES vehicles(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  dni VARCHAR(8) UNIQUE NOT NULL,
  first_name VARCHAR(60) NOT NULL,
  last_name VARCHAR(60) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),
  address TEXT,
  photo_url TEXT,
  license_number VARCHAR(20),
  license_type VARCHAR(10),              -- A-IIIb, etc.
  license_expiry DATE,
  iape_qr_url TEXT,
  iape_phone VARCHAR(20),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- RUTAS
-- ============================================================
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  origin VARCHAR(100) NOT NULL,
  destination VARCHAR(100) NOT NULL,
  distance_km DECIMAL(6,2),
  duration_minutes INTEGER,
  fare DECIMAL(8,2),
  active BOOLEAN DEFAULT true
);

INSERT INTO routes (name, origin, destination, distance_km, duration_minutes, fare) VALUES
  ('Juli → Puno', 'Juli', 'Puno', 98.5, 80, 7.00),
  ('Puno → Juli', 'Puno', 'Juli', 98.5, 80, 7.00);

-- ============================================================
-- COLA DE SALIDA DIARIA
-- ============================================================
CREATE TABLE exit_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  driver_id UUID NOT NULL REFERENCES drivers(id),
  route_id UUID NOT NULL REFERENCES routes(id),
  queue_date DATE NOT NULL,
  position INTEGER NOT NULL,
  registered_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready', 'departed', 'absent', 'cancelled')),
  departure_time TIMESTAMP,
  notes TEXT,
  UNIQUE(queue_date, position),
  UNIQUE(queue_date, vehicle_id)
);

-- ============================================================
-- MANIFIESTOS DE PASAJEROS
-- ============================================================
CREATE TABLE manifests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manifest_number VARCHAR(30) UNIQUE NOT NULL,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  driver_id UUID NOT NULL REFERENCES drivers(id),
  route_id UUID NOT NULL REFERENCES routes(id),
  departure_time TIMESTAMP,
  arrival_time TIMESTAMP,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'exported')),
  total_passengers INTEGER DEFAULT 0,
  cash_passengers INTEGER DEFAULT 0,
  digital_passengers INTEGER DEFAULT 0,
  total_cash DECIMAL(10,2) DEFAULT 0,
  total_digital DECIMAL(10,2) DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  pdf_url TEXT,
  whatsapp_sent BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP
);

-- ============================================================
-- PASAJEROS DEL MANIFIESTO
-- ============================================================
CREATE TABLE manifest_passengers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manifest_id UUID NOT NULL REFERENCES manifests(id) ON DELETE CASCADE,
  passenger_order INTEGER NOT NULL,
  dni VARCHAR(8),
  full_name VARCHAR(100),
  phone VARCHAR(20),
  origin VARCHAR(100),
  destination VARCHAR(100),
  seat_number INTEGER,
  payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('cash', 'yape', 'plin', 'digital', 'other')),
  fare DECIMAL(8,2) NOT NULL DEFAULT 7.00,
  boarding_point VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- VIAJES / RECORRIDOS
-- ============================================================
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  driver_id UUID NOT NULL REFERENCES drivers(id),
  route_id UUID NOT NULL REFERENCES routes(id),
  manifest_id UUID REFERENCES manifests(id),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  distance_km DECIMAL(6,2),
  avg_speed DECIMAL(5,2),
  max_speed DECIMAL(5,2),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  revenue DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- POSICIONES GPS (Tracking en tiempo real)
-- ============================================================
CREATE TABLE gps_positions (
  id BIGSERIAL PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  trip_id UUID REFERENCES trips(id),
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  altitude DECIMAL(7,2),
  speed DECIMAL(5,2),
  heading DECIMAL(5,2),
  accuracy DECIMAL(6,2),
  satellites INTEGER,
  recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  device_id VARCHAR(50)
);

CREATE INDEX idx_gps_vehicle_time ON gps_positions(vehicle_id, recorded_at DESC);
CREATE INDEX idx_gps_trip ON gps_positions(trip_id);

-- ============================================================
-- ALERTAS DE VELOCIDAD
-- ============================================================
CREATE TABLE speed_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  driver_id UUID REFERENCES drivers(id),
  trip_id UUID REFERENCES trips(id),
  max_speed DECIMAL(5,2) NOT NULL,
  speed_limit DECIMAL(5,2) DEFAULT 90.00,
  duration_minutes DECIMAL(5,2),
  location_lat DECIMAL(10,7),
  location_lon DECIMAL(10,7),
  route_section VARCHAR(200),
  severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMP,
  occurred_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ALERTAS DE RUTA (DESVÍOS, PARADAS, ETC.)
-- ============================================================
CREATE TABLE route_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  trip_id UUID REFERENCES trips(id),
  alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN ('deviation', 'stop', 'offline', 'unclosed_manifest', 'other')),
  description TEXT,
  location_lat DECIMAL(10,7),
  location_lon DECIMAL(10,7),
  deviation_km DECIMAL(6,2),
  acknowledged BOOLEAN DEFAULT false,
  resolved BOOLEAN DEFAULT false,
  occurred_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- ============================================================
-- ALERTAS DEL SISTEMA (Panel administrador)
-- ============================================================
CREATE TABLE system_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(30) NOT NULL,
  severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical', 'success')),
  title VARCHAR(250) NOT NULL,
  message TEXT NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id),
  driver_id UUID REFERENCES drivers(id),
  reference_id UUID,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES DE RENDIMIENTO
-- ============================================================
CREATE INDEX idx_vehicles_company ON vehicles(company_id);
CREATE INDEX idx_vehicles_code ON vehicles(association_code);
CREATE INDEX idx_drivers_vehicle ON drivers(vehicle_id);
CREATE INDEX idx_manifests_vehicle ON manifests(vehicle_id);
CREATE INDEX idx_manifests_date ON manifests(created_at);
CREATE INDEX idx_trips_vehicle ON trips(vehicle_id);
CREATE INDEX idx_trips_date ON trips(start_time);
CREATE INDEX idx_exit_queue_date ON exit_queue(queue_date);
CREATE INDEX idx_speed_alerts_vehicle ON speed_alerts(vehicle_id);

-- ============================================================
-- DATOS INICIALES — TIPCAR
-- ============================================================

INSERT INTO associations (id, name, code, address, phone, email) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Asociación de Transportistas TipCar',
  'TIPCAR',
  'Plaza de Armas de Juli, Chucuito, Puno',
  '051-561234',
  'tipcar@transportes.pe'
);

INSERT INTO companies (id, association_id, name, code, ruc) VALUES
  ('22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111111','Emp. Transp. Virgen de Fátima','VF','20601234561'),
  ('22222222-2222-2222-2222-222222222202','11111111-1111-1111-1111-111111111111','Emp. Transp. Surandino','SA','20601234562'),
  ('22222222-2222-2222-2222-222222222203','11111111-1111-1111-1111-111111111111','Emp. Transp. San Francisco de Borja','SFB','20601234563'),
  ('22222222-2222-2222-2222-222222222204','11111111-1111-1111-1111-111111111111','Emp. Transp. Virgen de Fátima II','VF2','20601234564'),
  ('22222222-2222-2222-2222-222222222205','11111111-1111-1111-1111-111111111111','Emp. Transp. San Miguel','SM','20601234565');

-- Admin user (contraseña: admin123 — cambiar en producción)
INSERT INTO users (id, username, password_hash, role, association_id) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'admin.tipcar',
  '$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu',
  'admin',
  '11111111-1111-1111-1111-111111111111'
);

-- 5 conductores de ejemplo
INSERT INTO users (id, username, password_hash, role, association_id) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01','eloy.mamani','$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu','driver','11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02','jose.quispe','$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu','driver','11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03','abraham.morales','$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu','driver','11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04','juan.perez','$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu','driver','11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05','carlos.ticona','$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu','driver','11111111-1111-1111-1111-111111111111');

-- Vehículos de ejemplo
INSERT INTO vehicles (company_id, association_code, plate, year, brand, model, capacity, status) VALUES
  ('22222222-2222-2222-2222-222222222201','001','PUN-001',2022,'Toyota','HiAce',12,'active'),
  ('22222222-2222-2222-2222-222222222201','002','PUN-002',2021,'Toyota','HiAce',12,'active'),
  ('22222222-2222-2222-2222-222222222202','003','PUN-003',2022,'Mercedes','Sprinter',19,'active'),
  ('22222222-2222-2222-2222-222222222202','004','PUN-004',2020,'Renault','Master',15,'active'),
  ('22222222-2222-2222-2222-222222222203','005','PUN-005',2023,'Toyota','HiAce',12,'active');

-- Conductores vinculados
-- Se usa un CTE para calcular el ROW_NUMBER antes del JOIN (no se permite en ON directamente)
WITH numbered_users AS (
  SELECT
    id,
    username,
    ROW_NUMBER() OVER (ORDER BY username) AS rn
  FROM users
  WHERE role = 'driver'
)
INSERT INTO drivers (user_id, vehicle_id, company_id, dni, first_name, last_name, phone, license_type)
SELECT
  nu.id,
  v.id,
  v.company_id,
  CASE nu.username
    WHEN 'eloy.mamani'     THEN '40123456'
    WHEN 'jose.quispe'     THEN '40123457'
    WHEN 'abraham.morales' THEN '40123458'
    WHEN 'juan.perez'      THEN '40123459'
    WHEN 'carlos.ticona'   THEN '40123460'
  END,
  CASE nu.username
    WHEN 'eloy.mamani'     THEN 'Eloy'
    WHEN 'jose.quispe'     THEN 'José'
    WHEN 'abraham.morales' THEN 'Abraham'
    WHEN 'juan.perez'      THEN 'Juan'
    WHEN 'carlos.ticona'   THEN 'Carlos'
  END,
  CASE nu.username
    WHEN 'eloy.mamani'     THEN 'Mamani Quispe'
    WHEN 'jose.quispe'     THEN 'Quispe Flores'
    WHEN 'abraham.morales' THEN 'Morales Condori'
    WHEN 'juan.perez'      THEN 'Pérez Huanca'
    WHEN 'carlos.ticona'   THEN 'Ticona Apaza'
  END,
  '951000000',
  'A-IIIb'
FROM numbered_users nu
JOIN vehicles v ON v.association_code = LPAD(nu.rn::text, 3, '0')
LIMIT 5;
