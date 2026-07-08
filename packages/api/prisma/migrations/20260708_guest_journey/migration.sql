DO $$ BEGIN
  CREATE TYPE "GuestJourneyStage" AS ENUM (
    'RESERVATION_CREATED',
    'PAYMENT_CONFIRMED',
    'PRE_ARRIVAL',
    'CHECK_IN',
    'IN_STAY',
    'SERVICE_REQUESTS',
    'MAINTENANCE',
    'CHECKOUT',
    'INVOICE',
    'REVIEW',
    'LOYALTY'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "GuestJourneyStatus" AS ENUM (
    'PENDING',
    'ACTIVE',
    'COMPLETED',
    'BLOCKED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "GuestJourney" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "guestId" TEXT NOT NULL,
  "bookingId" TEXT,
  "currentStage" "GuestJourneyStage" NOT NULL DEFAULT 'RESERVATION_CREATED',
  "status" "GuestJourneyStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "lastEventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "aiContextJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuestJourney_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GuestJourneyEvent" (
  "id" TEXT NOT NULL,
  "journeyId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "guestId" TEXT NOT NULL,
  "bookingId" TEXT,
  "stage" "GuestJourneyStage" NOT NULL,
  "status" "GuestJourneyStatus" NOT NULL DEFAULT 'COMPLETED',
  "eventType" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "sourceModule" TEXT NOT NULL,
  "linkedEntityType" TEXT,
  "linkedEntityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestJourneyEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GuestJourney_hotelId_guestId_bookingId_key" ON "GuestJourney"("hotelId", "guestId", "bookingId");
CREATE INDEX IF NOT EXISTS "GuestJourney_hotelId_idx" ON "GuestJourney"("hotelId");
CREATE INDEX IF NOT EXISTS "GuestJourney_guestId_idx" ON "GuestJourney"("guestId");
CREATE INDEX IF NOT EXISTS "GuestJourney_bookingId_idx" ON "GuestJourney"("bookingId");
CREATE INDEX IF NOT EXISTS "GuestJourney_currentStage_idx" ON "GuestJourney"("currentStage");
CREATE INDEX IF NOT EXISTS "GuestJourney_status_idx" ON "GuestJourney"("status");
CREATE INDEX IF NOT EXISTS "GuestJourney_lastEventAt_idx" ON "GuestJourney"("lastEventAt");

CREATE UNIQUE INDEX IF NOT EXISTS "GuestJourneyEvent_journeyId_eventType_linkedEntityType_linkedEntityId_key" ON "GuestJourneyEvent"("journeyId", "eventType", "linkedEntityType", "linkedEntityId");
CREATE INDEX IF NOT EXISTS "GuestJourneyEvent_hotelId_idx" ON "GuestJourneyEvent"("hotelId");
CREATE INDEX IF NOT EXISTS "GuestJourneyEvent_guestId_idx" ON "GuestJourneyEvent"("guestId");
CREATE INDEX IF NOT EXISTS "GuestJourneyEvent_bookingId_idx" ON "GuestJourneyEvent"("bookingId");
CREATE INDEX IF NOT EXISTS "GuestJourneyEvent_stage_idx" ON "GuestJourneyEvent"("stage");
CREATE INDEX IF NOT EXISTS "GuestJourneyEvent_sourceModule_idx" ON "GuestJourneyEvent"("sourceModule");
CREATE INDEX IF NOT EXISTS "GuestJourneyEvent_createdAt_idx" ON "GuestJourneyEvent"("createdAt");

DO $$ BEGIN
  ALTER TABLE "GuestJourney" ADD CONSTRAINT "GuestJourney_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "GuestJourney" ADD CONSTRAINT "GuestJourney_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "GuestJourney" ADD CONSTRAINT "GuestJourney_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "GuestJourneyEvent" ADD CONSTRAINT "GuestJourneyEvent_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "GuestJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "GuestJourneyEvent" ADD CONSTRAINT "GuestJourneyEvent_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "GuestJourneyEvent" ADD CONSTRAINT "GuestJourneyEvent_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "GuestJourneyEvent" ADD CONSTRAINT "GuestJourneyEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
