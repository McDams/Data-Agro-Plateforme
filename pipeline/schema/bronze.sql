-- ============================================================
-- Dat'Agro — lakehouse, couche Bronze
-- Capture brute immuable de chaque relevé accepté (device_uid connu,
-- valeurs capteurs non encore validées). Alimentée par _ingest_reading()
-- dans backend/server.py, juste après l'insertion opérationnelle.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS bronze;

CREATE TABLE IF NOT EXISTS bronze.sensor_ingestions (
  id BIGSERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL CHECK (source IN ('gateway_batch', 'manual_api')),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  ingestion_batch_id UUID NOT NULL,   -- regroupe toutes les lignes d'un même appel HTTP
  raw_payload JSONB NOT NULL,          -- dict brut tel que reçu (valeurs capteurs + timestamp)
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bronze_unprocessed   ON bronze.sensor_ingestions (processed) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_bronze_device_ts     ON bronze.sensor_ingestions (device_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_bronze_received_brin ON bronze.sensor_ingestions USING BRIN (received_at);
