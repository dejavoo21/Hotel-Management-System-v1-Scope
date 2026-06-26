import api from './api';
import type { CameraFeed, DoorAccessEvent, SecurityAlert } from './smartBuilding';

export type VisitorStatus = 'CHECKED_IN' | 'CHECKED_OUT' | 'DENIED';

export type Visitor = {
  id: string;
  fullName: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  purpose?: string | null;
  hostName?: string | null;
  checkInAt: string;
  checkOutAt?: string | null;
  status: VisitorStatus;
  notes?: string | null;
};

export type SecurityActivity = {
  id: string;
  type: 'ALERT' | 'ACCESS' | 'VISITOR';
  title: string;
  detail?: string | null;
  status: string;
  occurredAt: string;
};

export type SecurityCenterOverview = {
  cctv: { total: number; online: number; offline: number };
  accessEvents: { today: number };
  visitors: { onsite: number };
  alerts: { open: number };
  recentActivity: SecurityActivity[];
};

export type CreateVisitorPayload = {
  fullName: string;
  company?: string;
  phone?: string;
  email?: string;
  purpose?: string;
  hostName?: string;
  status?: VisitorStatus;
  notes?: string;
};

export const securityCenterService = {
  async getOverview(): Promise<SecurityCenterOverview> {
    const response = await api.get('/security-center/overview');
    return response.data.data;
  },

  async listCctv(): Promise<CameraFeed[]> {
    const response = await api.get('/security-center/cctv');
    return response.data.data;
  },

  async listAccessLogs(): Promise<DoorAccessEvent[]> {
    const response = await api.get('/security-center/access-logs');
    return response.data.data;
  },

  async listVisitors(): Promise<Visitor[]> {
    const response = await api.get('/security-center/visitors');
    return response.data.data;
  },

  async createVisitor(payload: CreateVisitorPayload): Promise<Visitor> {
    const response = await api.post('/security-center/visitors', payload);
    return response.data.data;
  },

  async checkoutVisitor(visitorId: string): Promise<Visitor> {
    const response = await api.patch(`/security-center/visitors/${encodeURIComponent(visitorId)}/checkout`);
    return response.data.data;
  },

  async listAlerts(): Promise<SecurityAlert[]> {
    const response = await api.get('/security-center/alerts');
    return response.data.data;
  },

  async acknowledgeAlert(alertId: string): Promise<SecurityAlert> {
    const response = await api.patch(`/security-center/alerts/${encodeURIComponent(alertId)}/acknowledge`);
    return response.data.data;
  },

  async resolveAlert(alertId: string): Promise<SecurityAlert> {
    const response = await api.patch(`/security-center/alerts/${encodeURIComponent(alertId)}/resolve`);
    return response.data.data;
  },
};

export default securityCenterService;
