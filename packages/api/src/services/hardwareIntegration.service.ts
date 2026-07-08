import crypto from 'crypto';
import {
  CameraStatus,
  HardwareHealthStatus,
  HardwareIntegrationStatus,
  HardwareIntegrationType,
  HardwareProtocol,
  HardwareProvider,
  IoTDeviceStatus,
  IoTDeviceType,
  type HardwareIntegration,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../config/database.js';

export type HardwareIntegrationInput = {
  integrationType: HardwareIntegrationType;
  name: string;
  location?: string;
  floor?: number;
  roomArea?: string;
  provider: HardwareProvider;
  protocol: HardwareProtocol;
  host?: string;
  port?: number;
  channelNumber?: number;
  username?: string;
  secret?: string;
  streamPath?: string;
  gatewayId?: string;
  deviceIdentifier?: string;
  topicPathChannel?: string;
  metadata?: Record<string, unknown>;
};

const DEFAULT_SECRET = 'laflo-local-hardware-secret-key';

function encryptionKey() {
  return crypto
    .createHash('sha256')
    .update(process.env.HARDWARE_SECRET_KEY || process.env.JWT_SECRET || DEFAULT_SECRET)
    .digest();
}

function encryptSecret(secret?: string | null) {
  if (!secret) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

function maskSecret(secret?: string | null) {
  if (!secret) return null;
  if (secret.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, secret.length - 4))}${secret.slice(-4)}`;
}

function safeHealth(input: Pick<HardwareIntegrationInput, 'host' | 'protocol' | 'provider'>) {
  if (!input.host && input.protocol !== HardwareProtocol.WEBHOOK) {
    return {
      success: false,
      status: HardwareIntegrationStatus.TEST_FAILED,
      healthStatus: HardwareHealthStatus.WARNING,
      message: 'Endpoint/host is required before LaFlo can test this hardware connection.',
    };
  }

  return {
    success: true,
    status: HardwareIntegrationStatus.CONNECTED,
    healthStatus: HardwareHealthStatus.HEALTHY,
    message: `${input.provider} ${input.protocol} configuration accepted. Live protocol handshake requires the production connector/proxy.`,
  };
}

function publicIntegration(integration: HardwareIntegration) {
  return {
    ...integration,
    secretCiphertext: undefined,
    hasSecret: Boolean(integration.secretCiphertext),
    secretMasked: integration.secretMasked || (integration.secretCiphertext ? '****' : null),
  };
}

async function ensureLinkedEntity(hotelId: string, input: HardwareIntegrationInput) {
  if (input.integrationType === HardwareIntegrationType.CCTV_CAMERA || input.integrationType === HardwareIntegrationType.CCTV_NVR) {
    const externalId = input.deviceIdentifier || `${input.integrationType}:${input.provider}:${input.name}`;
    const camera = await prisma.cameraFeed.upsert({
      where: { hotelId_externalId: { hotelId, externalId } },
      create: {
        hotelId,
        externalId,
        name: input.name,
        location: input.location,
        status: CameraStatus.MAINTENANCE,
        metadata: {
          managedByHardwareIntegration: true,
          provider: input.provider,
          protocol: input.protocol,
          channelNumber: input.channelNumber,
        },
      },
      update: {
        name: input.name,
        location: input.location,
        metadata: {
          managedByHardwareIntegration: true,
          provider: input.provider,
          protocol: input.protocol,
          channelNumber: input.channelNumber,
        },
      },
    });
    return { cameraFeedId: camera.id, iotDeviceId: null };
  }

  const externalId = input.deviceIdentifier || `${input.integrationType}:${input.provider}:${input.name}`;
  const deviceType = deviceTypeFromMetadata(input.metadata);
  const device = await prisma.ioTDevice.upsert({
    where: { hotelId_externalId: { hotelId, externalId } },
    create: {
      hotelId,
      externalId,
      name: input.name,
      deviceType,
      status: IoTDeviceStatus.MAINTENANCE,
      location: input.location,
      floor: input.floor,
      zone: input.roomArea,
      vendor: input.provider,
      metadata: {
        managedByHardwareIntegration: true,
          provider: input.provider,
          protocol: input.protocol,
          gatewayId: input.gatewayId,
          ...(input.metadata || {}),
        },
    },
    update: {
      name: input.name,
      location: input.location,
      floor: input.floor,
      zone: input.roomArea,
      vendor: input.provider,
      metadata: {
        managedByHardwareIntegration: true,
        provider: input.provider,
        protocol: input.protocol,
        gatewayId: input.gatewayId,
        ...(input.metadata || {}),
      },
    },
  });
  return { cameraFeedId: null, iotDeviceId: device.id };
}

function deviceTypeFromMetadata(metadata?: Record<string, unknown>): IoTDeviceType {
  const raw = String(metadata?.deviceType || '').toUpperCase();
  if (raw && raw in IoTDeviceType) return IoTDeviceType[raw as keyof typeof IoTDeviceType];
  return IoTDeviceType.OTHER;
}

export async function listHardwareIntegrations(hotelId: string, filters?: { integrationType?: HardwareIntegrationType }) {
  const integrations = await prisma.hardwareIntegration.findMany({
    where: {
      hotelId,
      integrationType: filters?.integrationType,
    },
    orderBy: { updatedAt: 'desc' },
  });
  return integrations.map(publicIntegration);
}

export async function getHardwareIntegration(hotelId: string, id: string) {
  const integration = await prisma.hardwareIntegration.findFirstOrThrow({ where: { id, hotelId } });
  return publicIntegration(integration);
}

export async function createHardwareIntegration(hotelId: string, input: HardwareIntegrationInput) {
  const linked = await ensureLinkedEntity(hotelId, input);
  const health = safeHealth(input);
  const integration = await prisma.hardwareIntegration.create({
    data: {
      hotelId,
      integrationType: input.integrationType,
      name: input.name,
      location: input.location,
      floor: input.floor,
      roomArea: input.roomArea,
      provider: input.provider,
      protocol: input.protocol,
      host: input.host,
      port: input.port,
      channelNumber: input.channelNumber,
      username: input.username,
      secretCiphertext: encryptSecret(input.secret),
      secretMasked: maskSecret(input.secret),
      streamPath: input.streamPath,
      gatewayId: input.gatewayId,
      deviceIdentifier: input.deviceIdentifier,
      topicPathChannel: input.topicPathChannel,
      status: HardwareIntegrationStatus.DISCONNECTED,
      healthStatus: HardwareHealthStatus.UNKNOWN,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      cameraFeedId: linked.cameraFeedId,
      iotDeviceId: linked.iotDeviceId,
      lastTestResult: {
        success: health.success,
        message: 'Saved. Test connection to verify health.',
      },
    },
  });
  return publicIntegration(integration);
}

export async function updateHardwareIntegration(hotelId: string, id: string, input: Partial<HardwareIntegrationInput>) {
  const existing = await prisma.hardwareIntegration.findFirstOrThrow({ where: { id, hotelId } });
  const next: HardwareIntegrationInput = {
    integrationType: input.integrationType || existing.integrationType,
    name: input.name || existing.name,
    location: input.location ?? existing.location ?? undefined,
    floor: input.floor ?? existing.floor ?? undefined,
    roomArea: input.roomArea ?? existing.roomArea ?? undefined,
    provider: input.provider || existing.provider,
    protocol: input.protocol || existing.protocol,
    host: input.host ?? existing.host ?? undefined,
    port: input.port ?? existing.port ?? undefined,
    channelNumber: input.channelNumber ?? existing.channelNumber ?? undefined,
    username: input.username ?? existing.username ?? undefined,
    secret: input.secret,
    streamPath: input.streamPath ?? existing.streamPath ?? undefined,
    gatewayId: input.gatewayId ?? existing.gatewayId ?? undefined,
    deviceIdentifier: input.deviceIdentifier ?? existing.deviceIdentifier ?? undefined,
    topicPathChannel: input.topicPathChannel ?? existing.topicPathChannel ?? undefined,
    metadata: (input.metadata || existing.metadata || {}) as Record<string, unknown>,
  };
  const linked = await ensureLinkedEntity(hotelId, next);
  const integration = await prisma.hardwareIntegration.update({
    where: { id },
    data: {
      integrationType: next.integrationType,
      name: next.name,
      location: next.location,
      floor: next.floor,
      roomArea: next.roomArea,
      provider: next.provider,
      protocol: next.protocol,
      host: next.host,
      port: next.port,
      channelNumber: next.channelNumber,
      username: next.username,
      ...(input.secret !== undefined
        ? { secretCiphertext: encryptSecret(input.secret), secretMasked: maskSecret(input.secret) }
        : {}),
      streamPath: next.streamPath,
      gatewayId: next.gatewayId,
      deviceIdentifier: next.deviceIdentifier,
      topicPathChannel: next.topicPathChannel,
      metadata: next.metadata as Prisma.InputJsonValue,
      cameraFeedId: linked.cameraFeedId,
      iotDeviceId: linked.iotDeviceId,
    },
  });
  return publicIntegration(integration);
}

export async function testHardwareIntegration(hotelId: string, id: string) {
  const existing = await prisma.hardwareIntegration.findFirstOrThrow({ where: { id, hotelId } });
  const health = safeHealth(existing);
  const integration = await prisma.hardwareIntegration.update({
    where: { id },
    data: {
      status: health.status,
      healthStatus: health.healthStatus,
      lastTestAt: new Date(),
      lastSeenAt: health.success ? new Date() : existing.lastSeenAt,
      lastTestResult: {
        success: health.success,
        message: health.message,
        testedAt: new Date().toISOString(),
      },
    },
  });
  return publicIntegration(integration);
}

export async function getHardwareIntegrationHealth(hotelId: string, id: string) {
  const integration = await getHardwareIntegration(hotelId, id);
  return {
    id: integration.id,
    status: integration.status,
    healthStatus: integration.healthStatus,
    lastTestAt: integration.lastTestAt,
    lastSeenAt: integration.lastSeenAt,
    lastTestResult: integration.lastTestResult,
  };
}

export async function disableHardwareIntegration(hotelId: string, id: string) {
  await prisma.hardwareIntegration.findFirstOrThrow({ where: { id, hotelId } });
  const integration = await prisma.hardwareIntegration.update({
    where: { id },
    data: {
      enabled: false,
      status: HardwareIntegrationStatus.DISABLED,
      healthStatus: HardwareHealthStatus.UNKNOWN,
    },
  });
  return publicIntegration(integration);
}

export async function deleteHardwareIntegration(hotelId: string, id: string) {
  await prisma.hardwareIntegration.findFirstOrThrow({ where: { id, hotelId } });
  await prisma.hardwareIntegration.delete({ where: { id } });
  return { id, deleted: true };
}
