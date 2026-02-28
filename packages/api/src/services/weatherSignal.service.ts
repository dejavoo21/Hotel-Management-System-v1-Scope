import { prisma } from '../config/database.js';
import { config } from '../config/index.js';

type ForecastEntry = {
  dt: number;
  main?: {
    temp_min?: number;
    temp_max?: number;
    humidity?: number;
  };
  wind?: {
    speed?: number;
  };
  pop?: number;
  weather?: Array<{
    main?: string;
    description?: string;
  }>;
};

type ForecastResponse = {
  cod?: string;
  list?: ForecastEntry[];
};

type DailyAggregate = {
  dateLocal: string;
  timezone: string;
  metricsJson: {
    tempMin: number | null;
    tempMax: number | null;
    humidityAvg: number | null;
    windSpeedAvg: number | null;
    precipitationProbMax: number | null;
    weatherMain: string | null;
    weatherDesc: string | null;
  };
  rawJson: {
    entries: number;
    forecastTimesUtc: string[];
  };
};

const OWM_GEO_URL = 'https://api.openweathermap.org/geo/1.0/direct';
const OWM_FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast';

function normalizeCountryForOpenWeather(country: string): string {
  const normalized = country.trim().toUpperCase();
  if (normalized === 'USA' || normalized === 'UNITED STATES' || normalized === 'UNITED STATES OF AMERICA') {
    return 'US';
  }
  return country.trim();
}

function assertOpenWeatherKey(): string {
  const apiKey = config.openWeather.apiKey;
  if (!apiKey) {
    throw new Error('OPENWEATHER_API_KEY is not configured');
  }
  return apiKey;
}

function formatHotelLocalDate(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new Error(`Failed to format local date for timezone ${timeZone}`);
  }
  return `${year}-${month}-${day}`;
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Number((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2));
}

function maxOrNull(values: number[]): number | null {
  if (!values.length) return null;
  return Number(Math.max(...values).toFixed(2));
}

function minOrNull(values: number[]): number | null {
  if (!values.length) return null;
  return Number(Math.min(...values).toFixed(2));
}

function mostFrequent(values: Array<string | undefined>): string | null {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  let winner: string | null = null;
  let maxCount = 0;
  for (const [value, count] of counts.entries()) {
    if (count > maxCount) {
      winner = value;
      maxCount = count;
    }
  }
  return winner;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenWeather request failed (${response.status}): ${text}`);
  }
  return (await response.json()) as T;
}

export async function geocodeHotelIfMissing(hotelId: string) {
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
  if (!hotel) throw new Error('Hotel not found');
  if (!hotel.city || !hotel.country || !hotel.timezone) {
    throw new Error('Hotel city, country, and timezone are required');
  }

  if (hotel.latitude != null && hotel.longitude != null) {
    return hotel;
  }

  const apiKey = assertOpenWeatherKey();
  const countryHint = normalizeCountryForOpenWeather(hotel.country);
  const geoQueries = [`${hotel.city},${countryHint}`];
  if (countryHint.toUpperCase() !== hotel.country.trim().toUpperCase()) {
    geoQueries.push(`${hotel.city},${hotel.country}`);
  }

  let geo: Array<{ lat: number; lon: number }> = [];
  for (const query of geoQueries) {
    const q = encodeURIComponent(query);
    geo = await getJson<Array<{ lat: number; lon: number }>>(
      `${OWM_GEO_URL}?q=${q}&limit=1&appid=${encodeURIComponent(apiKey)}`
    );
    if (geo.length) break;
  }
  if (!geo.length) {
    throw new Error(
      `No geocoding result for ${hotel.city}, ${hotel.country}. Try ISO country code (example: US).`
    );
  }

  return prisma.hotel.update({
    where: { id: hotelId },
    data: {
      latitude: geo[0].lat,
      longitude: geo[0].lon,
      locationUpdatedAt: new Date(),
    },
  });
}

export function aggregateForecastByHotelDate(
  forecast: ForecastResponse,
  timeZone: string
): DailyAggregate[] {
  const entries = forecast.list || [];
  const buckets = new Map<
    string,
    {
      tempMin: number[];
      tempMax: number[];
      humidity: number[];
      windSpeed: number[];
      pop: number[];
      weatherMain: Array<string | undefined>;
      weatherDesc: Array<string | undefined>;
      utcTimes: string[];
    }
  >();

  for (const entry of entries) {
    const dt = new Date(entry.dt * 1000);
    const dateLocal = formatHotelLocalDate(dt, timeZone);
    const bucket =
      buckets.get(dateLocal) ||
      {
        tempMin: [],
        tempMax: [],
        humidity: [],
        windSpeed: [],
        pop: [],
        weatherMain: [],
        weatherDesc: [],
        utcTimes: [],
      };

    if (typeof entry.main?.temp_min === 'number') bucket.tempMin.push(entry.main.temp_min);
    if (typeof entry.main?.temp_max === 'number') bucket.tempMax.push(entry.main.temp_max);
    if (typeof entry.main?.humidity === 'number') bucket.humidity.push(entry.main.humidity);
    if (typeof entry.wind?.speed === 'number') bucket.windSpeed.push(entry.wind.speed);
    if (typeof entry.pop === 'number') bucket.pop.push(entry.pop);
    bucket.weatherMain.push(entry.weather?.[0]?.main);
    bucket.weatherDesc.push(entry.weather?.[0]?.description);
    bucket.utcTimes.push(dt.toISOString());

    buckets.set(dateLocal, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateLocal, bucket]) => ({
      dateLocal,
      timezone: timeZone,
      metricsJson: {
        tempMin: minOrNull(bucket.tempMin),
        tempMax: maxOrNull(bucket.tempMax),
        humidityAvg: avg(bucket.humidity),
        windSpeedAvg: avg(bucket.windSpeed),
        precipitationProbMax: bucket.pop.length ? Number((Math.max(...bucket.pop) * 100).toFixed(2)) : null,
        weatherMain: mostFrequent(bucket.weatherMain),
        weatherDesc: mostFrequent(bucket.weatherDesc),
      },
      rawJson: {
        entries: bucket.utcTimes.length,
        forecastTimesUtc: bucket.utcTimes,
      },
    }));
}

export async function syncWeatherSignalsForHotel(hotelId: string) {
  const apiKey = assertOpenWeatherKey();
  const hotel = await geocodeHotelIfMissing(hotelId);

  if (hotel.latitude == null || hotel.longitude == null) {
    throw new Error('Hotel location coordinates are missing');
  }

  const forecast = await getJson<ForecastResponse>(
    `${OWM_FORECAST_URL}?lat=${hotel.latitude}&lon=${hotel.longitude}&units=metric&appid=${encodeURIComponent(apiKey)}`
  );
  const aggregates = aggregateForecastByHotelDate(forecast, hotel.timezone);
  const fetchedAtUtc = new Date();

  for (const day of aggregates) {
    await prisma.externalSignal.upsert({
      where: {
        hotelId_type_dateLocal_source: {
          hotelId: hotel.id,
          type: 'WEATHER',
          dateLocal: new Date(`${day.dateLocal}T00:00:00.000Z`),
          source: 'openweathermap',
        },
      },
      create: {
        hotelId: hotel.id,
        type: 'WEATHER',
        dateLocal: new Date(`${day.dateLocal}T00:00:00.000Z`),
        timezone: hotel.timezone,
        metricsJson: day.metricsJson,
        source: 'openweathermap',
        fetchedAtUtc,
        rawJson: day.rawJson,
      },
      update: {
        timezone: hotel.timezone,
        metricsJson: day.metricsJson,
        fetchedAtUtc,
        rawJson: day.rawJson,
      },
    });
  }

  return {
    hotelId: hotel.id,
    city: hotel.city,
    country: hotel.country,
    timezone: hotel.timezone,
    lat: hotel.latitude,
    lon: hotel.longitude,
    daysStored: aggregates.length,
    fetchedAtUtc: fetchedAtUtc.toISOString(),
  };
}

export async function getWeatherSignalsStatus(hotelId: string) {
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: {
      id: true,
      city: true,
      country: true,
      timezone: true,
      latitude: true,
      longitude: true,
      externalSignals: {
        where: { type: 'WEATHER', source: 'openweathermap' },
        orderBy: { fetchedAtUtc: 'desc' },
        select: { fetchedAtUtc: true, dateLocal: true },
      },
    },
  });
  if (!hotel) throw new Error('Hotel not found');

  const daysAvailable = hotel.externalSignals.length;
  const lastSyncTime = hotel.externalSignals[0]?.fetchedAtUtc?.toISOString() ?? null;

  return {
    hotelId: hotel.id,
    lastSyncTime,
    daysAvailable,
    hasCity: Boolean(hotel.city),
    hasLatLon: hotel.latitude != null && hotel.longitude != null,
    city: hotel.city,
    country: hotel.country,
    timezone: hotel.timezone,
    lat: hotel.latitude,
    lon: hotel.longitude,
  };
}

export async function getLatestWeatherSignals(hotelId: string) {
  const rows = await prisma.externalSignal.findMany({
    where: { hotelId, type: 'WEATHER', source: 'openweathermap' },
    orderBy: { dateLocal: 'asc' },
  });
  return rows.map((row) => ({
    id: row.id,
    hotelId: row.hotelId,
    type: row.type,
    dateLocal: row.dateLocal.toISOString().slice(0, 10),
    timezone: row.timezone,
    metrics: row.metricsJson,
    source: row.source,
    fetchedAtUtc: row.fetchedAtUtc.toISOString(),
    rawJson: row.rawJson,
  }));
}
