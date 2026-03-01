-- Add stable source key for deduping externally generated tickets.
ALTER TABLE "tickets"
ADD COLUMN "source_key" TEXT;

CREATE UNIQUE INDEX "tickets_source_key_key" ON "tickets"("source_key");

