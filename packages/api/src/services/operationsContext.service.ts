import { prisma } from '../config/database.js';
import type { WeatherContext } from './weatherContext.provider.js';
import { getWeatherContextForHotel } from './weatherContext.provider.js';

export type WeatherActionPriority = 'low' | 'medium' | 'high';
export type WeatherActionCategory =
  | 'Front Desk'
  | 'Concierge'
  | 'Housekeeping'
  | 'F&B'
  | 'Maintenance';

type AdvisoryDepartment =
  | 'FRONT_DESK'
  | 'HOUSEKEEPING'
  | 'MAINTENANCE'
  | 'CONCIERGE'
  | 'BILLING'
  | 'MANAGEMENT';

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

function mapWeatherCategoryToDepartment(category?: WeatherActionCategory): AdvisoryDepartment {
  switch (category) {
    case 'Housekeeping':
      return 'HOUSEKEEPING';
    case 'Maintenance':
      return 'MAINTENANCE';
    case 'Concierge':
      return 'CONCIERGE';
    case 'F&B':
      return 'MANAGEMENT';
    case 'Front Desk':
    default:
      return 'FRONT_DESK';
  }
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
  const [weather, ops] = await Promise.all([
    getWeatherContextForHotel(hotelId),
    getOpsContextForHotel(hotelId),
  ]);

  const advisoriesResult = await getWeatherOpsActions(weather, ops);
  const demandTrend: 'down' | 'flat' | 'up' =
    ops.arrivalsNext24h > ops.departuresNext24h
      ? 'up'
      : ops.arrivalsNext24h < ops.departuresNext24h
        ? 'down'
        : 'flat';
  const opportunityPct = demandTrend === 'up' ? 6 : demandTrend === 'down' ? -4 : 0;
  const confidence: 'low' | 'medium' | 'high' = weather?.isFresh ? 'medium' : 'low';

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
    pricingSignal: {
      demandTrend,
      opportunityPct,
      confidence,
      note:
        demandTrend === 'up'
          ? `Consider a +${opportunityPct}% rate lift for high-demand windows.`
          : demandTrend === 'down'
            ? `Consider promotional pricing (${opportunityPct}%) to stabilize occupancy.`
            : 'Keep current rates and monitor booking pace.',
    },
    advisories: advisoriesResult.actions.slice(0, 5).map((item, index) => ({
      id: `${advisoryIdForAction(item)}-${index + 1}`,
      title: item.title,
      reason: item.reason,
      priority: item.priority,
      department: mapWeatherCategoryToDepartment(item.category),
      source: 'WEATHER_ACTIONS' as const,
    })),
  };
}
