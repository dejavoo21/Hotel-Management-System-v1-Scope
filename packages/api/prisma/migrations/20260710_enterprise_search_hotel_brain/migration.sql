-- Enterprise Search foundation
CREATE TABLE IF NOT EXISTS "SearchIndex" (
  "id" TEXT NOT NULL,
  "searchId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "sourceModule" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "searchableText" TEXT NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" TEXT,
  "priority" TEXT,
  "severity" TEXT,
  "hotelArea" TEXT,
  "roomNumber" TEXT,
  "guestId" TEXT,
  "reservationId" TEXT,
  "ownerId" TEXT,
  "accessScope" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceUrl" TEXT,
  "metadata" JSONB,
  "sourceCreatedAt" TIMESTAMP(3),
  "sourceUpdatedAt" TIMESTAMP(3),
  "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SearchIndex_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SearchIndex_searchId_key" ON "SearchIndex"("searchId");
CREATE UNIQUE INDEX IF NOT EXISTS "SearchIndex_hotelId_entityType_entityId_key" ON "SearchIndex"("hotelId", "entityType", "entityId");
CREATE INDEX IF NOT EXISTS "SearchIndex_hotelId_idx" ON "SearchIndex"("hotelId");
CREATE INDEX IF NOT EXISTS "SearchIndex_entityType_idx" ON "SearchIndex"("entityType");
CREATE INDEX IF NOT EXISTS "SearchIndex_sourceModule_idx" ON "SearchIndex"("sourceModule");
CREATE INDEX IF NOT EXISTS "SearchIndex_status_idx" ON "SearchIndex"("status");
CREATE INDEX IF NOT EXISTS "SearchIndex_priority_idx" ON "SearchIndex"("priority");
CREATE INDEX IF NOT EXISTS "SearchIndex_severity_idx" ON "SearchIndex"("severity");
CREATE INDEX IF NOT EXISTS "SearchIndex_roomNumber_idx" ON "SearchIndex"("roomNumber");
CREATE INDEX IF NOT EXISTS "SearchIndex_guestId_idx" ON "SearchIndex"("guestId");
CREATE INDEX IF NOT EXISTS "SearchIndex_reservationId_idx" ON "SearchIndex"("reservationId");
CREATE INDEX IF NOT EXISTS "SearchIndex_ownerId_idx" ON "SearchIndex"("ownerId");
CREATE INDEX IF NOT EXISTS "SearchIndex_indexedAt_idx" ON "SearchIndex"("indexedAt");

ALTER TABLE "SearchIndex" ADD CONSTRAINT "SearchIndex_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
