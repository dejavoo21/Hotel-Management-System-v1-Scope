type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
};

type SmartBuildingEvent = {
  type: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

type Incident = {
  id: string;
  incidentNumber: string;
  title: string;
  severity: string;
  status: string;
  sourceModule: string;
};

type GeneratedTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  incidentNumber?: string | null;
  incidentStatus?: string | null;
};

const API_BASE_URL = (
  process.env.INCIDENT_API_URL ||
  process.env.SMART_BUILDING_API_URL ||
  process.env.VITE_API_URL ||
  'http://localhost:3001/api'
).replace(/\/+$/, '');
const TOKEN = process.env.INCIDENT_AUTH_TOKEN || process.env.SMART_BUILDING_AUTH_TOKEN || process.env.LAFLO_ACCESS_TOKEN || '';
const EMAIL = process.env.INCIDENT_EMAIL || process.env.SMART_BUILDING_EMAIL || '';
const PASSWORD = process.env.INCIDENT_PASSWORD || process.env.SMART_BUILDING_PASSWORD || '';

const now = () => new Date().toISOString();
const unique = Date.now();

const workflowEvents: SmartBuildingEvent[] = [
  {
    type: 'SENSOR_READING',
    occurredAt: now(),
    sensor: {
      externalId: `incident-basement-water-leak-${unique}`,
      deviceExternalId: 'demo-smart-building-basement-water-leak-sensor',
      sensorType: 'WATER_LEAK',
      location: 'Basement',
      value: 1,
      unit: 'state',
      status: 'ALERT',
    },
    metadata: { source: 'testIncidentWorkflow', scenario: 'basement water leak critical' },
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
    metadata: { source: 'testIncidentWorkflow', scenario: 'emergency exit forced open' },
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
    metadata: { source: 'testIncidentWorkflow', scenario: 'corridor camera offline' },
  },
  {
    type: 'SENSOR_READING',
    occurredAt: now(),
    sensor: {
      externalId: `incident-reception-panic-button-${unique}`,
      deviceExternalId: 'demo-smart-building-panic-button-reception',
      sensorType: 'PANIC_BUTTON',
      location: 'Reception',
      value: 1,
      unit: 'state',
      status: 'ALERT',
    },
    metadata: { source: 'testIncidentWorkflow', scenario: 'reception panic button' },
  },
];

async function parseResponse<T>(response: Response): Promise<ApiEnvelope<T>> {
  const text = await response.text();
  if (!text) return {};
  return JSON.parse(text) as ApiEnvelope<T>;
}

async function getAccessToken() {
  if (TOKEN) return TOKEN;
  if (!EMAIL || !PASSWORD) {
    throw new Error('Set INCIDENT_AUTH_TOKEN, or set INCIDENT_EMAIL and INCIDENT_PASSWORD for login.');
  }

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  const payload = await parseResponse<{ accessToken?: string; requiresTwoFactor?: boolean }>(response);
  if (!response.ok || !payload.data?.accessToken) {
    if (payload.data?.requiresTwoFactor) {
      throw new Error('Login requires 2FA. Use INCIDENT_AUTH_TOKEN instead.');
    }
    throw new Error(payload.error || payload.message || `Login failed with ${response.status}`);
  }

  return payload.data.accessToken;
}

async function request<T>(accessToken: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const payload = await parseResponse<T>(response);
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${payload.error || payload.message || 'Unknown error'}`);
  }
  return payload.data as T;
}

async function postEvent(accessToken: string, event: SmartBuildingEvent) {
  const data = await request<unknown>(accessToken, '/smart-building/events', {
    method: 'POST',
    body: JSON.stringify(event),
  });
  console.log(`Posted ${event.metadata?.scenario || event.type}`);
  return data;
}

async function main() {
  const accessToken = await getAccessToken();
  console.log(`Posting ${workflowEvents.length} incident workflow events to ${API_BASE_URL}/smart-building/events`);

  for (const event of workflowEvents) {
    await postEvent(accessToken, event);
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const incidents = await request<Incident[]>(accessToken, '/incidents?view=active');
  const linkedTasks = await request<GeneratedTask[]>(accessToken, '/smart-building/linked-tasks');

  const smartBuildingIncidents = incidents.filter((incident) => incident.sourceModule === 'SMART_BUILDING').slice(0, 10);
  const incidentLinkedTasks = linkedTasks.filter((task) => task.incidentNumber).slice(0, 10);

  console.log(`Active Smart Building incidents: ${smartBuildingIncidents.length}`);
  smartBuildingIncidents.forEach((incident) => {
    console.log(`- ${incident.incidentNumber} ${incident.severity} ${incident.status}: ${incident.title}`);
  });

  console.log(`Generated tasks linked to incidents: ${incidentLinkedTasks.length}`);
  incidentLinkedTasks.forEach((task) => {
    console.log(`- ${task.incidentNumber} ${task.priority} ${task.status}: ${task.title}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
