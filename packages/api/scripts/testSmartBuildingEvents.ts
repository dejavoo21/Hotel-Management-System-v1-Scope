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

const sampleEvents: SmartBuildingEvent[] = [
  {
    type: 'DOOR_STATUS',
    occurredAt: new Date().toISOString(),
    door: {
      externalId: 'demo-smart-building-door-room-101',
      deviceExternalId: 'demo-smart-building-room-101-smart-lock',
      name: 'Room 101 Smart Lock',
      location: 'Room 101',
      floor: 1,
      lockState: 'UNLOCKED',
      openState: 'CLOSED',
      batteryLevel: 93,
    },
    metadata: { source: 'testSmartBuildingEvents', scenario: 'Room 101 door unlocked' },
  },
  {
    type: 'DOOR_STATUS',
    occurredAt: new Date().toISOString(),
    door: {
      externalId: 'demo-smart-building-door-emergency-exit',
      name: 'Emergency Exit Door',
      location: 'Emergency Exit',
      floor: 0,
      lockState: 'UNLOCKED',
      openState: 'FORCED_OPEN',
      batteryLevel: 77,
    },
    metadata: { source: 'testSmartBuildingEvents', scenario: 'Emergency exit forced open' },
  },
  {
    type: 'SENSOR_READING',
    occurredAt: new Date().toISOString(),
    sensor: {
      externalId: `demo-smart-building-reading-basement-leak-${Date.now()}`,
      deviceExternalId: 'demo-smart-building-basement-water-leak-sensor',
      sensorType: 'WATER_LEAK',
      location: 'Basement',
      value: 1,
      unit: 'state',
      status: 'ALERT',
    },
    metadata: { source: 'testSmartBuildingEvents', scenario: 'Basement water leak critical' },
  },
  {
    type: 'CAMERA_STATUS',
    occurredAt: new Date().toISOString(),
    camera: {
      externalId: 'demo-smart-building-feed-corridor-camera',
      deviceExternalId: 'demo-smart-building-corridor-camera',
      name: 'Corridor Camera',
      location: 'Guest Corridor',
      status: 'OFFLINE',
      streamUrl: 'rtsp://demo.local/corridor-camera',
    },
    metadata: { source: 'testSmartBuildingEvents', scenario: 'Corridor camera offline' },
  },
  {
    type: 'SECURITY_ALERT',
    occurredAt: new Date().toISOString(),
    alert: {
      externalId: `demo-smart-building-live-motion-pool-${Date.now()}`,
      deviceExternalId: 'demo-smart-building-motion-sensor-pool-area',
      alertType: 'MOTION',
      severity: 'MEDIUM',
      title: 'Motion detected at pool area',
      message: 'Motion Sensor Pool Area detected movement from the live event test script.',
      location: 'Pool Area',
    },
    metadata: { source: 'testSmartBuildingEvents', scenario: 'Motion detected at pool area' },
  },
];

async function getAccessToken() {
  if (TOKEN) return TOKEN;
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      'Set SMART_BUILDING_AUTH_TOKEN, or set SMART_BUILDING_EMAIL and SMART_BUILDING_PASSWORD for login.'
    );
  }

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  const payload = await response.json() as {
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
    throw new Error(`${event.type} failed with ${response.status}: ${body}`);
  }

  console.log(`${event.type}: ${response.status} ${body}`);
}

async function main() {
  const accessToken = await getAccessToken();
  console.log(`Posting ${sampleEvents.length} Smart Building events to ${API_BASE_URL}/smart-building/events`);

  for (const event of sampleEvents) {
    await postEvent(accessToken, event);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
