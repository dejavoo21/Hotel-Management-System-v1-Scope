import api from './api';

export type SmartBuildingTone = 'emerald' | 'sky' | 'amber' | 'rose' | 'slate';

export type IoTDevice = {
  id: string;
  externalId: string;
  name: string;
  deviceType: string;
  status: string;
  location?: string | null;
  floor?: number | null;
  zone?: string | null;
  vendor?: string | null;
  lastSeenAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CameraFeed = {
  id: string;
  externalId: string;
  name: string;
  location?: string | null;
  status: string;
  streamUrl?: string | null;
  snapshotUrl?: string | null;
  lastSeenAt?: string | null;
};

export type DoorAccessEvent = {
  id: string;
  externalId?: string | null;
  doorExternalId?: string | null;
  doorName?: string | null;
  actorName?: string | null;
  actorType: string;
  credentialId?: string | null;
  result: string;
  occurredAt: string;
};

export type DoorStatus = {
  id: string;
  externalId: string;
  name: string;
  location?: string | null;
  floor?: number | null;
  lockState: string;
  openState: string;
  batteryLevel?: number | null;
  lastEventAt?: string | null;
};

export type SensorReading = {
  id: string;
  externalId?: string | null;
  sensorType: string;
  location?: string | null;
  value: string | number;
  unit: string;
  status: string;
  recordedAt: string;
};

export type SecurityAlert = {
  id: string;
  externalId?: string | null;
  alertType: string;
  severity: string;
  status: string;
  title: string;
  message?: string | null;
  location?: string | null;
  occurredAt: string;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
};

export type SmartBuildingOverview = {
  cameras: { online: number; offline: number };
  doors: { locked: number; open: number };
  accessEvents: { today: number };
  motionAlerts: { active: number };
  temperatureSensors: { normal: number; warning: number };
  waterLeakSensors: { alerts: number };
  panicButtons: { active: number };
  health: {
    activeAlerts: number;
    onlineDevices: number;
    totalDevices: number;
  };
};

export type SmartBuildingEventPayload = Record<string, unknown>;

export const smartBuildingService = {
  async getOverview(): Promise<SmartBuildingOverview> {
    const response = await api.get('/smart-building/overview');
    return response.data.data;
  },

  async listDevices(): Promise<IoTDevice[]> {
    const response = await api.get('/smart-building/devices');
    return response.data.data;
  },

  async listCameraFeeds(): Promise<CameraFeed[]> {
    const response = await api.get('/smart-building/cameras');
    return response.data.data;
  },

  async listDoorAccessEvents(): Promise<DoorAccessEvent[]> {
    const response = await api.get('/smart-building/access-events');
    return response.data.data;
  },

  async listDoorStatuses(): Promise<DoorStatus[]> {
    const response = await api.get('/smart-building/door-statuses');
    return response.data.data;
  },

  async listSensorReadings(): Promise<SensorReading[]> {
    const response = await api.get('/smart-building/sensor-readings');
    return response.data.data;
  },

  async listSecurityAlerts(): Promise<SecurityAlert[]> {
    const response = await api.get('/smart-building/alerts');
    return response.data.data;
  },

  async acknowledgeAlert(alertId: string): Promise<SecurityAlert> {
    const response = await api.patch(`/smart-building/alerts/${encodeURIComponent(alertId)}/acknowledge`);
    return response.data.data;
  },

  async resolveAlert(alertId: string): Promise<SecurityAlert> {
    const response = await api.patch(`/smart-building/alerts/${encodeURIComponent(alertId)}/resolve`);
    return response.data.data;
  },

  async ingestEvent(payload: SmartBuildingEventPayload): Promise<unknown> {
    const response = await api.post('/smart-building/events', payload);
    return response.data.data;
  },
};

export default smartBuildingService;
