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
    department?: string;
    source: 'WEATHER_ACTIONS' | 'PRICING' | 'ARRIVALS';
  }>;
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
};

export default operationsService;
