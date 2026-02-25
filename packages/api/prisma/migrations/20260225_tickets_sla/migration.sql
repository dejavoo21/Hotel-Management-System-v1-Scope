-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('BOOKING_RELATED', 'GENERAL_INQUIRY');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'BREACHED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum (Department if not exists)
DO $$ BEGIN
    CREATE TYPE "Department" AS ENUM ('FRONT_DESK', 'HOUSEKEEPING', 'MAINTENANCE', 'CONCIERGE', 'BILLING', 'MANAGEMENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('COMPLAINT', 'BILLING', 'HOUSEKEEPING', 'MAINTENANCE', 'CONCIERGE', 'ROOM_SERVICE', 'CHECK_IN_OUT', 'BOOKING', 'OTHER');

-- CreateTable: tickets
CREATE TABLE IF NOT EXISTS "tickets" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "type" "TicketType" NOT NULL DEFAULT 'GENERAL_INQUIRY',
    "category" "TicketCategory" NOT NULL DEFAULT 'OTHER',
    "department" "Department" NOT NULL DEFAULT 'FRONT_DESK',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "response_due_at_utc" TIMESTAMP(3),
    "resolution_due_at_utc" TIMESTAMP(3),
    "first_response_at_utc" TIMESTAMP(3),
    "resolved_at_utc" TIMESTAMP(3),
    "escalated_level" INTEGER NOT NULL DEFAULT 0,
    "last_escalation_at_utc" TIMESTAMP(3),
    "created_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at_utc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable: sla_policies
CREATE TABLE IF NOT EXISTS "sla_policies" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "department" "Department" NOT NULL,
    "responseMinutes" INTEGER NOT NULL,
    "resolutionMinutes" INTEGER NOT NULL,
    "escalation_steps_json" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tickets_conversationId_key" ON "tickets"("conversationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tickets_hotelId_idx" ON "tickets"("hotelId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tickets_priority_idx" ON "tickets"("priority");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tickets_department_idx" ON "tickets"("department");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tickets_response_due_at_utc_idx" ON "tickets"("response_due_at_utc");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tickets_resolution_due_at_utc_idx" ON "tickets"("resolution_due_at_utc");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sla_policies_hotelId_category_department_key" ON "sla_policies"("hotelId", "category", "department");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sla_policies_hotelId_idx" ON "sla_policies"("hotelId");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
