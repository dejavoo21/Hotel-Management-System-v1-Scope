ALTER TABLE "Review"
  ADD COLUMN IF NOT EXISTS "externalId" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewerName" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewerCountry" TEXT,
  ADD COLUMN IF NOT EXISTS "providerMetadata" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "Review_hotelId_source_externalId_key"
  ON "Review"("hotelId", "source", "externalId");

CREATE TABLE IF NOT EXISTS "ReviewProviderConnection" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "accessTokenCiphertext" TEXT,
  "refreshTokenCiphertext" TEXT,
  "tokenExpiresAt" TIMESTAMP(3),
  "accountName" TEXT,
  "locationName" TEXT,
  "lastSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReviewProviderConnection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewProviderConnection_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReviewProviderConnection_hotelId_provider_key"
  ON "ReviewProviderConnection"("hotelId", "provider");
CREATE INDEX IF NOT EXISTS "ReviewProviderConnection_provider_status_idx"
  ON "ReviewProviderConnection"("provider", "status");
