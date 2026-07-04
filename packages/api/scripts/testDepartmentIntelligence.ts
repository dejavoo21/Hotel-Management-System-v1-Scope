import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { generateDepartmentBriefing, type DepartmentIntelligenceDepartment } from '../src/ai/department-intelligence/index.js';

const departments: DepartmentIntelligenceDepartment[] = [
  'front-desk',
  'housekeeping',
  'maintenance',
  'security',
  'revenue',
  'guest-experience',
];

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

  const briefings = [];
  for (const department of departments) {
    const briefing = await generateDepartmentBriefing(hotel.id, department, {
      forceRuleBased: true,
      actor: user ? { userId: user.id } : undefined,
    });
    briefings.push({
      department: briefing.department,
      currentStatus: briefing.currentStatus,
      summary: briefing.summary,
      topPriorities: briefing.topPriorities.slice(0, 3).map((item) => item.title),
      recommendedActions: briefing.recommendedActions.slice(0, 3).map((item) => item.title),
    });
  }

  console.log(JSON.stringify({
    hotelId: hotel.id,
    hotelName: hotel.name,
    generatedAt: new Date().toISOString(),
    briefings,
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
