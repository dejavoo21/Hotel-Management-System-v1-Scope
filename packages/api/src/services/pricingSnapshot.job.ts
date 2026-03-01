import { prisma } from '../config/database.js';
import { generatePricingForecastSnapshot } from './pricingForecast.service.js';

const MAX_AGE_MINUTES = 90;

export interface PricingSnapshotJobResult {
  hotelId: string;
  status: 'created' | 'skipped' | 'failed';
  generatedAtUtc?: string;
  reason?: string;
  error?: string;
}

export async function runPricingSnapshotJob(params?: {
  hotelId?: string;
  daysAhead?: number;
  force?: boolean;
}): Promise<{ results: PricingSnapshotJobResult[]; ranAtUtc: string }> {
  const ranAtUtc = new Date().toISOString();
  const daysAhead = params?.daysAhead ?? 30;
  const force = Boolean(params?.force);

  const hotels = await prisma.hotel.findMany({
    where: params?.hotelId ? { id: params.hotelId } : {},
    select: { id: true },
  });

  const results: PricingSnapshotJobResult[] = [];

  for (const hotel of hotels) {
    try {
      if (!force) {
        const latest = await prisma.pricingSnapshot.findFirst({
          where: { hotelId: hotel.id },
          orderBy: { generatedAtUtc: 'desc' },
          select: { generatedAtUtc: true },
        });

        if (latest?.generatedAtUtc) {
          const ageMinutes = minutesSince(latest.generatedAtUtc);
          if (ageMinutes <= MAX_AGE_MINUTES) {
            results.push({
              hotelId: hotel.id,
              status: 'skipped',
              reason: `Snapshot is fresh (${ageMinutes}m old)`,
            });
            continue;
          }
        }
      }

      const forecast = await generatePricingForecastSnapshot(hotel.id, daysAhead);

      await prisma.pricingSnapshot.create({
        data: {
          hotelId: hotel.id,
          windowStartUtc: new Date(forecast.windowStartUtc),
          windowEndUtc: new Date(forecast.windowEndUtc),
          generatedAtUtc: new Date(forecast.generatedAtUtc),
          calendar: forecast.calendar,
          summary: forecast.summary,
          source: forecast.source,
          version: forecast.version,
        },
      });

      await prisma.pricingSnapshot.deleteMany({
        where: {
          hotelId: hotel.id,
          generatedAtUtc: { lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        },
      });

      results.push({
        hotelId: hotel.id,
        status: 'created',
        generatedAtUtc: forecast.generatedAtUtc,
      });
    } catch (error) {
      results.push({
        hotelId: hotel.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { results, ranAtUtc };
}

function minutesSince(date: Date): number {
  const ms = Date.now() - new Date(date).getTime();
  return Math.max(0, Math.round(ms / (60 * 1000)));
}
