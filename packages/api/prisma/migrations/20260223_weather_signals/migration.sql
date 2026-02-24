CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "Hotel"
  ADD COLUMN IF NOT EXISTS "address_line1" TEXT,
  ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "location_updated_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "external_signals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "hotel_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "date_local" DATE NOT NULL,
  "timezone" TEXT NOT NULL,
  "metrics_json" JSONB NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'openweathermap',
  "fetched_at_utc" TIMESTAMP(3) NOT NULL,
  "raw_json" JSONB,
  "created_at_utc" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "external_signals_hotel_id_fkey"
    FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "external_signals_hotel_id_type_date_local_source_key"
  ON "external_signals"("hotel_id", "type", "date_local", "source");

CREATE INDEX IF NOT EXISTS "external_signals_hotel_id_date_local_idx"
  ON "external_signals"("hotel_id", "date_local");
