-- ============================================================
-- CHASKI AI 2.0 — Tablas de Comunicados y Notificaciones
-- Ejecutar en PgAdmin sobre la base de datos "chaski ai2"
-- ============================================================

-- Tabla principal de comunicados del admin
CREATE TABLE IF NOT EXISTS communications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        VARCHAR(200)  NOT NULL,
  body         TEXT          NOT NULL,
  type         VARCHAR(20)   NOT NULL DEFAULT 'info',  -- info | alert | urgent
  created_by   UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active       BOOLEAN       DEFAULT TRUE
);

-- Notificaciones individuales por conductor (fan-out del comunicado)
CREATE TABLE IF NOT EXISTS driver_notifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID          REFERENCES communications(id) ON DELETE CASCADE,
  user_id          UUID          REFERENCES users(id)          ON DELETE CASCADE,
  read             BOOLEAN       DEFAULT FALSE,
  read_at          TIMESTAMP WITH TIME ZONE,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dn_user_id ON driver_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_dn_user_read ON driver_notifications(user_id, read);
