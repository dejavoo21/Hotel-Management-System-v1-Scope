type SmartBuildingEvent = {
  type: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

const API_BASE_URL = (process.env.SMART_BUILDING_API_URL || process.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/+$/, '');
const TOKEN = process.env.SMART_BUILDING_AUTH_TOKEN || process.env.LAFLO_ACCESS_TOKEN || '';
const EMAIL = process.env.SMART_BUILDING_EMAIL || '';
const PASSWORD = process.env.SMART_BUILDING_PASSWORD || '';

const now = () => new Date().toISOString();

const workflowEvents: SmartBuildingEvent[] = [
  {
    type: 'SENSOR_READING',
    occurredAt: now(),
    sensor: {
      externalId: `workflow-basement-water-leak-${Date.now()}`,
      deviceExternalId: 'demo-smart-building-basement-water-leak-sensor',
      sensorType: 'WATER_LEAK',
      location: 'Basement',
      value: 1,
      unit: 'state',
      status: 'ALERT',
    },
    metadata: { source: 'testSmartBuildingWorkflow', scenario: 'basement water leak critical' },
  },
  {
    type: 'DOOR_STATUS',
    occurredAt: now(),
    door: {
      externalId: 'demo-smart-building-door-emergency-exit',
      deviceExternalId: 'demo-smart-building-emergency-exit-door',
      name: 'Emergency Exit Door',
      location: 'Emergency Exit',
      floor: 0,
      lockState: 'UNLOCKED',
      openState: 'FORCED_OPEN',
      batteryLevel: 77,
    },
    metadata: { source: 'testSmartBuildingWorkflow', scenario: 'emergency exit forced open' },
  },
  {
    type: 'CAMERA_STATUS',
    occurredAt: now(),
    camera: {
      externalId: 'demo-smart-building-feed-corridor-camera',
      deviceExternalId: 'demo-smart-building-corridor-camera',
      name: 'Corridor Camera',
      location: 'Guest Corridor',
      status: 'OFFLINE',
      streamUrl: 'rtsp://demo.local/corridor-camera',
    },
    metadata: { source: 'testSmartBuildingWorkflow', scenario: 'corridor camera offline' },
  },
  {
    type: 'SENSOR_READING',
    occurredAt: now(),
    sensor: {
      externalId: `workflow-reception-panic-button-${Date.now()}`,
      deviceExternalId: 'demo-smart-building-panic-button-reception',
      sensorType: 'PANIC_BUTTON',
      location: 'Reception',
      value: 1,
      unit: 'state',
      status: 'ALERT',
    },
    metadata: { source: 'testSmartBuildingWorkflow', scenario: 'reception panic button' },
  },
  {
    type: 'DEVICE_STATUS',
    occurredAt: now(),
    device: {
      externalId: 'demo-smart-building-lobby-hvac-controller',
      name: 'Lobby HVAC Controller',
      deviceType: 'HVAC',
      status: 'WARNING',
      location: 'Lobby',
      floor: 0,
      zone: 'Lobby',
      vendor: 'Demo HVAC',
    },
    metadata: { source: 'testSmartBuildingWorkflow', scenario: 'HVAC warning' },
  },
  {
    type: 'DEVICE_STATUS',
    occurredAt: now(),
    device: {
      externalId: 'demo-smart-building-lobby-temperature-sensor',
      name: 'Lobby Temperature Sensor',
      deviceType: 'TEMPERATURE_SENSOR',
      status: 'OFFLINE',
      location: 'Lobby',
      floor: 0,
      zone: 'Lobby',
      vendor: 'Demo Sensors',
    },
    metadata: { source: 'testSmartBuildingWorkflow', scenario: 'sensor offline' },
  },
];

async function getAccessToken() {
  if (TOKEN) return TOKEN;
  if (!EMAIL || !PASSWORD) {
    throw new Error('Set SMART_BUILDING_AUTH_TOKEN, or set SMART_BUILDING_EMAIL and SMART_BUILDING_PASSWORD for login.');
  }

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  const payload = (await response.json()) as {
    success?: boolean;
    data?: { accessToken?: string; requiresTwoFactor?: boolean };
    error?: string;
    message?: string;
  };

  if (!response.ok || !payload.data?.accessToken) {
    if (payload.data?.requiresTwoFactor) {
      throw new Error('Login requires 2FA. Use SMART_BUILDING_AUTH_TOKEN instead.');
    }
    throw new Error(payload.error || payload.message || `Login failed with ${response.status}`);
  }

  return payload.data.accessToken;
}

async function postEvent(accessToken: string, event: SmartBuildingEvent) {
  const response = await fetch(`${API_BASE_URL}/smart-building/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${event.metadata?.scenario || event.type} failed with ${response.status}: ${body}`);
  }

  console.log(`${event.metadata?.scenario || event.type}: ${response.status} ${body}`);
}

async function main() {
  const accessToken = await getAccessToken();
  console.log(`Posting ${workflowEvents.length} Smart Building workflow events to ${API_BASE_URL}/smart-building/events`);

  for (const event of workflowEvents) {
    await postEvent(accessToken, event);
  }

  console.log('Workflow events posted. Check tickets, notifications, and audit logs for Smart Building workflow output.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
