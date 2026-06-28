-- ============================================================
-- CHASKI AI 2.0 — Tablas de Seguridad (Phase 5)
-- Ejecutar una sola vez contra la base de datos de producción.
-- ============================================================

-- ── 1. Refresh Tokens ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   VARCHAR(64)  NOT NULL UNIQUE,
  expires_at   TIMESTAMP    NOT NULL,
  revoked      BOOLEAN      NOT NULL DEFAULT false,
  revoked_at   TIMESTAMP,
  ip_address   VARCHAR(45),
  user_agent   TEXT,
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ── 2. Intentos de Login (bloqueo de cuenta) ─────────────────
CREATE TABLE IF NOT EXISTS login_attempts (
  id           SERIAL PRIMARY KEY,
  username     VARCHAR(100) NOT NULL,
  ip_address   VARCHAR(45),
  success      BOOLEAN      NOT NULL,
  attempted_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ── 3. Tokens de Restablecimiento de Contraseña ──────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(64) NOT NULL UNIQUE,
  expires_at  TIMESTAMP   NOT NULL,
  used        BOOLEAN     NOT NULL DEFAULT false,
  used_at     TIMESTAMP,
  created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ── 4. Historial de Sesiones ─────────────────────────────────
CREATE TABLE IF NOT EXISTS session_history (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_id  INTEGER REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  action            VARCHAR(50) NOT NULL,
  ip_address        VARCHAR(45),
  user_agent        TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 5. Logs de Auditoría ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username    VARCHAR(100),
  role        VARCHAR(50),
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   VARCHAR(100),
  details     JSONB,
  ip_address  VARCHAR(45),
  user_agent  TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'success',
  created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rt_user_id      ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_rt_token_hash   ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_rt_expires_at   ON refresh_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_la_username     ON login_attempts(username);
CREATE INDEX IF NOT EXISTS idx_la_ip           ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_la_attempted_at ON login_attempts(attempted_at);

CREATE INDEX IF NOT EXISTS idx_prt_token_hash  ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_prt_user_id     ON password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_sh_user_id      ON session_history(user_id);
CREATE INDEX IF NOT EXISTS idx_sh_created_at   ON session_history(created_at);

CREATE INDEX IF NOT EXISTS idx_al_user_id      ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_al_action       ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_al_created_at   ON audit_logs(created_at);
