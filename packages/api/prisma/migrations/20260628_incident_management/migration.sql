-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('SECURITY', 'MAINTENANCE', 'SMART_BUILDING', 'OPERATIONS', 'WEATHER', 'HOUSEKEEPING', 'IT', 'GUEST');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('NEW', 'ACKNOWLEDGED', 'INVESTIGATING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "Incident" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "incidentNumber" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" "IncidentCategory" NOT NULL,
  "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status" "IncidentStatus" NOT NULL DEFAULT 'NEW',
  "sourceModule" TEXT NOT NULL,
  "linkedEntityType" TEXT,
  "linkedEntityId" TEXT,
  "createdById" TEXT,
  "assignedManagerId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentTask" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IncidentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentComment" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "authorId" TEXT,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IncidentComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentAttachment" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "uploadedById" TEXT,
  "filename" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "contentType" TEXT,
  "sizeBytes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IncidentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Incident_hotelId_incidentNumber_key" ON "Incident"("hotelId", "incidentNumber");
CREATE INDEX "Incident_hotelId_idx" ON "Incident"("hotelId");
CREATE INDEX "Incident_status_idx" ON "Incident"("status");
CREATE INDEX "Incident_severity_idx" ON "Incident"("severity");
CREATE INDEX "Incident_category_idx" ON "Incident"("category");
CREATE INDEX "Incident_sourceModule_idx" ON "Incident"("sourceModule");
CREATE INDEX "Incident_linkedEntityType_linkedEntityId_idx" ON "Incident"("linkedEntityType", "linkedEntityId");
CREATE INDEX "Incident_startedAt_idx" ON "Incident"("startedAt");
CREATE UNIQUE INDEX "IncidentTask_incidentId_ticketId_key" ON "IncidentTask"("incidentId", "ticketId");
CREATE INDEX "IncidentTask_ticketId_idx" ON "IncidentTask"("ticketId");
CREATE INDEX "IncidentComment_incidentId_idx" ON "IncidentComment"("incidentId");
CREATE INDEX "IncidentComment_hotelId_idx" ON "IncidentComment"("hotelId");
CREATE INDEX "IncidentComment_createdAt_idx" ON "IncidentComment"("createdAt");
CREATE INDEX "IncidentAttachment_incidentId_idx" ON "IncidentAttachment"("incidentId");
CREATE INDEX "IncidentAttachment_hotelId_idx" ON "IncidentAttachment"("hotelId");

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_assignedManagerId_fkey" FOREIGN KEY ("assignedManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IncidentTask" ADD CONSTRAINT "IncidentTask_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentTask" ADD CONSTRAINT "IncidentTask_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentComment" ADD CONSTRAINT "IncidentComment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentComment" ADD CONSTRAINT "IncidentComment_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentComment" ADD CONSTRAINT "IncidentComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IncidentAttachment" ADD CONSTRAINT "IncidentAttachment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentAttachment" ADD CONSTRAINT "IncidentAttachment_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentAttachment" ADD CONSTRAINT "IncidentAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
