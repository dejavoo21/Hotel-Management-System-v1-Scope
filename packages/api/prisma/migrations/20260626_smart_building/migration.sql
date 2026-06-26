CREATE TYPE "IoTDeviceType" AS ENUM (
  'CAMERA',
  'DOOR_LOCK',
  'TEMPERATURE_SENSOR',
  'WATER_LEAK_SENSOR',
  'MOTION_SENSOR',
  'PANIC_BUTTON',
  'ENERGY_METER',
  'HVAC',
  'ASSET',
  'OTHER'
);

CREATE TYPE "IoTDeviceStatus" AS ENUM (
  'ONLINE',
  'OFFLINE',
  'WARNING',
  'MAINTENANCE',
  'UNKNOWN'
);

CREATE TYPE "CameraStatus" AS ENUM (
  'ONLINE',
  'OFFLINE',
  'WARNING',
  'MAINTENANCE'
);

CREATE TYPE "AccessActorType" AS ENUM (
  'STAFF',
  'GUEST',
  'VENDOR',
  'SYSTEM',
  'UNKNOWN'
);

CREATE TYPE "DoorAccessResult" AS ENUM (
  'GRANTED',
  'DENIED',
  'FORCED',
  'HELD_OPEN'
);

CREATE TYPE "DoorLockState" AS ENUM (
  'LOCKED',
  'UNLOCKED',
  'UNKNOWN'
);

CREATE TYPE "DoorOpenState" AS ENUM (
  'OPEN',
  'CLOSED',
  'FORCED_OPEN',
  'HELD_OPEN',
  'UNKNOWN'
);

CREATE TYPE "SensorType" AS ENUM (
  'TEMPERATURE',
  'WATER_LEAK',
  'MOTION',
  'PANIC_BUTTON',
  'HUMIDITY',
  'ENERGY',
  'HVAC',
  'OTHER'
);

CREATE TYPE "SensorStatus" AS ENUM (
  'NORMAL',
  'WARNING',
  'ALERT',
  'OFFLINE'
);

CREATE TYPE "SecurityAlertType" AS ENUM (
  'MOTION',
  'WATER_LEAK',
  'PANIC',
  'FORCED_DOOR',
  'DOOR_HELD_OPEN',
  'CAMERA_OFFLINE',
  'DEVICE_OFFLINE',
  'TEMPERATURE',
  'HVAC',
  'ENERGY',
  'OTHER'
);

CREATE TYPE "SecurityAlertSeverity" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

CREATE TYPE "SecurityAlertStatus" AS ENUM (
  'ACTIVE',
  'ACKNOWLEDGED',
  'RESOLVED'
);

CREATE TABLE "IoTDevice" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "deviceType" "IoTDeviceType" NOT NULL,
  "status" "IoTDeviceStatus" NOT NULL DEFAULT 'ONLINE',
  "location" TEXT,
  "floor" INTEGER,
  "zone" TEXT,
  "vendor" TEXT,
  "metadata" JSONB,
  "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IoTDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CameraFeed" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "deviceId" TEXT,
  "externalId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "location" TEXT,
  "status" "CameraStatus" NOT NULL DEFAULT 'ONLINE',
  "streamUrl" TEXT,
  "snapshotUrl" TEXT,
  "lastSeenAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CameraFeed_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DoorAccessEvent" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "externalId" TEXT,
  "doorExternalId" TEXT,
  "doorName" TEXT,
  "actorName" TEXT,
  "actorType" "AccessActorType" NOT NULL DEFAULT 'UNKNOWN',
  "credentialId" TEXT,
  "result" "DoorAccessResult" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DoorAccessEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DoorStatus" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "deviceId" TEXT,
  "externalId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "location" TEXT,
  "floor" INTEGER,
  "lockState" "DoorLockState" NOT NULL DEFAULT 'LOCKED',
  "openState" "DoorOpenState" NOT NULL DEFAULT 'CLOSED',
  "batteryLevel" INTEGER,
  "lastEventAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DoorStatus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SensorReading" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "deviceId" TEXT,
  "externalId" TEXT,
  "sensorType" "SensorType" NOT NULL,
  "location" TEXT,
  "value" DECIMAL(12,4) NOT NULL,
  "unit" TEXT NOT NULL,
  "status" "SensorStatus" NOT NULL DEFAULT 'NORMAL',
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SensorReading_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityAlert" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "deviceId" TEXT,
  "externalId" TEXT,
  "alertType" "SecurityAlertType" NOT NULL,
  "severity" "SecurityAlertSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status" "SecurityAlertStatus" NOT NULL DEFAULT 'ACTIVE',
  "title" TEXT NOT NULL,
  "message" TEXT,
  "location" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecurityAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IoTDevice_hotelId_externalId_key" ON "IoTDevice"("hotelId", "externalId");
CREATE INDEX "IoTDevice_hotelId_idx" ON "IoTDevice"("hotelId");
CREATE INDEX "IoTDevice_deviceType_idx" ON "IoTDevice"("deviceType");
CREATE INDEX "IoTDevice_status_idx" ON "IoTDevice"("status");

CREATE UNIQUE INDEX "CameraFeed_hotelId_externalId_key" ON "CameraFeed"("hotelId", "externalId");
CREATE INDEX "CameraFeed_hotelId_idx" ON "CameraFeed"("hotelId");
CREATE INDEX "CameraFeed_status_idx" ON "CameraFeed"("status");

CREATE UNIQUE INDEX "DoorAccessEvent_hotelId_externalId_key" ON "DoorAccessEvent"("hotelId", "externalId");
CREATE INDEX "DoorAccessEvent_hotelId_idx" ON "DoorAccessEvent"("hotelId");
CREATE INDEX "DoorAccessEvent_occurredAt_idx" ON "DoorAccessEvent"("occurredAt");
CREATE INDEX "DoorAccessEvent_result_idx" ON "DoorAccessEvent"("result");

CREATE UNIQUE INDEX "DoorStatus_hotelId_externalId_key" ON "DoorStatus"("hotelId", "externalId");
CREATE INDEX "DoorStatus_hotelId_idx" ON "DoorStatus"("hotelId");
CREATE INDEX "DoorStatus_lockState_idx" ON "DoorStatus"("lockState");
CREATE INDEX "DoorStatus_openState_idx" ON "DoorStatus"("openState");

CREATE INDEX "SensorReading_hotelId_idx" ON "SensorReading"("hotelId");
CREATE INDEX "SensorReading_sensorType_idx" ON "SensorReading"("sensorType");
CREATE INDEX "SensorReading_status_idx" ON "SensorReading"("status");
CREATE INDEX "SensorReading_recordedAt_idx" ON "SensorReading"("recordedAt");

CREATE UNIQUE INDEX "SecurityAlert_hotelId_externalId_key" ON "SecurityAlert"("hotelId", "externalId");
CREATE INDEX "SecurityAlert_hotelId_idx" ON "SecurityAlert"("hotelId");
CREATE INDEX "SecurityAlert_status_idx" ON "SecurityAlert"("status");
CREATE INDEX "SecurityAlert_severity_idx" ON "SecurityAlert"("severity");
CREATE INDEX "SecurityAlert_occurredAt_idx" ON "SecurityAlert"("occurredAt");

ALTER TABLE "IoTDevice" ADD CONSTRAINT "IoTDevice_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CameraFeed" ADD CONSTRAINT "CameraFeed_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CameraFeed" ADD CONSTRAINT "CameraFeed_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "IoTDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DoorAccessEvent" ADD CONSTRAINT "DoorAccessEvent_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DoorStatus" ADD CONSTRAINT "DoorStatus_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DoorStatus" ADD CONSTRAINT "DoorStatus_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "IoTDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "IoTDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityAlert" ADD CONSTRAINT "SecurityAlert_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityAlert" ADD CONSTRAINT "SecurityAlert_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "IoTDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityAlert" ADD CONSTRAINT "SecurityAlert_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityAlert" ADD CONSTRAINT "SecurityAlert_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
