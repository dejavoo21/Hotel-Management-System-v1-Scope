import { prisma } from '../config/database.js';
import type { WeatherContext } from './weatherContext.provider.js';
import { getWeatherContextForHotel } from './weatherContext.provider.js';
import { generatePricingForecastSnapshot } from './pricingForecast.service.js';
import { routeOpsAdvisory } from './opsRouting.rules.js';

export type WeatherActionPriority = 'low' | 'medium' | 'high';
export type WeatherActionCategory =
  | 'Front Desk'
  | 'Concierge'
  | 'Housekeeping'
  | 'F&B'
  | 'Maintenance';


export interface WeatherOpsAction {
  title: string;
  reason: string;
  priority: WeatherActionPriority;
  category?: WeatherActionCategory;
}

export interface WeatherOpsActionsResult {
  actions: WeatherOpsAction[];
  generatedAtUtc: string;
}

export interface OpsContext {
  arrivalsNext24h: number;
  departuresNext24h: number;
  inhouseNow: number;
  windowStartUtc: string;
  windowEndUtc: string;
}

const PRICING_SNAPSHOT_STALE_MINUTES = 90;

function isSnapshotStale(generatedAtUtc: Date, maxAgeMinutes: number): boolean {
  const ageMs = Date.now() - generatedAtUtc.getTime();
  return ageMs > maxAgeMinutes * 60 * 1000;
}

async function getLatestPricingSnapshotForHotel(hotelId: string) {
  return prisma.pricingSnapshot.findFirst({
    where: { hotelId, version: 'v1' },
    orderBy: { generatedAtUtc: 'desc' },
    select: {
      id: true,
      generatedAtUtc: true,
      windowStartUtc: true,
      windowEndUtc: true,
      calendar: true,
      summary: true,
      source: true,
      version: true,
    },
  });
}

async function resolvePricingForecast(hotelId: string) {
  const latest = await getLatestPricingSnapshotForHotel(hotelId);

  if (latest && !isSnapshotStale(latest.generatedAtUtc, PRICING_SNAPSHOT_STALE_MINUTES)) {
    return {
      mode: 'SNAPSHOT' as const,
      generatedAtUtc: latest.generatedAtUtc.toISOString(),
      windowStartUtc: latest.windowStartUtc.toISOString(),
      windowEndUtc: latest.windowEndUtc.toISOString(),
      source: latest.source,
      version: latest.version,
      summary: latest.summary,
      calendar: latest.calendar,
    };
  }

  const computed = await generatePricingForecastSnapshot(hotelId, 30);

  await prisma.pricingSnapshot.create({
    data: {
      hotelId,
      windowStartUtc: new Date(computed.windowStartUtc),
      windowEndUtc: new Date(computed.windowEndUtc),
      generatedAtUtc: new Date(computed.generatedAtUtc),
      calendar: computed.calendar,
      summary: computed.summary,
      source: computed.source,
      version: computed.version,
    },
  });

  return {
    mode: 'LIVE_FALLBACK' as const,
    generatedAtUtc: computed.generatedAtUtc,
    windowStartUtc: computed.windowStartUtc,
    windowEndUtc: computed.windowEndUtc,
    source: computed.source,
    version: computed.version,
    summary: computed.summary,
    calendar: computed.calendar,
  };
}

function clampText(value: string, maxLen: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function advisoryIdForAction(item: WeatherOpsAction): string {
  return `${item.title}-${item.priority}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

function pushWeatherAction(
  list: WeatherOpsAction[],
  title: string,
  reason: string,
  priority: WeatherActionPriority,
  category?: WeatherActionCategory
) {
  const exists = list.some((item) => item.title.toLowerCase() === title.toLowerCase());
  if (exists) return;
  list.push({
    title: clampText(title, 60),
    reason: clampText(reason, 120),
    priority,
    category,
  });
}

export async function getOpsContextForHotel(hotelId: string): Promise<OpsContext> {
  const now = new Date();
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [arrivalsNext24h, departuresNext24h, inhouseNow] = await Promise.all([
    prisma.booking.count({
      where: {
        hotelId,
        status: 'CONFIRMED',
        checkInDate: { gte: now, lt: next24h },
      },
    }),
    prisma.booking.count({
      where: {
        hotelId,
        status: 'CHECKED_IN',
        checkOutDate: { gte: now, lt: next24h },
      },
    }),
    prisma.booking.count({
      where: {
        hotelId,
        status: 'CHECKED_IN',
        actualCheckIn: { not: null },
        actualCheckOut: null,
      },
    }),
  ]);

  return {
    arrivalsNext24h,
    departuresNext24h,
    inhouseNow,
    windowStartUtc: now.toISOString(),
    windowEndUtc: next24h.toISOString(),
  };
}

export async function getWeatherOpsActions(
  weather: WeatherContext | null,
  ops?: OpsContext
): Promise<WeatherOpsActionsResult> {
  const generatedAtUtc = new Date().toISOString();
  if (!weather || !weather.syncedAtUtc || !weather.next24h) {
    return { actions: [], generatedAtUtc };
  }

  const actions: WeatherOpsAction[] = [];

  if (weather.stale || !weather.isFresh) {
    pushWeatherAction(
      actions,
      'Refresh weather forecast now',
      'Current weather context is stale and may reduce recommendation accuracy.',
      'high',
      'Front Desk'
    );
  }

  const summary = (weather.next24h.summary || '').toLowerCase();
  const rainRisk = weather.next24h.rainRisk;
  const high = weather.next24h.highC;
  const low = weather.next24h.lowC;

  if (rainRisk === 'high') {
    pushWeatherAction(
      actions,
      'Stage umbrellas at reception',
      'High rain risk expected; prepare staff and guest-facing supplies.',
      'high',
      'Front Desk'
    );
    pushWeatherAction(
      actions,
      'Prioritize indoor breakfast seating',
      'Wet weather may reduce outdoor seating demand during breakfast hours.',
      'medium',
      'F&B'
    );
  } else if (rainRisk === 'medium') {
    pushWeatherAction(
      actions,
      'Prepare rain contingency signage',
      'Moderate rain risk expected; direct guests toward indoor alternatives.',
      'medium',
      'Front Desk'
    );
  }

  if (summary.includes('storm') || summary.includes('thunder')) {
    pushWeatherAction(
      actions,
      'Issue weather safety advisory at check-in',
      'Storm conditions are possible; align front desk messaging.',
      'high',
      'Front Desk'
    );
  }

  if (summary.includes('wind')) {
    pushWeatherAction(
      actions,
      'Secure outdoor furniture and setup',
      'Windy conditions may impact terrace and poolside safety.',
      'medium',
      'Maintenance'
    );
  }

  if (typeof high === 'number' && high >= 32) {
    pushWeatherAction(
      actions,
      'Increase hydration station checks',
      `Hot conditions expected (up to ${high}C); prioritize water availability.`,
      'medium',
      'F&B'
    );
  }

  if (typeof low === 'number' && low <= 5) {
    pushWeatherAction(
      actions,
      'Prepare cold-weather arrival support',
      `Low temperatures expected (down to ${low}C); brief front desk team.`,
      'medium',
      'Front Desk'
    );
  }

  if (ops) {
    if (ops.arrivalsNext24h >= 20 && (rainRisk === 'high' || rainRisk === 'medium')) {
      pushWeatherAction(
        actions,
        'Add lobby arrival coverage for peak check-in',
        `High arrivals (${ops.arrivalsNext24h}) plus rain risk may slow front desk throughput.`,
        'high',
        'Front Desk'
      );
    }

    if (ops.departuresNext24h >= 15 && typeof low === 'number' && low <= 5) {
      pushWeatherAction(
        actions,
        'Coordinate early transport readiness',
        `High departures (${ops.departuresNext24h}) with cold conditions can impact outbound flow.`,
        'medium',
        'Concierge'
      );
    }

    if (ops.inhouseNow >= 40 && (summary.includes('storm') || summary.includes('wind'))) {
      pushWeatherAction(
        actions,
        'Pre-brief maintenance on weather-related calls',
        `High in-house load (${ops.inhouseNow}) may increase weather-driven service requests.`,
        'medium',
        'Maintenance'
      );
    }
  }

  if (actions.length === 0) {
    pushWeatherAction(
      actions,
      'Proceed with standard operations plan',
      'No weather disruptions detected in the current forecast window.',
      'low',
      'Front Desk'
    );
  }

  return {
    actions: actions.slice(0, 5),
    generatedAtUtc,
  };
}

export async function getOperationsContext(hotelId: string) {
  const now = new Date();
  const defaultOps: OpsContext = {
    arrivalsNext24h: 0,
    departuresNext24h: 0,
    inhouseNow: 0,
    windowStartUtc: now.toISOString(),
    windowEndUtc: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };

  const [weather, ops, pricingForecast] = await Promise.all([
    getWeatherContextForHotel(hotelId).catch(() => null),
    getOpsContextForHotel(hotelId).catch(() => defaultOps),
    resolvePricingForecast(hotelId).catch(() => ({
      mode: 'LIVE_FALLBACK' as const,
      generatedAtUtc: now.toISOString(),
      windowStartUtc: defaultOps.windowStartUtc,
      windowEndUtc: defaultOps.windowEndUtc,
      source: 'fallback',
      version: 'v1',
      summary: {
        demandTrend: 'flat',
        opportunityPct: 0,
        confidence: 'low',
        marketCoveragePct: 0,
        marketSamplesTotal: 0,
        nightsWithMarket: 0,
        nightsTotal: 0,
      },
      calendar: [] as Array<Record<string, unknown>>,
    })),
  ]);

  const advisoriesResult = await getWeatherOpsActions(weather, ops);
  const advisoryBase = advisoriesResult.actions.slice(0, 5).map((item, index) => ({
    id: `${advisoryIdForAction(item)}-${index + 1}`,
    item,
  }));
  const advisoryIdSet = new Set(advisoryBase.map((advisory) => advisory.id));
  const createdFromActions = await prisma.ticket.findMany({
    where: {
      hotelId,
      details: {
        path: ['source'],
        equals: 'WEATHER_ACTIONS',
      },
    },
    select: {
      id: true,
      conversationId: true,
      details: true,
      createdAtUtc: true,
    },
    orderBy: { createdAtUtc: 'desc' },
  }).catch(() => []);
  const actionToTicket = new Map<string, { ticketId: string; conversationId: string; createdAtUtc: string }>();
  for (const ticket of createdFromActions) {
    const details = (ticket.details ?? null) as Record<string, unknown> | null;
    const actionId = typeof details?.actionId === 'string' ? details.actionId : null;
    if (!actionId || !advisoryIdSet.has(actionId) || actionToTicket.has(actionId)) continue;
    actionToTicket.set(actionId, {
      ticketId: ticket.id,
      conversationId: ticket.conversationId,
      createdAtUtc: ticket.createdAtUtc.toISOString(),
    });
  }

  const pricingSummary = (pricingForecast.summary ?? {}) as {
    demandTrend: 'down' | 'flat' | 'up';
    opportunityPct: number;
    confidence: 'low' | 'medium' | 'high';
    marketCoveragePct?: number;
    marketSamplesTotal?: number;
    nightsWithMarket?: number;
    nightsTotal?: number;
  };
  const pricingSignalDemandTrend = pricingSummary.demandTrend;
  const pricingSignalOpportunityPct = pricingSummary.opportunityPct;
  const pricingSignalConfidence = pricingSummary.confidence;

  return {
    hotelId,
    generatedAtUtc: new Date().toISOString(),
    ops: {
      arrivalsNext24h: ops.arrivalsNext24h,
      departuresNext24h: ops.departuresNext24h,
      inhouseNow: ops.inhouseNow,
      windowStartUtc: ops.windowStartUtc,
      windowEndUtc: ops.windowEndUtc,
    },
    weather: weather
      ? {
          syncedAtUtc: weather.syncedAtUtc,
          timezone: weather.timezone,
          location: weather.location,
          daysAvailable: weather.daysAvailable,
          isFresh: weather.isFresh,
          stale: weather.stale,
          staleHours: weather.staleHours,
          next24h: weather.next24h,
        }
      : null,
    pricingForecast: {
      mode: pricingForecast.mode,
      generatedAtUtc: pricingForecast.generatedAtUtc,
      windowStartUtc: pricingForecast.windowStartUtc,
      windowEndUtc: pricingForecast.windowEndUtc,
      source: pricingForecast.source,
      version: pricingForecast.version,
      summary: pricingForecast.summary,
      calendar: pricingForecast.calendar,
    },
    pricingCalendar: pricingForecast.calendar,
    pricingSnapshotMeta: {
      generatedAtUtc: pricingForecast.generatedAtUtc,
      source: pricingForecast.source,
      version: pricingForecast.version,
    },
    pricingSignal: {
      demandTrend: pricingSignalDemandTrend,
      opportunityPct: pricingSignalOpportunityPct,
      confidence: pricingSignalConfidence,
      marketCoveragePct: pricingSummary.marketCoveragePct ?? 0,
      marketSamplesTotal: pricingSummary.marketSamplesTotal ?? 0,
      nightsWithMarket: pricingSummary.nightsWithMarket ?? 0,
      nightsTotal: pricingSummary.nightsTotal ?? pricingForecast.calendar.length,
      note:
        pricingSignalDemandTrend === 'up'
          ? `Demand strengthening - consider +${pricingSignalOpportunityPct}% pricing adjustment.`
          : pricingSignalDemandTrend === 'down'
            ? `Demand softening - consider ${pricingSignalOpportunityPct}% promotional adjustment.`
            : 'Demand stable - maintain current pricing and monitor pace.',
    },
    advisories: advisoryBase.map(({ id, item }) => {
      const routed = routeOpsAdvisory({
        title: item.title,
        reason: item.reason,
        priority: item.priority,
      });

      return {
        id,
        title: item.title,
        reason: item.reason,
        priority: routed.priority,
        department: routed.department,
        source: 'WEATHER_ACTIONS' as const,
        createdTicket: actionToTicket.get(id) ?? null,
      };
    }),
  };
}
