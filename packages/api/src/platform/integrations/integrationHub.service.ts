import { config } from '../../config/index.js';

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

export type IntegrationCapability =
  | 'forecast.read'
  | 'email.send'
  | 'sms.send'
  | 'voice.call'
  | 'payment.intent'
  | 'payment.refund'
  | 'booking.sync'
  | 'calendar.sync'
  | 'workspace.sync'
  | 'chat.notify'
  | 'lock.event_ingest'
  | 'camera.status_ingest'
  | 'mqtt.event_ingest'
  | 'ai.chat'
  | 'ai.tool_call';

export type IntegrationHealth = 'HEALTHY' | 'DEGRADED' | 'DISCONNECTED' | 'NOT_CONFIGURED' | 'FUTURE';

export type IntegrationConfigField = {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select' | 'boolean';
  required: boolean;
  secret?: boolean;
  placeholder?: string;
};

export type IntegrationLogEntry = {
  id: string;
  providerId: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  createdAt: string;
};

export type IntegrationProvider = {
  id: string;
  name: string;
  category: IntegrationCategory;
  capabilities: IntegrationCapability[];
  status: 'CONFIGURED' | 'PARTIAL' | 'NOT_CONFIGURED' | 'FUTURE';
  health: IntegrationHealth;
  version: string;
  lastSyncAt: string | null;
  configuration: IntegrationConfigField[];
  docsUrl?: string;
  extractionReady: boolean;
  notes?: string;
};

const providers = new Map<string, IntegrationProvider>();
const logs = new Map<string, IntegrationLogEntry[]>();

function createLog(providerId: string, level: IntegrationLogEntry['level'], message: string): IntegrationLogEntry {
  return {
    id: `${providerId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    providerId,
    level,
    message,
    createdAt: new Date().toISOString(),
  };
}

function addLog(providerId: string, level: IntegrationLogEntry['level'], message: string) {
  const next = [createLog(providerId, level, message), ...(logs.get(providerId) || [])].slice(0, 50);
  logs.set(providerId, next);
  return next[0];
}

function healthFromStatus(status: IntegrationProvider['status']): IntegrationHealth {
  if (status === 'CONFIGURED') return 'HEALTHY';
  if (status === 'PARTIAL') return 'DEGRADED';
  if (status === 'FUTURE') return 'FUTURE';
  return 'NOT_CONFIGURED';
}

export function registerIntegration(provider: IntegrationProvider) {
  const normalized = {
    ...provider,
    health: provider.health || healthFromStatus(provider.status),
    lastSyncAt: provider.lastSyncAt ?? null,
    version: provider.version || '1.0.0',
  };
  providers.set(provider.id, normalized);
  if (!logs.has(provider.id)) {
    logs.set(provider.id, [
      createLog(provider.id, provider.status === 'CONFIGURED' ? 'INFO' : 'WARN', `${provider.name} registered with status ${provider.status}.`),
    ]);
  }
  return normalized;
}

export function getIntegration(providerId: string) {
  return providers.get(providerId) || null;
}

export function getIntegrationLogs(providerId: string) {
  return logs.get(providerId) || [];
}

export function listIntegrations(filters: { category?: IntegrationCategory; capability?: IntegrationCapability } = {}) {
  return Array.from(providers.values())
    .filter((provider) => !filters.category || provider.category === filters.category)
    .filter((provider) => !filters.capability || provider.capabilities.includes(filters.capability));
}

export function testIntegration(providerId: string) {
  const provider = getIntegration(providerId);
  if (!provider) return null;
  const healthy = provider.status === 'CONFIGURED';
  addLog(
    providerId,
    healthy ? 'INFO' : provider.status === 'FUTURE' ? 'WARN' : 'ERROR',
    healthy
      ? 'Connection test succeeded.'
      : provider.status === 'FUTURE'
        ? 'Connection test unavailable until the connector is enabled.'
        : 'Connection test failed because required configuration is missing.'
  );
  return {
    provider,
    success: healthy,
    health: provider.health,
    message: healthy ? 'Connection healthy' : 'Connector is not fully configured',
  };
}

export function reconnectIntegration(providerId: string) {
  const provider = getIntegration(providerId);
  if (!provider) return null;
  addLog(providerId, provider.status === 'CONFIGURED' ? 'INFO' : 'WARN', 'Reconnect requested from Integration Marketplace.');
  return {
    provider,
    success: provider.status === 'CONFIGURED',
    message:
      provider.status === 'CONFIGURED'
        ? 'Reconnect request accepted.'
        : 'Reconnect requires connector configuration first.',
  };
}

export function disconnectIntegration(providerId: string) {
  const provider = getIntegration(providerId);
  if (!provider) return null;
  addLog(providerId, 'WARN', 'Disconnect requested from Integration Marketplace. Runtime secret revocation must be completed in the vendor console.');
  return {
    provider: {
      ...provider,
      status: provider.status === 'FUTURE' ? provider.status : 'NOT_CONFIGURED',
      health: provider.status === 'FUTURE' ? provider.health : 'DISCONNECTED',
    },
    success: true,
    message: 'Disconnect recorded. Remove or rotate vendor credentials in environment/secret manager to fully disconnect.',
  };
}

export function getIntegrationReadiness() {
  const list = listIntegrations();
  return {
    total: list.length,
    configured: list.filter((provider) => provider.status === 'CONFIGURED').length,
    partial: list.filter((provider) => provider.status === 'PARTIAL').length,
    future: list.filter((provider) => provider.status === 'FUTURE').length,
    providers: list,
  };
}

function statusFromBoolean(value: boolean): IntegrationProvider['status'] {
  return value ? 'CONFIGURED' : 'NOT_CONFIGURED';
}

function baseProvider(input: Omit<IntegrationProvider, 'health' | 'version' | 'lastSyncAt' | 'configuration'> & Partial<Pick<IntegrationProvider, 'health' | 'version' | 'lastSyncAt' | 'configuration'>>) {
  const status = input.status;
  return {
    health: healthFromStatus(status),
    version: '1.0.0',
    lastSyncAt: status === 'CONFIGURED' ? new Date().toISOString() : null,
    configuration: [],
    ...input,
  };
}

registerIntegration(baseProvider({
  id: 'openweather',
  name: 'OpenWeather',
  category: 'WEATHER',
  capabilities: ['forecast.read'],
  status: statusFromBoolean(Boolean(config.openWeather.apiKey)),
  configuration: [{ key: 'OPENWEATHER_API_KEY', label: 'API key', type: 'password', required: true, secret: true }],
  extractionReady: true,
}));

registerIntegration(baseProvider({
  id: 'twilio',
  name: 'Twilio',
  category: 'COMMUNICATIONS',
  capabilities: ['sms.send', 'voice.call'],
  status: config.sms.twilioAccountSid && config.sms.twilioAuthToken ? 'CONFIGURED' : 'PARTIAL',
  configuration: [
    { key: 'TWILIO_ACCOUNT_SID', label: 'Account SID', type: 'password', required: true, secret: true },
    { key: 'TWILIO_AUTH_TOKEN', label: 'Auth token', type: 'password', required: true, secret: true },
    { key: 'SMS_FROM_PHONE', label: 'SMS from phone', type: 'text', required: false },
  ],
  extractionReady: true,
}));

registerIntegration(baseProvider({
  id: 'stripe',
  name: 'Stripe',
  category: 'PAYMENTS',
  capabilities: ['payment.intent', 'payment.refund'],
  status: statusFromBoolean(Boolean(config.stripe.secretKey)),
  configuration: [
    { key: 'STRIPE_SECRET_KEY', label: 'Secret key', type: 'password', required: true, secret: true },
    { key: 'STRIPE_WEBHOOK_SECRET', label: 'Webhook secret', type: 'password', required: false, secret: true },
  ],
  extractionReady: true,
}));

registerIntegration(baseProvider({
  id: 'booking-com',
  name: 'Booking.com',
  category: 'OTA',
  capabilities: ['booking.sync'],
  status: 'FUTURE',
  extractionReady: true,
  notes: 'Future OTA connector should publish reservation and rate events through the Event Bus.',
}));

registerIntegration(baseProvider({
  id: 'expedia',
  name: 'Expedia',
  category: 'OTA',
  capabilities: ['booking.sync'],
  status: 'FUTURE',
  extractionReady: true,
  notes: 'Future OTA connector should publish reservation and rate events through the Event Bus.',
}));

registerIntegration(baseProvider({
  id: 'microsoft-365',
  name: 'Microsoft 365',
  category: 'PRODUCTIVITY',
  capabilities: ['calendar.sync', 'email.send', 'workspace.sync'],
  status: process.env.MICROSOFT_365_CLIENT_ID && process.env.MICROSOFT_365_CLIENT_SECRET ? 'CONFIGURED' : 'FUTURE',
  configuration: [
    { key: 'MICROSOFT_365_CLIENT_ID', label: 'Client ID', type: 'text', required: true },
    { key: 'MICROSOFT_365_CLIENT_SECRET', label: 'Client secret', type: 'password', required: true, secret: true },
    { key: 'MICROSOFT_365_TENANT_ID', label: 'Tenant ID', type: 'text', required: false },
  ],
  extractionReady: true,
  notes: 'Future connector for calendar, email, and workspace events.',
}));

registerIntegration(baseProvider({
  id: 'google-workspace',
  name: 'Google Workspace',
  category: 'PRODUCTIVITY',
  capabilities: ['calendar.sync', 'email.send', 'workspace.sync'],
  status: process.env.GOOGLE_WORKSPACE_CLIENT_ID && process.env.GOOGLE_WORKSPACE_CLIENT_SECRET ? 'CONFIGURED' : 'FUTURE',
  configuration: [
    { key: 'GOOGLE_WORKSPACE_CLIENT_ID', label: 'Client ID', type: 'text', required: true },
    { key: 'GOOGLE_WORKSPACE_CLIENT_SECRET', label: 'Client secret', type: 'password', required: true, secret: true },
  ],
  extractionReady: true,
  notes: 'Future connector for Gmail, Calendar, Drive, and Workspace events.',
}));

registerIntegration(baseProvider({
  id: 'slack',
  name: 'Slack',
  category: 'COMMUNICATIONS',
  capabilities: ['chat.notify'],
  status: process.env.SLACK_BOT_TOKEN ? 'CONFIGURED' : 'FUTURE',
  configuration: [{ key: 'SLACK_BOT_TOKEN', label: 'Bot token', type: 'password', required: true, secret: true }],
  extractionReady: true,
}));

registerIntegration(baseProvider({
  id: 'teams',
  name: 'Teams',
  category: 'COMMUNICATIONS',
  capabilities: ['chat.notify'],
  status: process.env.TEAMS_WEBHOOK_URL ? 'CONFIGURED' : 'FUTURE',
  configuration: [{ key: 'TEAMS_WEBHOOK_URL', label: 'Webhook URL', type: 'url', required: true, secret: true }],
  extractionReady: true,
}));

registerIntegration(baseProvider({
  id: 'ttlock',
  name: 'TTLock',
  category: 'SMART_LOCKS',
  capabilities: ['lock.event_ingest'],
  status: process.env.TTLOCK_CLIENT_ID && process.env.TTLOCK_CLIENT_SECRET ? 'CONFIGURED' : 'FUTURE',
  configuration: [
    { key: 'TTLOCK_CLIENT_ID', label: 'Client ID', type: 'text', required: true },
    { key: 'TTLOCK_CLIENT_SECRET', label: 'Client secret', type: 'password', required: true, secret: true },
  ],
  extractionReady: true,
  notes: 'Adapter should normalize lock events into Smart Building ingestion payloads.',
}));

registerIntegration(baseProvider({
  id: 'salto',
  name: 'SALTO',
  category: 'SMART_LOCKS',
  capabilities: ['lock.event_ingest'],
  status: process.env.SALTO_API_KEY ? 'CONFIGURED' : 'FUTURE',
  configuration: [{ key: 'SALTO_API_KEY', label: 'API key', type: 'password', required: true, secret: true }],
  extractionReady: true,
  notes: 'Adapter should normalize access-control events into Smart Building and Security Center.',
}));

registerIntegration(baseProvider({
  id: 'hikvision',
  name: 'Hikvision',
  category: 'CCTV',
  capabilities: ['camera.status_ingest'],
  status: process.env.HIKVISION_BASE_URL && process.env.HIKVISION_USERNAME ? 'CONFIGURED' : 'FUTURE',
  configuration: [
    { key: 'HIKVISION_BASE_URL', label: 'NVR base URL', type: 'url', required: true },
    { key: 'HIKVISION_USERNAME', label: 'Username', type: 'text', required: true },
    { key: 'HIKVISION_PASSWORD', label: 'Password', type: 'password', required: true, secret: true },
  ],
  extractionReady: true,
  notes: 'NVR adapter should normalize camera status and alerts through the Event Bus.',
}));

registerIntegration(baseProvider({
  id: 'dahua',
  name: 'Dahua',
  category: 'CCTV',
  capabilities: ['camera.status_ingest'],
  status: process.env.DAHUA_BASE_URL && process.env.DAHUA_USERNAME ? 'CONFIGURED' : 'FUTURE',
  configuration: [
    { key: 'DAHUA_BASE_URL', label: 'NVR base URL', type: 'url', required: true },
    { key: 'DAHUA_USERNAME', label: 'Username', type: 'text', required: true },
    { key: 'DAHUA_PASSWORD', label: 'Password', type: 'password', required: true, secret: true },
  ],
  extractionReady: true,
  notes: 'NVR adapter should normalize camera status and alerts through the Event Bus.',
}));

registerIntegration(baseProvider({
  id: 'mqtt',
  name: 'MQTT Bridge',
  category: 'IOT',
  capabilities: ['mqtt.event_ingest'],
  status: process.env.MQTT_BROKER_URL ? 'CONFIGURED' : 'FUTURE',
  configuration: [
    { key: 'MQTT_BROKER_URL', label: 'Broker URL', type: 'url', required: true },
    { key: 'MQTT_USERNAME', label: 'Username', type: 'text', required: false },
    { key: 'MQTT_PASSWORD', label: 'Password', type: 'password', required: false, secret: true },
  ],
  extractionReady: true,
  notes: 'MQTT bridge should live as an adapter process later, but share event schemas with this monorepo.',
}));

registerIntegration(baseProvider({
  id: 'openai',
  name: 'OpenAI',
  category: 'AI',
  capabilities: ['ai.chat', 'ai.tool_call'],
  status:
    process.env.ASSISTANT_PROVIDER?.toLowerCase() === 'none' || !process.env.OPENAI_API_KEY
      ? 'NOT_CONFIGURED'
      : 'CONFIGURED',
  configuration: [{ key: 'OPENAI_API_KEY', label: 'API key', type: 'password', required: true, secret: true }],
  extractionReady: true,
}));
