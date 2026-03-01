CREATE TABLE IF NOT EXISTS "pricing_snapshots" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "window_start_utc" TIMESTAMP(3) NOT NULL,
  "window_end_utc" TIMESTAMP(3) NOT NULL,
  "generated_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "calendar" JSONB NOT NULL,
  "summary" JSONB NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'INTERNAL_RULES',
  "version" TEXT NOT NULL DEFAULT 'v1',
  CONSTRAINT "pricing_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pricing_snapshots_hotel_id_idx" ON "pricing_snapshots"("hotelId");
CREATE INDEX IF NOT EXISTS "pricing_snapshots_generated_at_utc_idx" ON "pricing_snapshots"("generated_at_utc");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pricing_snapshots_hotel_id_fkey'
  ) THEN
    ALTER TABLE "pricing_snapshots"
      ADD CONSTRAINT "pricing_snapshots_hotel_id_fkey"
      FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
