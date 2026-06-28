-- ============================================================
-- CHASKI AI 2.0 — Tabla de Dispositivos GPS
-- Ejecutar en PgAdmin sobre la BD "chaski ai2"
-- ============================================================

CREATE TABLE IF NOT EXISTS gps_devices (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  imei         VARCHAR(20) UNIQUE NOT NULL,
  alias        VARCHAR(60),
  model        VARCHAR(50) DEFAULT 'Teltonika FMC130',
  sim_number   VARCHAR(20),
  vehicle_id   UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  notes        TEXT,
  active       BOOLEAN DEFAULT true,
  registered_at TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gps_devices_vehicle ON gps_devices(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_gps_devices_imei    ON gps_devices(imei);
