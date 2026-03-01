import { prisma } from '../config/database.js';
import { getWeatherContextForHotel } from './weatherContext.provider.js';

type DemandTrend = 'down' | 'flat' | 'up';
type Confidence = 'low' | 'medium' | 'high';

export type PricingSource = 'INTERNAL_RULES';

export interface PricingCalendarNight {
  date: string; // YYYY-MM-DD (hotel local conceptual date)
  bookingsCount: number; // bookings overlapping this night
  arrivals: number; // check-ins on this date
  departures: number; // check-outs on this date (morning)
  occupancyForecast: number; // 0..1 (estimated)
  adrEstimate: number | null; // estimated ADR from roomRate
  weather: {
    summary: string | null;
    rainRisk: 'low' | 'medium' | 'high' | null;
    isFresh: boolean;
    stale: boolean;
    staleHours: number | null;
  } | null;
  suggestedAdjustmentPct: number; // e.g. +6 / -4
  confidence: Confidence;
  reasons: string[];
  marketMedian: number | null;
  marketMin: number | null;
  marketMax: number | null;
  marketSamples: number;
  positionVsMarketPct: number | null; // (your adr - median)/median * 100
}

export interface PricingForecastResult {
  generatedAtUtc: string;
  windowStartUtc: string;
  windowEndUtc: string;
  source: PricingSource;
  version: 'v1';
  summary: {
    demandTrend: DemandTrend;
    opportunityPct: number;
    confidence: Confidence;
    adrBaseEstimate: number | null;
    occupancyNext7dAvg: number | null;
    reasons: string[];
    marketCoveragePct: number;
    marketSamplesTotal: number;
    nightsWithMarket: number;
    nightsTotal: number;
  };
  calendar: PricingCalendarNight[];
}

/**
 * Generate pricing forecast guidance for the next N days.
 * Uses internal bookings pace + simple heuristics (+ optional weather modifier).
 *
 * NOTE: This is "pricing guidance" not ML. It will improve as you add:
 * - capacity/inventory, room-type segmentation, competitor rates, events, etc.
 */
export async function generatePricingForecastSnapshot(
  hotelId: string,
  daysAhead = 30
): Promise<PricingForecastResult> {
  const nowUtc = new Date();
  const windowStartUtc = startOfUtcDay(nowUtc);
  const windowEndUtc = addUtcDays(windowStartUtc, daysAhead);

  // Weather context (already exists in your system)
  const weather = await getWeatherContextForHotel(hotelId);

  // Pull bookings overlapping the window (only relevant statuses)
  // Adjust statuses as needed; typically exclude CANCELLED/NO_SHOW.
  const bookings = await prisma.booking.findMany({
    where: {
      hotelId,
      status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] as any },
      // overlap window: checkIn < end && checkOut > start
      checkInDate: { lt: windowEndUtc },
      checkOutDate: { gt: windowStartUtc },
    },
    select: {
      id: true,
      checkInDate: true,
      checkOutDate: true,
      roomRate: true,
      status: true,
      createdAt: true,
    },
  });

  // Estimate "capacity" if you don't yet have an inventory-by-date model.
  // v1 fallback: count total rooms for hotel; if unavailable, use 1 to avoid divide by zero.
  const roomsCount = await prisma.room.count({ where: { hotelId } }).catch(() => 0);
  const capacity = Math.max(roomsCount || 0, 1);
  const comps = await prisma.competitorHotel.findMany({
    where: { hotelId, isActive: true },
    select: { id: true },
  });

  const compRates = comps.length
    ? await prisma.competitorRateSnapshot.findMany({
        where: {
          competitorHotelId: { in: comps.map((c) => c.id) },
          nightDate: { gte: windowStartUtc, lt: windowEndUtc },
        },
        select: { nightDate: true, rate: true },
      })
    : [];
  const marketByDay = new Map<string, number[]>();
  for (const r of compRates) {
    const key = toYmd(r.nightDate);
    const list = marketByDay.get(key) ?? [];
    list.push(Number(r.rate));
    marketByDay.set(key, list);
  }

  const calendar: PricingCalendarNight[] = [];
  const nights = enumerateUtcDates(windowStartUtc, daysAhead);

  // Pre-calc arrival/departure counts by date
  const arrivalsByDay = new Map<string, number>();
  const departuresByDay = new Map<string, number>();

  for (const b of bookings) {
    const inKey = toYmd(b.checkInDate);
    const outKey = toYmd(b.checkOutDate);
    arrivalsByDay.set(inKey, (arrivalsByDay.get(inKey) ?? 0) + 1);
    departuresByDay.set(outKey, (departuresByDay.get(outKey) ?? 0) + 1);
  }

  // ADR base estimate from current window (simple)
  const adrBaseEstimate = computeAdrEstimate(bookings.map((b) => Number(b.roomRate ?? 0)));

  // Core scoring thresholds (tune later)
  // occupancyForecast:
  // - < 0.40 => demand weak
  // - 0.40–0.70 => normal
  // - > 0.70 => strong
  for (const day of nights) {
    const dateKey = toYmd(day);

    const overlapping = bookings.filter((b) => isNightOverlapping(day, b.checkInDate, b.checkOutDate));
    const bookingsCount = overlapping.length;

    const arrivals = arrivalsByDay.get(dateKey) ?? 0;
    const departures = departuresByDay.get(dateKey) ?? 0;

    const occupancyForecast = clamp(bookingsCount / capacity, 0, 1);

    const adrEstimate = computeAdrEstimate(overlapping.map((b) => Number(b.roomRate ?? 0)));
    const marketList = marketByDay.get(dateKey) ?? [];
    const marketSamples = marketList.length;
    const marketMedian = marketSamples ? median(marketList) : null;
    const marketMin = marketSamples ? Math.min(...marketList) : null;
    const marketMax = marketSamples ? Math.max(...marketList) : null;
    const yourAdr = adrEstimate;
    const positionVsMarketPct =
      marketMedian && yourAdr ? Math.round(((yourAdr - marketMedian) / marketMedian) * 100) : null;

    const demandScore = scoreDemand(occupancyForecast, arrivals, departures);
    const weatherScore = scoreWeatherModifier(weather);

    const suggestedAdjustmentPct = clampInt(demandScore + weatherScore, -15, 15);

    const confidence = scoreConfidence({
      bookingsCount,
      capacity,
      hasFreshWeather: Boolean(weather?.isFresh),
      daysAheadFromNow: daysDiffUtc(windowStartUtc, day),
    });

    const reasons = buildReasons({
      occupancyForecast,
      arrivals,
      departures,
      capacity,
      weather,
      day: dateKey,
      confidence,
    });

    calendar.push({
      date: dateKey,
      bookingsCount,
      arrivals,
      departures,
      occupancyForecast,
      adrEstimate,
      weather: weather
        ? {
            summary: weather?.next24h?.summary ?? null,
            rainRisk: (weather?.next24h?.rainRisk as any) ?? null,
            isFresh: Boolean(weather?.isFresh),
            stale: Boolean(weather?.stale),
            staleHours: weather?.staleHours ?? null,
          }
        : null,
      suggestedAdjustmentPct,
      confidence,
      reasons,
      marketMedian,
      marketMin,
      marketMax,
      marketSamples,
      positionVsMarketPct,
    });
  }

  // Summary (next 7 days)
  const next7 = calendar.slice(0, Math.min(7, calendar.length));
  const occAvg =
    next7.length > 0 ? next7.reduce((acc, d) => acc + d.occupancyForecast, 0) / next7.length : null;

  const demandTrend: DemandTrend =
    next7.length === 0
      ? 'flat'
      : occAvg != null && occAvg >= 0.7
        ? 'up'
        : occAvg != null && occAvg <= 0.4
          ? 'down'
          : 'flat';

  // v1 opportunityPct = median of suggested adjustments next 7d
  const opportunityPct = next7.length ? median(next7.map((d) => d.suggestedAdjustmentPct)) : 0;

  const summaryConfidence: Confidence = summarizeConfidence(next7.map((d) => d.confidence), weather);

  const summaryReasons: string[] = [];
  if (occAvg != null) summaryReasons.push(`Avg occupancy outlook (7d): ${(occAvg * 100).toFixed(0)}%`);
  summaryReasons.push(
    demandTrend === 'up'
      ? 'Demand signal: strengthening'
      : demandTrend === 'down'
        ? 'Demand signal: softening'
        : 'Demand signal: stable'
  );
  if (weather && !weather.isFresh) summaryReasons.push('Forecast not fresh — refresh for better guidance');
  if (roomsCount === 0) summaryReasons.push('Room capacity unknown — occupancy estimate may be less accurate');
  const nightsTotal = calendar.length;
  const nightsWithMarket = calendar.filter((n) => n.marketSamples > 0).length;
  const marketSamplesTotal = calendar.reduce((acc, n) => acc + (n.marketSamples || 0), 0);
  const marketCoveragePct = nightsTotal ? Math.round((nightsWithMarket / nightsTotal) * 100) : 0;

  return {
    generatedAtUtc: new Date().toISOString(),
    windowStartUtc: windowStartUtc.toISOString(),
    windowEndUtc: windowEndUtc.toISOString(),
    source: 'INTERNAL_RULES',
    version: 'v1',
    summary: {
      demandTrend,
      opportunityPct,
      confidence: summaryConfidence,
      adrBaseEstimate,
      occupancyNext7dAvg: occAvg,
      reasons: summaryReasons.slice(0, 6),
      marketCoveragePct,
      marketSamplesTotal,
      nightsWithMarket,
      nightsTotal,
    },
    calendar,
  };
}

/* ----------------------------- Scoring Helpers ---------------------------- */

function scoreDemand(occupancyForecast: number, arrivals: number, departures: number): number {
  // demandScore roughly outputs: -10..+10
  let score = 0;

  // occupancy weighting
  if (occupancyForecast >= 0.85) score += 9;
  else if (occupancyForecast >= 0.7) score += 6;
  else if (occupancyForecast >= 0.55) score += 3;
  else if (occupancyForecast <= 0.25) score -= 7;
  else if (occupancyForecast <= 0.4) score -= 4;

  // arrivals vs departures (micro load)
  if (arrivals > departures) score += 2;
  else if (arrivals < departures) score -= 1;

  return score;
}

function scoreWeatherModifier(weather: any): number {
  // Weather modifier is conservative; it should not dominate pricing.
  if (!weather) return 0;

  // If stale, reduce confidence (handled elsewhere) but keep pricing neutral
  if (!weather.isFresh) return 0;

  const rr = weather?.next24h?.rainRisk;
  const summary = (weather?.next24h?.summary ?? '').toLowerCase();

  let mod = 0;

  // Example heuristic:
  // - High rain/storm risk tends to reduce outdoor demand (slight negative)
  // - But in some destinations, rain increases "stay-in" revenue; keep conservative.
  if (rr === 'high') mod -= 2;
  else if (rr === 'medium') mod -= 1;

  if (summary.includes('storm') || summary.includes('thunder')) mod -= 2;
  if (summary.includes('snow')) mod -= 2;

  return mod;
}

function scoreConfidence(params: {
  bookingsCount: number;
  capacity: number;
  hasFreshWeather: boolean;
  daysAheadFromNow: number;
}): Confidence {
  const { bookingsCount, capacity, hasFreshWeather, daysAheadFromNow } = params;

  const occ = capacity > 0 ? bookingsCount / capacity : 0;

  // Lower confidence further out
  if (daysAheadFromNow > 21) return 'low';

  // If no/few rooms data, confidence drops
  if (capacity <= 1) return 'low';

  // If weather is stale, drop confidence a notch
  const weatherPenalty = hasFreshWeather ? 0 : 1;

  // Basic scoring
  let score = 0;
  if (occ >= 0.75) score += 2;
  else if (occ >= 0.5) score += 1;
  else score += 0;

  // more bookings increases confidence
  if (bookingsCount >= 10) score += 2;
  else if (bookingsCount >= 5) score += 1;

  score -= weatherPenalty;

  if (score >= 3) return 'high';
  if (score >= 1) return 'medium';
  return 'low';
}

function summarizeConfidence(list: Confidence[], weather: any): Confidence {
  if (!list.length) return 'low';

  const score = list.reduce((acc, c) => acc + (c === 'high' ? 2 : c === 'medium' ? 1 : 0), 0);
  const avg = score / list.length;

  if (weather && !weather.isFresh) {
    // cap at medium if weather is stale
    if (avg >= 1.5) return 'medium';
  }

  if (avg >= 1.5) return 'high';
  if (avg >= 0.75) return 'medium';
  return 'low';
}

function buildReasons(params: {
  occupancyForecast: number;
  arrivals: number;
  departures: number;
  capacity: number;
  weather: any;
  day: string;
  confidence: Confidence;
}): string[] {
  const { occupancyForecast, arrivals, departures, capacity, weather, confidence } = params;
  const reasons: string[] = [];

  reasons.push(`Occupancy outlook: ${(occupancyForecast * 100).toFixed(0)}% of ${capacity} rooms`);
  if (arrivals || departures) reasons.push(`Arrivals: ${arrivals} • Departures: ${departures}`);

  if (weather) {
    if (!weather.isFresh) reasons.push('Forecast not fresh — refresh to improve accuracy');
    const rr = weather?.next24h?.rainRisk;
    if (rr) reasons.push(`Weather risk: ${rr}`);
  }

  reasons.push(`Confidence: ${confidence}`);
  return reasons.slice(0, 5);
}

/* ----------------------------- Date Utilities ----------------------------- */

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function addUtcDays(d: Date, days: number): Date {
  const copy = new Date(d.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function enumerateUtcDates(start: Date, days: number): Date[] {
  const list: Date[] = [];
  for (let i = 0; i < days; i++) {
    list.push(addUtcDays(start, i));
  }
  return list;
}

function toYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysDiffUtc(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/**
 * "Night overlap": a booking overlaps a night date if:
 * checkIn <= night < checkOut (common hotel logic)
 */
function isNightOverlapping(night: Date, checkIn: Date, checkOut: Date): boolean {
  const n = startOfUtcDay(night).getTime();
  const inT = startOfUtcDay(checkIn).getTime();
  const outT = startOfUtcDay(checkOut).getTime();
  return n >= inT && n < outT;
}

/* ------------------------------ Math Helpers ------------------------------ */

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function clampInt(v: number, min: number, max: number): number {
  const n = Math.round(v);
  return Math.max(min, Math.min(max, n));
}

function computeAdrEstimate(values: number[]): number | null {
  const clean = values.filter((v) => typeof v === 'number' && !Number.isNaN(v) && v > 0);
  if (!clean.length) return null;
  const avg = clean.reduce((a, b) => a + b, 0) / clean.length;
  return Math.round(avg * 100) / 100;
}

function median(values: number[]): number {
  const clean = values
    .filter((v) => typeof v === 'number' && !Number.isNaN(v))
    .slice()
    .sort((a, b) => a - b);
  if (!clean.length) return 0;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 0 ? Math.round((clean[mid - 1] + clean[mid]) / 2) : clean[mid];
}
