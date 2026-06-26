CREATE TYPE "VisitorStatus" AS ENUM (
  'CHECKED_IN',
  'CHECKED_OUT',
  'DENIED'
);

CREATE TABLE "Visitor" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "company" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "purpose" TEXT,
  "hostName" TEXT,
  "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checkOutAt" TIMESTAMP(3),
  "status" "VisitorStatus" NOT NULL DEFAULT 'CHECKED_IN',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Visitor_hotelId_idx" ON "Visitor"("hotelId");
CREATE INDEX "Visitor_status_idx" ON "Visitor"("status");
CREATE INDEX "Visitor_checkInAt_idx" ON "Visitor"("checkInAt");

ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
