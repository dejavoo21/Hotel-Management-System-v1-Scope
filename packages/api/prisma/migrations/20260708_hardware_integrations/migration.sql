DO $$ BEGIN
  ALTER TYPE "IoTDeviceType" ADD VALUE IF NOT EXISTS 'DOOR_SENSOR';
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "IoTDeviceType" ADD VALUE IF NOT EXISTS 'ELEVATOR';
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "HardwareIntegrationType" AS ENUM (
    'CCTV_CAMERA',
    'CCTV_NVR',
    'SMART_DEVICE',
    'SMART_GATEWAY'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "HardwareProvider" AS ENUM (
    'HIKVISION',
    'DAHUA',
    'AXIS',
    'ONVIF',
    'GENERIC_RTSP',
    'GENERIC_HLS',
    'GENERIC_MJPEG',
    'MQTT',
    'BACNET',
    'MODBUS',
    'REST_API',
    'WEBHOOK',
    'VENDOR_API',
    'TTLOCK',
    'SALTO',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "HardwareProtocol" AS ENUM (
    'RTSP',
    'HLS',
    'MJPEG',
    'ONVIF',
    'MQTT',
    'BACNET',
    'MODBUS',
    'REST_API',
    'WEBHOOK',
    'VENDOR_API'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "HardwareIntegrationStatus" AS ENUM (
    'CONNECTED',
    'DISCONNECTED',
    'DEGRADED',
    'DISABLED',
    'TEST_FAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "HardwareHealthStatus" AS ENUM (
    'HEALTHY',
    'WARNING',
    'CRITICAL',
    'UNKNOWN'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "HardwareIntegration" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "integrationType" "HardwareIntegrationType" NOT NULL,
  "name" TEXT NOT NULL,
  "location" TEXT,
  "floor" INTEGER,
  "roomArea" TEXT,
  "provider" "HardwareProvider" NOT NULL,
  "protocol" "HardwareProtocol" NOT NULL,
  "host" TEXT,
  "port" INTEGER,
  "channelNumber" INTEGER,
  "username" TEXT,
  "secretCiphertext" TEXT,
  "secretMasked" TEXT,
  "streamPath" TEXT,
  "gatewayId" TEXT,
  "deviceIdentifier" TEXT,
  "topicPathChannel" TEXT,
  "status" "HardwareIntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
  "healthStatus" "HardwareHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastTestAt" TIMESTAMP(3),
  "lastTestResult" JSONB,
  "lastSeenAt" TIMESTAMP(3),
  "metadata" JSONB,
  "cameraFeedId" TEXT,
  "iotDeviceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HardwareIntegration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HardwareIntegration_hotelId_idx" ON "HardwareIntegration"("hotelId");
CREATE INDEX IF NOT EXISTS "HardwareIntegration_integrationType_idx" ON "HardwareIntegration"("integrationType");
CREATE INDEX IF NOT EXISTS "HardwareIntegration_provider_idx" ON "HardwareIntegration"("provider");
CREATE INDEX IF NOT EXISTS "HardwareIntegration_protocol_idx" ON "HardwareIntegration"("protocol");
CREATE INDEX IF NOT EXISTS "HardwareIntegration_status_idx" ON "HardwareIntegration"("status");
CREATE INDEX IF NOT EXISTS "HardwareIntegration_enabled_idx" ON "HardwareIntegration"("enabled");

DO $$ BEGIN
  ALTER TABLE "HardwareIntegration" ADD CONSTRAINT "HardwareIntegration_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "HardwareIntegration" ADD CONSTRAINT "HardwareIntegration_cameraFeedId_fkey" FOREIGN KEY ("cameraFeedId") REFERENCES "CameraFeed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "HardwareIntegration" ADD CONSTRAINT "HardwareIntegration_iotDeviceId_fkey" FOREIGN KEY ("iotDeviceId") REFERENCES "IoTDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
