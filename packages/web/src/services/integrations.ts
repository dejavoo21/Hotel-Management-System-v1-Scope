import api from './api';

export type IntegrationCategory =
  | 'WEATHER'
  | 'COMMUNICATIONS'
  | 'PAYMENTS'
  | 'OTA'
  | 'PRODUCTIVITY'
  | 'SMART_LOCKS'
  | 'CCTV'
  | 'IOT'
  | 'AI';

export type IntegrationStatus = 'CONFIGURED' | 'PARTIAL' | 'NOT_CONFIGURED' | 'FUTURE';
export type IntegrationHealth = 'HEALTHY' | 'DEGRADED' | 'DISCONNECTED' | 'NOT_CONFIGURED' | 'FUTURE';

export type IntegrationConfigField = {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select' | 'boolean';
  required: boolean;
  secret?: boolean;
  placeholder?: string;
};

export type IntegrationProvider = {
  id: string;
  name: string;
  category: IntegrationCategory;
  capabilities: string[];
  status: IntegrationStatus;
  health: IntegrationHealth;
  version: string;
  lastSyncAt: string | null;
  configuration: IntegrationConfigField[];
  docsUrl?: string;
  extractionReady: boolean;
  notes?: string;
};

export type IntegrationLogEntry = {
  id: string;
  providerId: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  createdAt: string;
};

export type IntegrationReadiness = {
  total: number;
  configured: number;
  partial: number;
  future: number;
  providers: IntegrationProvider[];
};

export type IntegrationMarketplaceResponse = {
  readiness: IntegrationReadiness;
  providers: IntegrationProvider[];
};

export type IntegrationActionResult = {
  provider: IntegrationProvider;
  success: boolean;
  health?: IntegrationHealth;
  message: string;
};

const integrationsService = {
  async list(): Promise<IntegrationMarketplaceResponse> {
    const response = await api.get('/integrations', { params: { _ts: Date.now() } });
    return response.data.data as IntegrationMarketplaceResponse;
  },

  async getLogs(providerId: string): Promise<IntegrationLogEntry[]> {
    const response = await api.get(`/integrations/${providerId}/logs`, { params: { _ts: Date.now() } });
    return response.data.data as IntegrationLogEntry[];
  },

  async testConnection(providerId: string): Promise<IntegrationActionResult> {
    const response = await api.post(`/integrations/${providerId}/test`);
    return response.data.data as IntegrationActionResult;
  },

  async reconnect(providerId: string): Promise<IntegrationActionResult> {
    const response = await api.post(`/integrations/${providerId}/reconnect`);
    return response.data.data as IntegrationActionResult;
  },

  async disconnect(providerId: string): Promise<IntegrationActionResult> {
    const response = await api.post(`/integrations/${providerId}/disconnect`);
    return response.data.data as IntegrationActionResult;
  },
};

export default integrationsService;
