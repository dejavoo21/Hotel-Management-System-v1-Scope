import { prisma } from '../config/database.js';

type RainRisk = 'low' | 'medium' | 'high' | 'unknown';

export interface WeatherContext {
  syncedAtUtc: string | null;
  city: string;
  country: string;
  timezone: string | null;
  location: { lat: number | null; lon: number | null };
  daysAvailable: number;
  isFresh: boolean;
  stale: boolean;
  staleHours: number | null;
  current: {
    temperatureC: number | null;
    feelsLikeC: number | null;
    summary: string | null;
    observedAtUtc: string | null;
  } | null;
  next24h: {
    summary: string | null;
    highC: number | null;
    lowC: number | null;
    rainRisk: RainRisk;
  } | null;
  hourly: Array<{
    forecastAtUtc: string;
    temperatureC: number | null;
    precipitationProbabilityPct: number | null;
    summary: string | null;
  }>;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function computeRainRisk(precipitationProbMax: number | null): RainRisk {
  if (precipitationProbMax == null) return 'unknown';
  if (precipitationProbMax >= 70) return 'high';
  if (precipitationProbMax >= 35) return 'medium';
  return 'low';
}

export async function getWeatherContextForHotel(hotelId: string): Promise<WeatherContext | null> {
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: {
      id: true,
      city: true,
      country: true,
      timezone: true,
      latitude: true,
      longitude: true,
    },
  });

  if (!hotel) return null;

  const latestSignal = await prisma.externalSignal.findFirst({
    where: {
      hotelId,
      type: 'WEATHER',
      source: 'openweathermap',
    },
    orderBy: [{ fetchedAtUtc: 'desc' }, { dateLocal: 'asc' }],
    select: {
      fetchedAtUtc: true,
    },
  });

  if (!latestSignal) {
    return {
      syncedAtUtc: null,
      city: hotel.city,
      country: hotel.country,
      timezone: hotel.timezone || null,
      location: { lat: hotel.latitude ?? null, lon: hotel.longitude ?? null },
      daysAvailable: 0,
      isFresh: false,
      stale: true,
      staleHours: null,
      current: null,
      next24h: null,
      hourly: [],
    };
  }

  const forecastRows = await prisma.externalSignal.findMany({
    where: {
      hotelId,
      type: 'WEATHER',
      source: 'openweathermap',
      fetchedAtUtc: latestSignal.fetchedAtUtc,
    },
    orderBy: [{ dateLocal: 'asc' }],
    select: {
      dateLocal: true,
      metricsJson: true,
      rawJson: true,
    },
  });

  const daysAvailable = forecastRows.length;
  const latestFetched = latestSignal.fetchedAtUtc;

  const syncedAtUtc = latestFetched ? latestFetched.toISOString() : null;
  const staleHours = latestFetched ? (Date.now() - latestFetched.getTime()) / (60 * 60 * 1000) : null;
  const isFresh = staleHours != null ? staleHours < 6 : false;
  const stale = !isFresh;

  const next = forecastRows[0];
  const metrics = (next?.metricsJson || {}) as Record<string, unknown>;
  const highC = normalizeNumber(metrics.tempMax);
  const lowC = normalizeNumber(metrics.tempMin);
  const weatherMain = typeof metrics.weatherMain === 'string' ? metrics.weatherMain : null;
  const weatherDesc = typeof metrics.weatherDesc === 'string' ? metrics.weatherDesc : null;
  const rainProb = normalizeNumber(metrics.precipitationProbMax);
  const currentTempC = normalizeNumber(metrics.currentTempC);
  const currentFeelsLikeC = normalizeNumber(metrics.currentFeelsLikeC);
  const currentSummary =
    typeof metrics.currentWeatherDesc === 'string'
      ? metrics.currentWeatherDesc
      : typeof metrics.currentWeatherMain === 'string'
        ? metrics.currentWeatherMain
        : null;
  const currentObservedAtUtc =
    typeof metrics.currentObservedAtUtc === 'string' ? metrics.currentObservedAtUtc : null;
  const nowMs = Date.now();
  const hourly = forecastRows
    .flatMap((row) => {
      const raw = (row.rawJson || {}) as Record<string, unknown>;
      return Array.isArray(raw.hourly) ? raw.hourly : [];
    })
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => ({
      forecastAtUtc: typeof entry.forecastAtUtc === 'string' ? entry.forecastAtUtc : '',
      temperatureC: normalizeNumber(entry.temperatureC),
      precipitationProbabilityPct: normalizeNumber(entry.precipitationProbabilityPct),
      summary: typeof entry.summary === 'string' ? entry.summary : null,
    }))
    .filter((entry) => entry.forecastAtUtc && new Date(entry.forecastAtUtc).getTime() >= nowMs - 30 * 60 * 1000)
    .sort((a, b) => a.forecastAtUtc.localeCompare(b.forecastAtUtc))
    .slice(0, 8);

  return {
    syncedAtUtc,
    city: hotel.city,
    country: hotel.country,
    timezone: hotel.timezone || null,
    location: {
      lat: hotel.latitude ?? null,
      lon: hotel.longitude ?? null,
    },
    daysAvailable,
    isFresh,
    stale,
    staleHours: staleHours != null ? Number(staleHours.toFixed(1)) : null,
    current: currentTempC != null || currentSummary
      ? {
          temperatureC: currentTempC,
          feelsLikeC: currentFeelsLikeC,
          summary: currentSummary,
          observedAtUtc: currentObservedAtUtc,
        }
      : null,
    next24h: next
      ? {
          summary: weatherDesc || weatherMain,
          highC,
          lowC,
          rainRisk: computeRainRisk(rainProb),
        }
      : null,
    hourly,
  };
}
