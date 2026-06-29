import api from './api';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'NEW' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type IncidentCategory = 'SECURITY' | 'MAINTENANCE' | 'SMART_BUILDING' | 'OPERATIONS' | 'WEATHER' | 'HOUSEKEEPING' | 'IT' | 'GUEST';

export type IncidentTaskLink = {
  id: string;
  ticketId: string;
  ticket: {
    id: string;
    department: string;
    priority: string;
    status: string;
    createdAtUtc: string;
    conversation?: {
      subject?: string | null;
      messages?: { body: string; createdAt: string }[];
    };
  };
};

export type Incident = {
  id: string;
  incidentNumber: string;
  title: string;
  description?: string | null;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  sourceModule: string;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  createdById?: string | null;
  assignedManagerId?: string | null;
  startedAt: string;
  resolvedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  tasks?: IncidentTaskLink[];
  comments?: Array<{ id: string; body: string; createdAt: string; author?: { firstName: string; lastName: string } | null }>;
};

export type IncidentOverview = {
  active: number;
  critical: number;
  resolved: number;
  closed: number;
  total: number;
  averageResolutionMinutes: number;
  byDepartment: Array<{ department: string; count: number }>;
  bySourceModule: Array<{ sourceModule: string; count: number }>;
};

export type IncidentView = 'active' | 'critical' | 'assigned_to_me' | 'resolved' | 'closed';

export const incidentService = {
  async overview(): Promise<IncidentOverview> {
    const response = await api.get('/incidents/overview');
    return response.data.data;
  },

  async list(view: IncidentView): Promise<Incident[]> {
    const response = await api.get('/incidents', { params: { view } });
    return response.data.data;
  },

  async acknowledge(id: string): Promise<Incident> {
    const response = await api.post(`/incidents/${encodeURIComponent(id)}/acknowledge`);
    return response.data.data;
  },

  async resolve(id: string): Promise<Incident> {
    const response = await api.post(`/incidents/${encodeURIComponent(id)}/resolve`);
    return response.data.data;
  },

  async close(id: string): Promise<Incident> {
    const response = await api.post(`/incidents/${encodeURIComponent(id)}/close`);
    return response.data.data;
  },

  async comment(id: string, body: string): Promise<unknown> {
    const response = await api.post(`/incidents/${encodeURIComponent(id)}/comment`, { body });
    return response.data.data;
  },
};

export default incidentService;
