import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DAYS = 14;

type CompetitorSeed = {
  name: string;
  city: string;
  country: string;
  nightlyBaseRate: number;
};

const COMPETITOR_TEMPLATE: CompetitorSeed[] = [
  { name: 'Riverside Grand', city: 'New York', country: 'USA', nightlyBaseRate: 172 },
  { name: 'Metro Suites', city: 'New York', country: 'USA', nightlyBaseRate: 156 },
  { name: 'Parklane Inn', city: 'New York', country: 'USA', nightlyBaseRate: 184 },
];

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function nightRate(baseRate: number, date: Date, offset: number): number {
  const day = date.getUTCDay();
  const weekendBump = day === 5 || day === 6 ? 22 : 0;
  const trend = Math.round(offset * 0.8);
  const oscillation = ((offset % 3) - 1) * 4;
  return Math.max(89, Math.round(baseRate + weekendBump + trend + oscillation));
}

async function ensureCompetitor(hotelId: string, seed: CompetitorSeed) {
  const existing = await prisma.competitorHotel.findFirst({
    where: { hotelId, name: seed.name },
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await prisma.competitorHotel.create({
    data: {
      hotelId,
      name: seed.name,
      city: seed.city,
      country: seed.country,
      isActive: true,
    },
    select: { id: true },
  });

  return created.id;
}

async function seedHotel(hotelId: string) {
  const start = utcMidnight(new Date());
  const end = addDays(start, DAYS - 1);

  let totalInserted = 0;
  let totalCompetitors = 0;

  for (const competitor of COMPETITOR_TEMPLATE) {
    const competitorHotelId = await ensureCompetitor(hotelId, competitor);
    totalCompetitors += 1;

    const existingRates = await prisma.competitorRateSnapshot.findMany({
      where: {
        competitorHotelId,
        nightDate: { gte: start, lte: end },
      },
      select: { nightDate: true },
    });

    const existingNightKeys = new Set(existingRates.map((r) => r.nightDate.toISOString().slice(0, 10)));

    const rows = [];
    for (let i = 0; i < DAYS; i += 1) {
      const nightDate = addDays(start, i);
      const key = nightDate.toISOString().slice(0, 10);
      if (existingNightKeys.has(key)) continue;

      rows.push({
        competitorHotelId,
        nightDate,
        rate: nightRate(competitor.nightlyBaseRate, nightDate, i),
        currency: 'USD',
        source: 'MANUAL',
        collectedAtUtc: new Date(),
      });
    }

    if (rows.length > 0) {
      const result = await prisma.competitorRateSnapshot.createMany({ data: rows });
      totalInserted += result.count;
    }
  }

  console.log(`Hotel ${hotelId}: competitors=${totalCompetitors}, insertedRates=${totalInserted}`);
}

async function main() {
  const hotels = await prisma.hotel.findMany({ select: { id: true, name: true } });

  if (!hotels.length) {
    console.log('No hotels found.');
    return;
  }

  for (const hotel of hotels) {
    await seedHotel(hotel.id);
  }
}

main()
  .catch((error) => {
    console.error('Failed to seed market coverage:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

