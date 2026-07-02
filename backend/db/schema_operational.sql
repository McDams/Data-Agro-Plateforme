-- ============================================================
-- Dat'Agro — schéma opérationnel PostgreSQL
-- Remplace les collections MongoDB 1:1. UUID natif (gen_random_uuid(),
-- disponible nativement depuis PG13, pas d'extension requise) pour que
-- le champ "id" reste une string opaque côté API — zéro changement frontend.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  farm_name TEXT,
  country TEXT,
  role TEXT NOT NULL DEFAULT 'farmer' CHECK (role IN ('farmer', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
  password_hash TEXT NOT NULL,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_expires ON password_reset_tokens(expires_at);
-- Mongo avait un index TTL (auto-suppression). Postgres n'en a pas nativement ;
-- ajouter plus tard un petit workflow n8n de housekeeping quotidien :
--   DELETE FROM password_reset_tokens WHERE expires_at < now();

CREATE TABLE IF NOT EXISTS login_attempts (
  identifier TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  last_attempt TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  total_area DOUBLE PRECISION,
  gateway_key_hash TEXT UNIQUE,
  gateway_key_prefix TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_farms_owner ON farms(owner_id);

CREATE TABLE IF NOT EXISTS plots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  area DOUBLE PRECISION,
  crop_type TEXT,
  sowing_date TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plots_farm ON plots(farm_id);
CREATE INDEX IF NOT EXISTS idx_plots_owner ON plots(owner_id);

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  plot_id UUID REFERENCES plots(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  device_uid TEXT UNIQUE NOT NULL,
  device_type TEXT NOT NULL,
  sensor_types TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'offline',
  battery_level INTEGER DEFAULT 100,
  signal_strength INTEGER DEFAULT 0,
  firmware_version TEXT DEFAULT '1.0.0',
  maintenance_notes TEXT,
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_devices_farm ON devices(farm_id);
CREATE INDEX IF NOT EXISTS idx_devices_plot ON devices(plot_id);
CREATE INDEX IF NOT EXISTS idx_devices_owner ON devices(owner_id);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  plot_id UUID REFERENCES plots(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  soil_moisture DOUBLE PRECISION,
  soil_temperature DOUBLE PRECISION,
  air_temperature DOUBLE PRECISION,
  air_humidity DOUBLE PRECISION,
  luminosity DOUBLE PRECISION,
  soil_nitrogen DOUBLE PRECISION,
  soil_phosphorus DOUBLE PRECISION,
  soil_potassium DOUBLE PRECISION,
  ph DOUBLE PRECISION,
  conductivity DOUBLE PRECISION,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_readings_device_ts ON sensor_readings(device_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_readings_owner_ts  ON sensor_readings(owner_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_readings_plot_ts   ON sensor_readings(plot_id, "timestamp" DESC);
-- Série temporelle à fort volume, append-mostly : BRIN est peu coûteux et
-- passe à l'échelle sans extension (contrairement à TimescaleDB, cf. mémoire).
CREATE INDEX IF NOT EXISTS idx_readings_ts_brin ON sensor_readings USING BRIN ("timestamp");

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  plot_id UUID REFERENCES plots(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alerts_owner_resolved ON alerts(owner_id, is_resolved);
-- Remplace le pattern Mongo find-then-insert (source de races) par une
-- contrainte atomique : au plus une alerte ouverte par (device_id, type).
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_unique_open ON alerts(device_id, type) WHERE is_resolved = FALSE;

CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plot_id UUID NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
  farm_id UUID REFERENCES farms(id) ON DELETE SET NULL,  -- nullable: server.py tolère un plot sans farm_id valide
  plot_name TEXT,
  target_variable TEXT NOT NULL,
  forecast_horizon TEXT,
  predicted_value DOUBLE PRECISION,
  confidence DOUBLE PRECISION,
  trend TEXT,
  risk_level TEXT,
  explanation TEXT,
  recommended_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_predictions_plot_created ON predictions(plot_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  message TEXT,
  type TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
