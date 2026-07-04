import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { generateDailyGMBriefing } from '../src/ai/briefing/index.js';

async function main() {
  const hotel = await prisma.hotel.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });

  if (!hotel) {
    console.log('No hotel found. Seed or create a hotel first.');
    return;
  }

  const user = await prisma.user.findFirst({
    where: { hotelId: hotel.id, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  const briefing = await generateDailyGMBriefing(hotel.id, {
    forceRuleBased: true,
    actor: user ? { userId: user.id } : undefined,
  });

  console.log(JSON.stringify({
    hotelId: hotel.id,
    hotelName: hotel.name,
    generatedAt: briefing.generatedAt,
    contextVersion: briefing.contextVersion,
    source: briefing.source,
    hotelHealthScore: briefing.hotelHealthScore,
    executiveSummary: briefing.executiveSummary,
    priorities: briefing.todayPriorities.slice(0, 3).map((item) => item.title),
    recommendations: briefing.recommendedActions.slice(0, 3).map((item) => ({
      title: item.title,
      owner: item.owner,
      priority: item.priority,
    })),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
