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
  credentialReference?: string | null;
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
  connectionMethod?: 'MANUAL_CAMERA' | 'CONNECT_NVR' | 'CLOUD_PROVIDER';
  streamKind?: 'HLS' | 'MJPEG' | 'SNAPSHOT' | 'RTSP' | 'ONVIF';
  cloudProvider?: 'VERKADA' | 'EAGLE_EYE' | 'RHOMBUS' | 'OTHER';
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
  async listCctv(): Promise<HardwareIntegration[]> {
    const response = await api.get('/cctv/cameras');
    return unwrap(response);
  },
  async createCctv(payload: HardwareIntegrationPayload): Promise<HardwareIntegration> {
    const response = await api.post('/cctv/cameras', payload);
    return unwrap(response);
  },
  async discoverCctv(payload: { subnet: string; provider?: HardwareProvider }): Promise<{ configured: boolean; message: string; discovered: unknown[] }> {
    const response = await api.post('/cctv/discover', payload);
    return unwrap(response);
  },
  async testNvr(payload: { provider: HardwareProvider; protocol: HardwareProtocol; host: string; port?: number; username?: string; secret?: string; channelCount?: number }): Promise<{ success: boolean; message: string; status: string; healthStatus: string }> {
    const response = await api.post('/cctv/nvr/test', payload);
    return unwrap(response);
  },
  async testCctvCamera(id: string): Promise<HardwareIntegration> {
    const response = await api.post(`/cctv/cameras/${id}/test`);
    return unwrap(response);
  },
  async viewCctvPlayback(id: string): Promise<{ id: string; name: string; status: string; healthStatus: string; message: string }> {
    const response = await api.get(`/cctv/cameras/${id}/playback`);
    return unwrap(response);
  },
};

export default hardwareIntegrationService;
