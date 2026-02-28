import api from './api';

export type OperationsContext = {
  hotelId: string;
  generatedAtUtc: string;
  weather?: {
    syncedAtUtc: string | null;
    timezone?: string | null;
    location?: { lat: number | null; lon: number | null };
    daysAvailable: number;
    next24h?: { summary?: string | null; highC?: number | null; lowC?: number | null; rainRisk?: 'low' | 'medium' | 'high' | 'unknown' | null };
    isFresh: boolean;
    stale?: boolean;
    staleHours?: number | null;
  } | null;
  ops?: {
    arrivalsNext24h?: number;
    departuresNext24h?: number;
    inhouseNow?: number;
    windowStartUtc?: string;
    windowEndUtc?: string;
  };
  pricingSignal?: {
    demandTrend?: 'down' | 'flat' | 'up';
    opportunityPct?: number;
    confidence?: 'low' | 'medium' | 'high';
    note?: string;
    suggestion?: string;
  };
  // Backward-compatible fallback for older API payloads
  pricing?: {
    demandTrend?: 'down' | 'flat' | 'up';
    opportunityPct?: number;
    confidence?: 'low' | 'medium' | 'high';
    note?: string;
    suggestion?: string;
  };
  advisories?: Array<{
    id: string;
    title: string;
    reason: string;
    priority: 'low' | 'medium' | 'high';
    department?: 'FRONT_DESK' | 'HOUSEKEEPING' | 'MAINTENANCE' | 'CONCIERGE' | 'BILLING' | 'MANAGEMENT';
    source: 'WEATHER_ACTIONS' | 'PRICING' | 'ARRIVALS';
    createdTicket?: {
      ticketId: string;
      conversationId: string;
      createdAtUtc: string;
    } | null;
  }>;
};

export type CreateAdvisoryTicketInput = {
  advisoryId?: string;
  title: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  department: 'FRONT_DESK' | 'HOUSEKEEPING' | 'CONCIERGE' | 'MAINTENANCE' | 'BILLING' | 'MANAGEMENT';
  source?: 'WEATHER_ACTIONS' | 'PRICING' | 'ARRIVALS';
  meta?: {
    weatherSyncedAtUtc?: string | null;
    generatedAtUtc?: string | null;
  };
};

export type CreateAdvisoryTicketResult = {
  ticketId: string;
  status: 'OPEN' | 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'BREACHED';
  department: string;
  conversationId: string;
  assignedToId?: string | null;
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  deduped?: boolean;
};

export type CreateWeatherActionTicketInput = {
  title: string;
  reason?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | string;
  department?: string;
  weatherSyncedAtUtc?: string | null;
  aiGeneratedAtUtc?: string | null;
};

export type CreateWeatherActionTicketResult = {
  ticketId: string;
  status: 'OPEN' | 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'BREACHED';
  department: string;
  conversationId: string;
  source: 'WEATHER_ACTIONS';
  actionId: string | null;
  title: string;
  reason: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAtUtc: string;
};

export const operationsService = {
  async getOperationsContext(_hotelId: string): Promise<OperationsContext> {
    const response = await api.get('/operations/context', {
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      params: { _ts: Date.now() },
    });
    return response.data.data as OperationsContext;
  },
  async createAdvisoryTicket(payload: CreateAdvisoryTicketInput): Promise<CreateAdvisoryTicketResult> {
    const response = await api.post('/operations/advisories/create-ticket', payload);
    return response.data.data as CreateAdvisoryTicketResult;
  },
  async createTicketFromWeatherAction(actionId: string, payload: CreateWeatherActionTicketInput): Promise<CreateWeatherActionTicketResult> {
    const response = await api.post(`/ai/weather-actions/${encodeURIComponent(actionId)}/create-ticket`, payload);
    return response.data.data as CreateWeatherActionTicketResult;
  },
};

export default operationsService;
