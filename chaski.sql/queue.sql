-- ============================================================
-- CHASKI AI 2.0 — Cola de Salida Diaria
-- Ejecutar en PgAdmin sobre "chaski ai2"
-- ============================================================

CREATE TABLE IF NOT EXISTS queue_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_date    DATE         NOT NULL DEFAULT CURRENT_DATE,
  route         VARCHAR(20)  NOT NULL DEFAULT 'juli-puno',  -- juli-puno | puno-juli
  turn_number   INTEGER,
  driver_id     UUID         REFERENCES drivers(id)  ON DELETE CASCADE,
  vehicle_id    UUID         REFERENCES vehicles(id) ON DELETE SET NULL,
  position      VARCHAR(20)  NOT NULL DEFAULT 'waiting',
  -- calling | ramp1 | ramp2 | outside1 | outside2 | waiting | departed | cancelled
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  departure_at  TIMESTAMP WITH TIME ZONE,
  active        BOOLEAN      DEFAULT TRUE,
  UNIQUE(queue_date, route, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_qe_date_route ON queue_entries(queue_date, route);
CREATE INDEX IF NOT EXISTS idx_qe_driver    ON queue_entries(driver_id);
