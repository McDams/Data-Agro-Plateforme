-- ============================================================
-- Dat'Agro — lakehouse, couche Silver
-- Données typées, dédupliquées, enrichies (jointure device/plot/farm),
-- avec détection d'anomalies sur plages plausibles par capteur.
-- Alimentée par le workflow n8n "Agro_Bronze_to_Silver" (pas de suppression
-- silencieuse des valeurs suspectes : elles sont conservées et flaguées).
-- ============================================================

CREATE SCHEMA IF NOT EXISTS silver;

CREATE TABLE IF NOT EXISTS silver.sensor_readings_clean (
  id BIGSERIAL PRIMARY KEY,
  bronze_id BIGINT NOT NULL REFERENCES bronze.sensor_ingestions(id),
  device_id UUID NOT NULL REFERENCES devices(id),
  plot_id UUID REFERENCES plots(id),
  farm_id UUID REFERENCES farms(id),
  owner_id UUID REFERENCES users(id),
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
  reading_ts TIMESTAMPTZ NOT NULL,
  is_outlier BOOLEAN NOT NULL DEFAULT FALSE,
  outlier_reason TEXT,
  source TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_silver_bronze UNIQUE (bronze_id),               -- idempotence si le workflow tourne 2x
  CONSTRAINT uq_silver_device_ts UNIQUE (device_id, reading_ts)  -- déduplication de vrais renvois
);

CREATE INDEX IF NOT EXISTS idx_silver_device_ts ON silver.sensor_readings_clean (device_id, reading_ts DESC);
CREATE INDEX IF NOT EXISTS idx_silver_plot_ts   ON silver.sensor_readings_clean (plot_id, reading_ts DESC);
CREATE INDEX IF NOT EXISTS idx_silver_outlier   ON silver.sensor_readings_clean (is_outlier) WHERE is_outlier = TRUE;

-- Plages plausibles par capteur, utilisées par le nœud Code du workflow
-- Agro_Bronze_to_Silver pour calculer is_outlier / outlier_reason :
--   soil_moisture    0–100 %      air_humidity     0–100 %
--   soil_temperature -10–60 °C    air_temperature  -10–60 °C
--   luminosity       0–150000 lux NPK (N/P/K)       0–2000 mg/kg
--   ph               0–14         conductivity      0–20 mS/cm
