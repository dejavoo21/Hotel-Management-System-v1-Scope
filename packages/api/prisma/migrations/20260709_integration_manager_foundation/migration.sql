CREATE TABLE IF NOT EXISTS "IntegrationCredentialReference" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "providerType" TEXT NOT NULL,
  "credentialReference" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT,
  "lastUpdatedById" TEXT,
  "lastTestedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationCredentialReference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationCredentialReference_integrationId_providerType_key"
  ON "IntegrationCredentialReference"("integrationId", "providerType");
CREATE INDEX IF NOT EXISTS "IntegrationCredentialReference_hotelId_idx"
  ON "IntegrationCredentialReference"("hotelId");
CREATE INDEX IF NOT EXISTS "IntegrationCredentialReference_providerType_idx"
  ON "IntegrationCredentialReference"("providerType");
CREATE INDEX IF NOT EXISTS "IntegrationCredentialReference_status_idx"
  ON "IntegrationCredentialReference"("status");
CREATE INDEX IF NOT EXISTS "IntegrationCredentialReference_credentialReference_idx"
  ON "IntegrationCredentialReference"("credentialReference");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'IntegrationCredentialReference_hotelId_fkey'
  ) THEN
    ALTER TABLE "IntegrationCredentialReference"
      ADD CONSTRAINT "IntegrationCredentialReference_hotelId_fkey"
      FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'IntegrationCredentialReference_integrationId_fkey'
  ) THEN
    ALTER TABLE "IntegrationCredentialReference"
      ADD CONSTRAINT "IntegrationCredentialReference_integrationId_fkey"
      FOREIGN KEY ("integrationId") REFERENCES "HardwareIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
