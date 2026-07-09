import {
  HardwareHealthStatus,
  HardwareIntegrationStatus,
  HardwareIntegrationType,
  type HardwareIntegration,
} from '@prisma/client';
import { prisma } from '../config/database.js';
import { getIntegrationLogs, listIntegrations, type IntegrationProvider } from '../platform/integrations/integrationHub.service.js';

export type IntegrationManagerCategory =
  | 'CCTV'
  | 'SMART_LOCKS'
  | 'SENSORS'
  | 'HVAC'
  | 'ENERGY_METERS'
  | 'WEATHER'
  | 'PAYMENTS'
  | 'BOOKING_CHANNELS'
  | 'MICROSOFT_365'
  | 'AI_PROVIDERS'
  | 'OTHER_PROVIDERS';

type ProviderRegistryItem = {
  id: string;
  category: IntegrationManagerCategory;
  name: string;
  providerType: string;
  connectionMethods: string[];
  credentialFields: Array<{ key: string; label: string; secret?: boolean; required?: boolean }>;
  status: 'AVAILABLE' | 'FUTURE' | 'ENVIRONMENT_CONFIGURED';
};

const setupSteps = [
  'Select Integration Category',
  'Select Provider / Connection Method',
  'Enter Connection Details',
  'Test Connection',
  'Discover / Import Devices',
  'Map Devices to Hotel Areas',
  'Save Integration',
  'Publish Integration Event',
];

export const providerRegistry: ProviderRegistryItem[] = [
  { id: 'usb-local-camera', category: 'CCTV', name: 'USB / Local Camera', providerType: 'USB_LOCAL', connectionMethods: ['BROWSER_CAMERA'], credentialFields: [], status: 'AVAILABLE' },
  { id: 'onvif-ip-camera', category: 'CCTV', name: 'ONVIF IP Camera', providerType: 'ONVIF', connectionMethods: ['ONVIF'], credentialFields: endpointCredentialFields(), status: 'AVAILABLE' },
  { id: 'manual-rtsp-camera', category: 'CCTV', name: 'Manual RTSP Camera', providerType: 'GENERIC_RTSP', connectionMethods: ['RTSP'], credentialFields: endpointCredentialFields(), status: 'AVAILABLE' },
  { id: 'hls-camera', category: 'CCTV', name: 'HLS Camera', providerType: 'GENERIC_HLS', connectionMethods: ['HLS'], credentialFields: endpointCredentialFields(), status: 'AVAILABLE' },
  { id: 'mjpeg-camera', category: 'CCTV', name: 'MJPEG Camera', providerType: 'GENERIC_MJPEG', connectionMethods: ['MJPEG'], credentialFields: endpointCredentialFields(), status: 'AVAILABLE' },
  { id: 'hikvision-nvr', category: 'CCTV', name: 'Hikvision NVR', providerType: 'HIKVISION', connectionMethods: ['ONVIF', 'RTSP', 'VENDOR_API'], credentialFields: endpointCredentialFields(), status: 'AVAILABLE' },
  { id: 'dahua-nvr', category: 'CCTV', name: 'Dahua NVR', providerType: 'DAHUA', connectionMethods: ['ONVIF', 'RTSP', 'VENDOR_API'], credentialFields: endpointCredentialFields(), status: 'AVAILABLE' },
  { id: 'axis', category: 'CCTV', name: 'Axis', providerType: 'AXIS', connectionMethods: ['ONVIF', 'RTSP'], credentialFields: endpointCredentialFields(), status: 'AVAILABLE' },
  { id: 'generic-onvif-nvr', category: 'CCTV', name: 'Generic ONVIF NVR', providerType: 'ONVIF', connectionMethods: ['ONVIF'], credentialFields: endpointCredentialFields(), status: 'AVAILABLE' },
  { id: 'verkada', category: 'CCTV', name: 'Verkada', providerType: 'VERKADA', connectionMethods: ['CLOUD_API'], credentialFields: cloudCredentialFields(), status: 'FUTURE' },
  { id: 'eagle-eye', category: 'CCTV', name: 'Eagle Eye', providerType: 'EAGLE_EYE', connectionMethods: ['CLOUD_API'], credentialFields: cloudCredentialFields(), status: 'FUTURE' },
  { id: 'rhombus', category: 'CCTV', name: 'Rhombus', providerType: 'RHOMBUS', connectionMethods: ['CLOUD_API'], credentialFields: cloudCredentialFields(), status: 'FUTURE' },
  { id: 'other-cloud-cctv', category: 'CCTV', name: 'Other Cloud Provider', providerType: 'OTHER', connectionMethods: ['CLOUD_API'], credentialFields: cloudCredentialFields(), status: 'FUTURE' },

  { id: 'smart-locks', category: 'SMART_LOCKS', name: 'Smart Locks', providerType: 'SMART_LOCK', connectionMethods: ['MQTT', 'REST_API', 'VENDOR_API'], credentialFields: endpointCredentialFields(), status: 'AVAILABLE' },
  { id: 'motion-sensors', category: 'SENSORS', name: 'Motion Sensors', providerType: 'MOTION_SENSOR', connectionMethods: ['MQTT', 'BACNET', 'MODBUS'], credentialFields: endpointCredentialFields(), status: 'AVAILABLE' },
  { id: 'door-sensors', category: 'SENSORS', name: 'Door Sensors', providerType: 'DOOR_SENSOR', connectionMethods: ['MQTT', 'REST_API'], credentialFields: endpointCredentialFields(), status: 'AVAILABLE' },
  { id: 'temperature-sensors', category: 'SENSORS', name: 'Temperature Sensors', providerType: 'TEMPERATURE_SENSOR', connectionMethods: ['MQTT', 'BACNET', 'MODBUS'], credentialFields: endpointCredentialFields(), status: 'AVAILABLE' },
  { id: 'occupancy-sensors', category: 'SENSORS', name: 'Occupancy Sensors', providerType: 'OCCUPANCY_SENSOR', connectionMethods: ['MQTT', 'BACNET'], credentialFields: endpointCredentialFields(), status: 'AVAILABLE' },
  { id: 'hvac-controllers', category: 'HVAC', name: 'HVAC Controllers', providerType: 'HVAC', connectionMethods: ['BACNET', 'MODBUS', 'REST_API'], credentialFields: endpointCredentialFields(), status: 'AVAILABLE' },
  { id: 'energy-meters', category: 'ENERGY_METERS', name: 'Energy Meters', providerType: 'ENERGY_METER', connectionMethods: ['BACNET', 'MODBUS', 'MQTT'], credentialFields: endpointCredentialFields(), status: 'AVAILABLE' },
  { id: 'water-leak-sensors', category: 'SENSORS', name: 'Water Leak Sensors', providerType: 'WATER_LEAK_SENSOR', connectionMethods: ['MQTT', 'WEBHOOK'], credentialFields: endpointCredentialFields(), status: 'AVAILABLE' },
  { id: 'fire-smoke-sensors', category: 'SENSORS', name: 'Fire / Smoke Sensors', providerType: 'FIRE_SMOKE_SENSOR', connectionMethods: ['MQTT', 'BACNET', 'WEBHOOK'], credentialFields: endpointCredentialFields(), status: 'FUTURE' },
  { id: 'generic-iot-device', category: 'OTHER_PROVIDERS', name: 'Generic IoT Device', providerType: 'GENERIC_IOT', connectionMethods: ['MQTT', 'REST_API', 'WEBHOOK'], credentialFields: endpointCredentialFields(), status: 'AVAILABLE' },
];

function endpointCredentialFields() {
  return [
    { key: 'host', label: 'Host / URL', required: true },
    { key: 'port', label: 'Port' },
    { key: 'username', label: 'Username' },
    { key: 'secret', label: 'Password / API key', secret: true },
  ];
}

function cloudCredentialFields() {
  return [
    { key: 'apiBaseUrl', label: 'API base URL', required: true },
    { key: 'apiKey', label: 'API key', secret: true, required: true },
    { key: 'tenantId', label: 'Tenant / org ID' },
  ];
}

function categoryForHardware(item: HardwareIntegration): IntegrationManagerCategory {
  if (item.integrationType === HardwareIntegrationType.CCTV_CAMERA || item.integrationType === HardwareIntegrationType.CCTV_NVR) return 'CCTV';
  const deviceType = String((item.metadata as any)?.deviceType || '').toUpperCase();
  if (deviceType.includes('LOCK')) return 'SMART_LOCKS';
  if (deviceType.includes('HVAC')) return 'HVAC';
  if (deviceType.includes('ENERGY')) return 'ENERGY_METERS';
  if (['MOTION_SENSOR', 'DOOR_SENSOR', 'TEMPERATURE_SENSOR', 'WATER_LEAK_SENSOR', 'PANIC_BUTTON'].includes(deviceType)) return 'SENSORS';
  return 'OTHER_PROVIDERS';
}

function categoryForProvider(provider: IntegrationProvider): IntegrationManagerCategory {
  if (provider.category === 'WEATHER') return 'WEATHER';
  if (provider.category === 'PAYMENTS') return 'PAYMENTS';
  if (provider.category === 'OTA') return 'BOOKING_CHANNELS';
  if (provider.id === 'microsoft-365') return 'MICROSOFT_365';
  if (provider.category === 'AI') return 'AI_PROVIDERS';
  if (provider.category === 'CCTV') return 'CCTV';
  if (provider.category === 'SMART_LOCKS') return 'SMART_LOCKS';
  if (provider.category === 'IOT') return 'OTHER_PROVIDERS';
  return 'OTHER_PROVIDERS';
}

function statusFromHardware(item: HardwareIntegration) {
  if (!item.enabled || item.status === HardwareIntegrationStatus.DISABLED) return 'Disabled';
  if (item.status === HardwareIntegrationStatus.CONNECTED) return 'Connected';
  if (item.status === HardwareIntegrationStatus.TEST_FAILED) return 'Sync Failed';
  if (item.healthStatus === HardwareHealthStatus.WARNING || item.healthStatus === HardwareHealthStatus.CRITICAL) return 'Requires Attention';
  return 'Not Connected';
}

function healthFromHardware(item: HardwareIntegration) {
  if (!item.enabled) return 'DISABLED';
  if (item.healthStatus === HardwareHealthStatus.HEALTHY) return 'HEALTHY';
  if (item.healthStatus === HardwareHealthStatus.WARNING) return 'WARNING';
  if (item.healthStatus === HardwareHealthStatus.CRITICAL) return 'CRITICAL';
  return 'UNKNOWN';
}

export async function getIntegrationManagerOverview(hotelId: string) {
  const hardware = await prisma.hardwareIntegration.findMany({
    where: { hotelId },
    orderBy: { updatedAt: 'desc' },
  });
  const marketplace = listIntegrations();
  const categories = providerRegistry.reduce((acc, provider) => {
    acc.add(provider.category);
    return acc;
  }, new Set<IntegrationManagerCategory>());
  marketplace.forEach((provider) => categories.add(categoryForProvider(provider)));

  const cards = Array.from(categories).map((category) => {
    const hardwareItems = hardware.filter((item) => categoryForHardware(item) === category);
    const marketplaceItems = marketplace.filter((provider) => categoryForProvider(provider) === category);
    const connectedHardware = hardwareItems.filter((item) => item.status === HardwareIntegrationStatus.CONNECTED && item.enabled);
    const configuredMarketplace = marketplaceItems.filter((provider) => provider.status === 'CONFIGURED');
    const failedHardware = hardwareItems.filter((item) => item.status === HardwareIntegrationStatus.TEST_FAILED || item.healthStatus === HardwareHealthStatus.CRITICAL);
    const providerName = connectedHardware[0]?.provider || configuredMarketplace[0]?.name || marketplaceItems[0]?.name || providerRegistry.find((p) => p.category === category)?.name || 'Not selected';
    const latestHardware = hardwareItems[0];
    const latestProvider = marketplaceItems.find((provider) => provider.lastSyncAt);

    return {
      category,
      label: labelize(category),
      providerName,
      connectionStatus:
        failedHardware.length > 0
          ? 'Requires Attention'
          : connectedHardware.length + configuredMarketplace.length > 0
            ? 'Connected'
            : 'Not Connected',
      connectedCount: connectedHardware.length + configuredMarketplace.length,
      totalConfigured: hardwareItems.length + configuredMarketplace.length,
      lastSyncAt: latestHardware?.lastTestAt || latestHardware?.lastSeenAt || latestProvider?.lastSyncAt || null,
      healthStatus: failedHardware.length > 0 ? 'WARNING' : connectedHardware.length + configuredMarketplace.length > 0 ? 'HEALTHY' : 'UNKNOWN',
      errorCount: failedHardware.length,
      action: hardwareItems.length || marketplaceItems.length ? 'Manage' : 'Configure',
    };
  });

  return {
    setupSteps,
    categories: cards,
    registry: providerRegistry,
    recentLogs: await getIntegrationManagerLogs(hotelId),
  };
}

export async function getIntegrationManagerLogs(hotelId: string) {
  const hardware = await prisma.hardwareIntegration.findMany({
    where: { hotelId },
    orderBy: { updatedAt: 'desc' },
    take: 30,
  });
  const hardwareLogs = hardware.map((item) => ({
    id: `hardware:${item.id}`,
    integrationId: item.id,
    category: categoryForHardware(item),
    level: item.status === HardwareIntegrationStatus.TEST_FAILED ? 'ERROR' : item.healthStatus === HardwareHealthStatus.WARNING ? 'WARN' : 'INFO',
    message: (item.lastTestResult as any)?.message || `${item.name} ${statusFromHardware(item).toLowerCase()}.`,
    createdAt: (item.lastTestAt || item.updatedAt).toISOString(),
  }));
  const marketplaceLogs = listIntegrations()
    .flatMap((provider) =>
      getIntegrationLogs(provider.id).slice(0, 3).map((log) => ({
        id: log.id,
        integrationId: provider.id,
        category: categoryForProvider(provider),
        level: log.level,
        message: log.message,
        createdAt: log.createdAt,
      }))
    );
  return [...hardwareLogs, ...marketplaceLogs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);
}

export async function getIntegrationManagerDevices(hotelId: string, category?: IntegrationManagerCategory) {
  const hardware = await prisma.hardwareIntegration.findMany({
    where: { hotelId },
    orderBy: { updatedAt: 'desc' },
  });
  return hardware
    .filter((item) => !category || categoryForHardware(item) === category)
    .map((item) => ({
      id: item.id,
      category: categoryForHardware(item),
      name: item.name,
      provider: item.provider,
      protocol: item.protocol,
      location: item.location,
      roomArea: item.roomArea,
      floor: item.floor,
      status: statusFromHardware(item),
      healthStatus: healthFromHardware(item),
      lastSuccessfulConnectionAt: item.status === HardwareIntegrationStatus.CONNECTED ? item.lastTestAt || item.lastSeenAt : null,
      lastSyncResult: item.lastTestResult,
      providerResponseTimeMs: (item.lastTestResult as any)?.responseTimeMs || null,
      failedConnectionAttempts: item.status === HardwareIntegrationStatus.TEST_FAILED ? 1 : 0,
      warningMessages: item.healthStatus === HardwareHealthStatus.WARNING ? [(item.lastTestResult as any)?.message || 'Connection requires attention'] : [],
      credentialReference: `laflo://integration-credentials/${String(item.provider).toLowerCase()}/${item.id}`,
      credentialMasked: item.secretMasked || (item.secretCiphertext ? '****' : null),
      linkedEntityId: item.cameraFeedId || item.iotDeviceId,
      updatedAt: item.updatedAt,
    }));
}

function labelize(value: string) {
  return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
