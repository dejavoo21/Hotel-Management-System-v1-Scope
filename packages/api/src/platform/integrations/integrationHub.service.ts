import { config } from '../../config/index.js';

export type IntegrationCategory =
  | 'WEATHER'
  | 'COMMUNICATIONS'
  | 'PAYMENTS'
  | 'OTA'
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
  | 'lock.event_ingest'
  | 'camera.status_ingest'
  | 'mqtt.event_ingest'
  | 'ai.chat'
  | 'ai.tool_call';

export type IntegrationProvider = {
  id: string;
  name: string;
  category: IntegrationCategory;
  capabilities: IntegrationCapability[];
  status: 'CONFIGURED' | 'PARTIAL' | 'NOT_CONFIGURED' | 'FUTURE';
  extractionReady: boolean;
  notes?: string;
};

const providers = new Map<string, IntegrationProvider>();

export function registerIntegration(provider: IntegrationProvider) {
  providers.set(provider.id, provider);
  return provider;
}

export function getIntegration(providerId: string) {
  return providers.get(providerId) || null;
}

export function listIntegrations(filters: { category?: IntegrationCategory; capability?: IntegrationCapability } = {}) {
  return Array.from(providers.values())
    .filter((provider) => !filters.category || provider.category === filters.category)
    .filter((provider) => !filters.capability || provider.capabilities.includes(filters.capability));
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

registerIntegration({
  id: 'openweather',
  name: 'OpenWeather',
  category: 'WEATHER',
  capabilities: ['forecast.read'],
  status: statusFromBoolean(Boolean(config.openWeather.apiKey)),
  extractionReady: true,
});

registerIntegration({
  id: 'twilio',
  name: 'Twilio',
  category: 'COMMUNICATIONS',
  capabilities: ['sms.send', 'voice.call'],
  status: config.sms.twilioAccountSid && config.sms.twilioAuthToken ? 'CONFIGURED' : 'PARTIAL',
  extractionReady: true,
});

registerIntegration({
  id: 'stripe',
  name: 'Stripe',
  category: 'PAYMENTS',
  capabilities: ['payment.intent', 'payment.refund'],
  status: statusFromBoolean(Boolean(config.stripe.secretKey)),
  extractionReady: true,
});

registerIntegration({
  id: 'booking-com',
  name: 'Booking.com',
  category: 'OTA',
  capabilities: ['booking.sync'],
  status: 'FUTURE',
  extractionReady: true,
  notes: 'Future OTA connector should publish reservation and rate events through the Event Bus.',
});

registerIntegration({
  id: 'expedia',
  name: 'Expedia',
  category: 'OTA',
  capabilities: ['booking.sync'],
  status: 'FUTURE',
  extractionReady: true,
  notes: 'Future OTA connector should publish reservation and rate events through the Event Bus.',
});

registerIntegration({
  id: 'smart-locks',
  name: 'Smart Locks',
  category: 'SMART_LOCKS',
  capabilities: ['lock.event_ingest'],
  status: 'FUTURE',
  extractionReady: true,
  notes: 'Vendor adapters should normalize lock events into Smart Building ingestion payloads.',
});

registerIntegration({
  id: 'onvif-cctv',
  name: 'ONVIF / CCTV',
  category: 'CCTV',
  capabilities: ['camera.status_ingest'],
  status: 'FUTURE',
  extractionReady: true,
  notes: 'NVR/ONVIF adapters should normalize camera status and alerts through the Event Bus.',
});

registerIntegration({
  id: 'mqtt',
  name: 'MQTT Bridge',
  category: 'IOT',
  capabilities: ['mqtt.event_ingest'],
  status: 'FUTURE',
  extractionReady: true,
  notes: 'MQTT bridge should live as an adapter process later, but share event schemas with this monorepo.',
});

registerIntegration({
  id: 'openai',
  name: 'OpenAI',
  category: 'AI',
  capabilities: ['ai.chat', 'ai.tool_call'],
  status:
    process.env.ASSISTANT_PROVIDER?.toLowerCase() === 'none' || !process.env.OPENAI_API_KEY
      ? 'NOT_CONFIGURED'
      : 'CONFIGURED',
  extractionReady: true,
});
