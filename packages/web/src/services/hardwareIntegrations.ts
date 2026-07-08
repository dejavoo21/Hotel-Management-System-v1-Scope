import api from './api';

export type HardwareIntegrationType = 'CCTV_CAMERA' | 'CCTV_NVR' | 'SMART_DEVICE' | 'SMART_GATEWAY';
export type HardwareProvider =
  | 'HIKVISION'
  | 'DAHUA'
  | 'AXIS'
  | 'ONVIF'
  | 'GENERIC_RTSP'
  | 'GENERIC_HLS'
  | 'GENERIC_MJPEG'
  | 'MQTT'
  | 'BACNET'
  | 'MODBUS'
  | 'REST_API'
  | 'WEBHOOK'
  | 'VENDOR_API'
  | 'TTLOCK'
  | 'SALTO'
  | 'OTHER';
export type HardwareProtocol = 'RTSP' | 'HLS' | 'MJPEG' | 'ONVIF' | 'MQTT' | 'BACNET' | 'MODBUS' | 'REST_API' | 'WEBHOOK' | 'VENDOR_API';

export type HardwareIntegration = {
  id: string;
  integrationType: HardwareIntegrationType;
  name: string;
  location?: string | null;
  floor?: number | null;
  roomArea?: string | null;
  provider: HardwareProvider;
  protocol: HardwareProtocol;
  host?: string | null;
  port?: number | null;
  channelNumber?: number | null;
  username?: string | null;
  secretMasked?: string | null;
  hasSecret?: boolean;
  streamPath?: string | null;
  gatewayId?: string | null;
  deviceIdentifier?: string | null;
  topicPathChannel?: string | null;
  status: 'CONNECTED' | 'DISCONNECTED' | 'DEGRADED' | 'DISABLED' | 'TEST_FAILED';
  healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
  enabled: boolean;
  lastTestAt?: string | null;
  lastTestResult?: { success?: boolean; message?: string; testedAt?: string } | null;
  lastSeenAt?: string | null;
  cameraFeedId?: string | null;
  iotDeviceId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type HardwareIntegrationPayload = {
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

const unwrap = <T>(response: { data: { data: T } }) => response.data.data;

export const hardwareIntegrationService = {
  async list(integrationType?: HardwareIntegrationType): Promise<HardwareIntegration[]> {
    const response = await api.get('/hardware-integrations', {
      params: integrationType ? { integrationType } : undefined,
    });
    return unwrap(response);
  },
  async create(payload: HardwareIntegrationPayload): Promise<HardwareIntegration> {
    const response = await api.post('/hardware-integrations', payload);
    return unwrap(response);
  },
  async update(id: string, payload: Partial<HardwareIntegrationPayload>): Promise<HardwareIntegration> {
    const response = await api.patch(`/hardware-integrations/${id}`, payload);
    return unwrap(response);
  },
  async test(id: string): Promise<HardwareIntegration> {
    const response = await api.post(`/hardware-integrations/${id}/test`);
    return unwrap(response);
  },
  async disable(id: string): Promise<HardwareIntegration> {
    const response = await api.post(`/hardware-integrations/${id}/disable`);
    return unwrap(response);
  },
  async view(id: string): Promise<{ id: string; name: string; status: string; healthStatus: string; message: string }> {
    const response = await api.post(`/hardware-integrations/${id}/view`);
    return unwrap(response);
  },
};

export default hardwareIntegrationService;
