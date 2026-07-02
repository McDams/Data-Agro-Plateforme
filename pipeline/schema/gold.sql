-- ============================================================
-- Dat'Agro — lakehouse, couche Gold
-- Agrégats par parcelle (horaires/journaliers) + table de features
-- prête pour le machine learning. Alimentée par le workflow n8n
-- "Agro_Silver_to_Gold".
-- ============================================================

CREATE SCHEMA IF NOT EXISTS gold;

CREATE TABLE IF NOT EXISTS gold.plot_hourly_agg (
  plot_id UUID NOT NULL,
  device_id UUID NOT NULL,
  hour_utc TIMESTAMPTZ NOT NULL,
  avg_soil_moisture DOUBLE PRECISION, min_soil_moisture DOUBLE PRECISION, max_soil_moisture DOUBLE PRECISION,
  avg_soil_temperature DOUBLE PRECISION,
  avg_air_temperature DOUBLE PRECISION,
  avg_air_humidity DOUBLE PRECISION,
  avg_luminosity DOUBLE PRECISION,
  avg_soil_nitrogen DOUBLE PRECISION, avg_soil_phosphorus DOUBLE PRECISION, avg_soil_potassium DOUBLE PRECISION,
  avg_ph DOUBLE PRECISION,
  avg_conductivity DOUBLE PRECISION,
  samples_count INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plot_id, device_id, hour_utc)
);
CREATE INDEX IF NOT EXISTS idx_gold_hourly_plot ON gold.plot_hourly_agg (plot_id, hour_utc DESC);

CREATE TABLE IF NOT EXISTS gold.plot_daily_agg (
  plot_id UUID NOT NULL,
  day_utc DATE NOT NULL,
  avg_soil_moisture DOUBLE PRECISION, min_soil_moisture DOUBLE PRECISION, max_soil_moisture DOUBLE PRECISION,
  avg_air_temperature DOUBLE PRECISION,
  avg_air_humidity DOUBLE PRECISION,
  avg_luminosity DOUBLE PRECISION,
  samples_count INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plot_id, day_utc)
);

-- Table "ML-ready" — point d'extension explicite pour le futur modèle de
-- prédiction d'humidité (cf. TODO(ML) dans backend/server.py::_compute_predictions).
-- Reconstruite par fonctions fenêtres SQL (LAG, moyennes glissantes) à partir
-- de gold.plot_hourly_agg — pas de code custom nécessaire.
CREATE TABLE IF NOT EXISTS gold.plot_features (
  plot_id UUID NOT NULL,
  hour_utc TIMESTAMPTZ NOT NULL,
  soil_moisture_avg DOUBLE PRECISION,
  soil_moisture_lag1h DOUBLE PRECISION,
  soil_moisture_lag24h DOUBLE PRECISION,
  soil_moisture_rolling_mean_6h DOUBLE PRECISION,
  soil_moisture_rolling_std_6h DOUBLE PRECISION,
  air_temperature_avg DOUBLE PRECISION,
  air_humidity_avg DOUBLE PRECISION,
  luminosity_avg DOUBLE PRECISION,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plot_id, hour_utc)
);
