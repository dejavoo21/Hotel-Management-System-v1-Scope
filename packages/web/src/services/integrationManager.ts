import api from './api';

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

export type IntegrationManagerProvider = {
  id: string;
  category: IntegrationManagerCategory;
  name: string;
  providerType: string;
  connectionMethods: string[];
  credentialFields: Array<{ key: string; label: string; secret?: boolean; required?: boolean }>;
  status: 'AVAILABLE' | 'FUTURE' | 'ENVIRONMENT_CONFIGURED';
};

export type IntegrationCategoryCard = {
  category: IntegrationManagerCategory;
  label: string;
  providerName: string;
  connectionStatus: 'Connected' | 'Not Connected' | 'Requires Attention' | 'Sync Failed' | 'Credentials Expired' | 'Disabled';
  connectedCount: number;
  totalConfigured: number;
  lastSyncAt?: string | null;
  healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
  errorCount: number;
  action: 'Configure' | 'Manage' | 'View Logs';
};

export type IntegrationManagerLog = {
  id: string;
  integrationId: string;
  category: IntegrationManagerCategory;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  createdAt: string;
};

export type IntegrationManagerDevice = {
  id: string;
  category: IntegrationManagerCategory;
  name: string;
  provider: string;
  protocol: string;
  location?: string | null;
  roomArea?: string | null;
  floor?: number | null;
  status: string;
  healthStatus: string;
  lastSuccessfulConnectionAt?: string | null;
  credentialReference: string;
  credentialMasked?: string | null;
  linkedEntityId?: string | null;
  updatedAt: string;
};

export type IntegrationManagerOverview = {
  setupSteps: string[];
  categories: IntegrationCategoryCard[];
  registry: IntegrationManagerProvider[];
  recentLogs: IntegrationManagerLog[];
};

const integrationManagerService = {
  async overview(): Promise<IntegrationManagerOverview> {
    const response = await api.get('/integration-manager/overview', { params: { _ts: Date.now() } });
    return response.data.data;
  },

  async registry(): Promise<IntegrationManagerProvider[]> {
    const response = await api.get('/integration-manager/registry');
    return response.data.data;
  },

  async logs(): Promise<IntegrationManagerLog[]> {
    const response = await api.get('/integration-manager/logs', { params: { _ts: Date.now() } });
    return response.data.data;
  },

  async devices(category?: IntegrationManagerCategory): Promise<IntegrationManagerDevice[]> {
    const response = await api.get('/integration-manager/devices', { params: category ? { category } : undefined });
    return response.data.data;
  },

  async publishEvent(eventType: string, integrationId?: string, payload?: Record<string, unknown>): Promise<unknown> {
    const response = await api.post('/integration-manager/events', { eventType, integrationId, payload });
    return response.data.data;
  },
};

export default integrationManagerService;
