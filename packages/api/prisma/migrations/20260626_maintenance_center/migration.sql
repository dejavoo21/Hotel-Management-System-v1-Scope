CREATE TYPE "MaintenanceCenterPriority" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT'
);

CREATE TYPE "MaintenanceWorkOrderStatus" AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "MaintenanceFaultSeverity" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
  'CRITICAL'
);

CREATE TYPE "MaintenanceFaultStatus" AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED'
);

CREATE TYPE "MaintenanceRepairStatus" AS ENUM (
  'SCHEDULED',
  'IN_PROGRESS',
  'WAITING_PARTS',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "PreventiveMaintenanceFrequency" AS ENUM (
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'ANNUAL'
);

CREATE TYPE "PreventiveMaintenanceStatus" AS ENUM (
  'ACTIVE',
  'PAUSED',
  'OVERDUE',
  'COMPLETED'
);

CREATE TYPE "AssetInspectionStatus" AS ENUM (
  'OK',
  'DUE',
  'OVERDUE',
  'NEEDS_REPAIR'
);

CREATE TABLE "MaintenanceWorkOrder" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "location" TEXT,
  "assetName" TEXT,
  "assetExternalId" TEXT,
  "priority" "MaintenanceCenterPriority" NOT NULL DEFAULT 'MEDIUM',
  "status" "MaintenanceWorkOrderStatus" NOT NULL DEFAULT 'OPEN',
  "assignedTo" TEXT,
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaintenanceWorkOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaintenanceFault" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "workOrderId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "location" TEXT,
  "assetName" TEXT,
  "severity" "MaintenanceFaultSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status" "MaintenanceFaultStatus" NOT NULL DEFAULT 'OPEN',
  "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaintenanceFault_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaintenanceRepair" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "workOrderId" TEXT,
  "faultId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "technician" TEXT,
  "status" "MaintenanceRepairStatus" NOT NULL DEFAULT 'SCHEDULED',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cost" DECIMAL(10,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaintenanceRepair_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PreventiveMaintenanceSchedule" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "assetName" TEXT NOT NULL,
  "assetExternalId" TEXT,
  "frequency" "PreventiveMaintenanceFrequency" NOT NULL,
  "nextDueAt" TIMESTAMP(3) NOT NULL,
  "lastCompletedAt" TIMESTAMP(3),
  "status" "PreventiveMaintenanceStatus" NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PreventiveMaintenanceSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssetMaintenanceRecord" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "deviceId" TEXT,
  "assetName" TEXT NOT NULL,
  "assetExternalId" TEXT,
  "location" TEXT,
  "inspectionStatus" "AssetInspectionStatus" NOT NULL DEFAULT 'OK',
  "lastInspectionAt" TIMESTAMP(3),
  "nextInspectionAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssetMaintenanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaintenanceWorkOrder_hotelId_idx" ON "MaintenanceWorkOrder"("hotelId");
CREATE INDEX "MaintenanceWorkOrder_status_idx" ON "MaintenanceWorkOrder"("status");
CREATE INDEX "MaintenanceWorkOrder_priority_idx" ON "MaintenanceWorkOrder"("priority");
CREATE INDEX "MaintenanceWorkOrder_dueAt_idx" ON "MaintenanceWorkOrder"("dueAt");

CREATE INDEX "MaintenanceFault_hotelId_idx" ON "MaintenanceFault"("hotelId");
CREATE INDEX "MaintenanceFault_workOrderId_idx" ON "MaintenanceFault"("workOrderId");
CREATE INDEX "MaintenanceFault_severity_idx" ON "MaintenanceFault"("severity");
CREATE INDEX "MaintenanceFault_status_idx" ON "MaintenanceFault"("status");
CREATE INDEX "MaintenanceFault_reportedAt_idx" ON "MaintenanceFault"("reportedAt");

CREATE INDEX "MaintenanceRepair_hotelId_idx" ON "MaintenanceRepair"("hotelId");
CREATE INDEX "MaintenanceRepair_workOrderId_idx" ON "MaintenanceRepair"("workOrderId");
CREATE INDEX "MaintenanceRepair_faultId_idx" ON "MaintenanceRepair"("faultId");
CREATE INDEX "MaintenanceRepair_status_idx" ON "MaintenanceRepair"("status");

CREATE INDEX "PreventiveMaintenanceSchedule_hotelId_idx" ON "PreventiveMaintenanceSchedule"("hotelId");
CREATE INDEX "PreventiveMaintenanceSchedule_status_idx" ON "PreventiveMaintenanceSchedule"("status");
CREATE INDEX "PreventiveMaintenanceSchedule_nextDueAt_idx" ON "PreventiveMaintenanceSchedule"("nextDueAt");

CREATE INDEX "AssetMaintenanceRecord_hotelId_idx" ON "AssetMaintenanceRecord"("hotelId");
CREATE INDEX "AssetMaintenanceRecord_deviceId_idx" ON "AssetMaintenanceRecord"("deviceId");
CREATE INDEX "AssetMaintenanceRecord_inspectionStatus_idx" ON "AssetMaintenanceRecord"("inspectionStatus");
CREATE INDEX "AssetMaintenanceRecord_nextInspectionAt_idx" ON "AssetMaintenanceRecord"("nextInspectionAt");

ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceFault" ADD CONSTRAINT "MaintenanceFault_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceFault" ADD CONSTRAINT "MaintenanceFault_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "MaintenanceWorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRepair" ADD CONSTRAINT "MaintenanceRepair_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRepair" ADD CONSTRAINT "MaintenanceRepair_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "MaintenanceWorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRepair" ADD CONSTRAINT "MaintenanceRepair_faultId_fkey" FOREIGN KEY ("faultId") REFERENCES "MaintenanceFault"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PreventiveMaintenanceSchedule" ADD CONSTRAINT "PreventiveMaintenanceSchedule_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetMaintenanceRecord" ADD CONSTRAINT "AssetMaintenanceRecord_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetMaintenanceRecord" ADD CONSTRAINT "AssetMaintenanceRecord_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "IoTDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
