import { bookingService, weatherSignalsService } from '@/services';
import { getWeatherOpsActions, type WeatherOpsAction } from '@/services/aiHooks';

export type OperationsContext = {
  hotelId: string;
  generatedAtUtc: string;
  weather?: {
    syncedAtUtc: string;
    daysAvailable: number;
    coordinates?: { lat: number; lon: number };
    next24h?: { summary?: string; highC?: number; lowC?: number; rainRisk?: 'low' | 'medium' | 'high' };
    isFresh: boolean;
    staleHours?: number;
  } | null;
  ops?: {
    arrivalsNext24h?: number;
    departuresNext24h?: number;
    inhouseNow?: number;
  };
  pricing?: {
    demandTrend?: 'down' | 'flat' | 'up';
    opportunityPct?: number;
    confidence?: 'low' | 'medium' | 'high';
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

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toRainRisk(value?: number | null): 'low' | 'medium' | 'high' | undefined {
  if (value == null) return undefined;
  if (value >= 70) return 'high';
  if (value >= 35) return 'medium';
  return 'low';
}

function toDepartmentLabel(category?: WeatherOpsAction['category']): string | undefined {
  if (!category) return 'Front Desk';
  return category;
}

export const operationsService = {
  async getOperationsContext(hotelId: string): Promise<OperationsContext> {
    const now = new Date();
    const next24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const todayIso = toIsoDate(now);
    const nextIso = toIsoDate(next24);

    const [status, latest, advisoriesResult, bookingsResult] = await Promise.all([
      weatherSignalsService.getStatus(hotelId),
      weatherSignalsService.getLatest(hotelId),
      getWeatherOpsActions(hotelId),
      bookingService.getBookings({
        startDate: todayIso,
        endDate: nextIso,
        limit: 500,
      }),
    ]);

    const bookings = bookingsResult?.data ?? [];
    const activeStatuses = new Set(['CONFIRMED', 'CHECKED_IN']);

    const arrivalsNext24h = bookings.filter((b) => {
      const dt = new Date(b.checkInDate);
      return activeStatuses.has(b.status) && dt >= now && dt <= next24;
    }).length;

    const departuresNext24h = bookings.filter((b) => {
      const dt = new Date(b.checkOutDate);
      return activeStatuses.has(b.status) && dt >= now && dt <= next24;
    }).length;

    const inhouseNow = bookings.filter((b) => {
      const inAt = new Date(b.checkInDate);
      const outAt = new Date(b.checkOutDate);
      return activeStatuses.has(b.status) && inAt <= now && outAt > now;
    }).length;

    const latestSignal = latest[0];
    const metrics = (latestSignal?.metrics || {}) as Record<string, unknown>;
    const highC = typeof metrics.tempMax === 'number' ? metrics.tempMax : undefined;
    const lowC = typeof metrics.tempMin === 'number' ? metrics.tempMin : undefined;
    const rainProb = typeof metrics.precipitationProbMax === 'number' ? metrics.precipitationProbMax : undefined;
    const weatherSummary =
      typeof metrics.weatherDesc === 'string'
        ? metrics.weatherDesc
        : typeof metrics.weatherMain === 'string'
          ? metrics.weatherMain
          : undefined;

    const staleHours =
      status.lastSyncTime != null
        ? Math.max(0, (Date.now() - new Date(status.lastSyncTime).getTime()) / (1000 * 60 * 60))
        : undefined;
    const isFresh = status.lastSyncTime != null && (staleHours ?? 999) < 6;

    const demandTrend: 'down' | 'flat' | 'up' =
      arrivalsNext24h > departuresNext24h ? 'up' : arrivalsNext24h < departuresNext24h ? 'down' : 'flat';
    const opportunityPct = demandTrend === 'up' ? 6 : demandTrend === 'down' ? -4 : 0;
    const confidence: 'low' | 'medium' | 'high' = isFresh ? 'medium' : 'low';

    return {
      hotelId,
      generatedAtUtc: new Date().toISOString(),
      weather: status.lastSyncTime
        ? {
            syncedAtUtc: status.lastSyncTime,
            daysAvailable: status.daysAvailable,
            coordinates:
              status.lat != null && status.lon != null ? { lat: status.lat, lon: status.lon } : undefined,
            next24h: {
              summary: weatherSummary,
              highC,
              lowC,
              rainRisk: toRainRisk(rainProb),
            },
            isFresh,
            staleHours,
          }
        : null,
      ops: {
        arrivalsNext24h,
        departuresNext24h,
        inhouseNow,
      },
      pricing: {
        demandTrend,
        opportunityPct,
        confidence,
        suggestion:
          demandTrend === 'up'
            ? `Consider a ${opportunityPct}% rate lift for high-demand windows.`
            : demandTrend === 'down'
              ? `Consider promotional pricing (${opportunityPct}%) to stabilize occupancy.`
              : 'Keep current rates and monitor booking pace.',
      },
      advisories: (advisoriesResult.actions || []).slice(0, 5).map((item, index) => ({
        id: `${item.title}-${index}`,
        title: item.title,
        reason: item.reason,
        priority: item.priority,
        department: toDepartmentLabel(item.category),
        source: 'WEATHER_ACTIONS',
      })),
    };
  },
};

export default operationsService;
