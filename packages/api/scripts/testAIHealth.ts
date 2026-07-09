import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'packages/api/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error(JSON.stringify({
      ok: false,
      errorCode: 'DATABASE_URL_MISSING',
      message: 'DATABASE_URL is not set. Set DATABASE_URL or run this script inside the deployed Railway service.',
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const { prisma } = await import('../src/config/database.js');
  const { buildHotelContext } = await import('../src/ai/context/index.js');
  const { generateDailyGMBriefing } = await import('../src/ai/briefing/index.js');
  const { generateDepartmentBriefing } = await import('../src/ai/department-intelligence/index.js');
  const {
    listAIRecommendations,
    persistAIRecommendations,
  } = await import('../src/ai/recommendations/index.js');
  const hotel = await prisma.hotel.findFirst({
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!hotel) {
    console.log(JSON.stringify({ ok: false, errorCode: 'CONTEXT_EMPTY', message: 'No hotel records found.' }, null, 2));
    return;
  }

  const context = await buildHotelContext(hotel.id, { limit: 10 });
  const briefing = await generateDailyGMBriefing(hotel.id, { forceRuleBased: true, persistRecommendations: false });
  const security = await generateDepartmentBriefing(hotel.id, 'security', { forceRuleBased: true, persistRecommendations: false });
  const revenue = await generateDepartmentBriefing(hotel.id, 'revenue', { forceRuleBased: true, persistRecommendations: false });

  const beforeRecommendations = await listAIRecommendations(hotel.id, { limit: 10 });
  const healthSourceId = `ai-health:${new Date().toISOString().slice(0, 10)}`;
  await persistAIRecommendations({
    hotelId: hotel.id,
    sourceType: 'DEPARTMENT_INTELLIGENCE',
    sourceId: healthSourceId,
    recommendations: [
      {
        title: 'AI health verification recommendation',
        description: 'Safe idempotent test recommendation created by the AI health script.',
        category: 'AI_HEALTH',
        department: 'Operations',
        priority: 'LOW',
        confidence: 0.9,
        rationale: 'Verifies AI recommendation persistence without exposing secrets.',
      },
    ],
  });
  const afterRecommendations = await listAIRecommendations(hotel.id, { limit: 10 });

  console.log(JSON.stringify({
    ok: true,
    hotelId: hotel.id,
    hotelName: hotel.name,
    generatedAt: new Date().toISOString(),
    context: {
      version: context.metadata.contextVersion,
      sectionsIncluded: context.metadata.sectionsIncluded,
      warnings: context.metadata.warnings,
      occupancyPercentage: context.occupancy?.occupancyPercentage ?? null,
      activeSecurityAlerts: context.security?.activeAlerts?.length ?? 0,
      openMaintenanceWorkOrders: context.maintenance?.openWorkOrders?.length ?? 0,
      activeIncidents: context.incidents?.activeIncidents?.length ?? 0,
    },
    dailyBriefing: {
      source: briefing.source,
      hotelHealthScore: briefing.hotelHealthScore,
      priorities: briefing.todayPriorities.length,
      recommendations: briefing.recommendedActions.length,
    },
    departmentIntelligence: {
      security: {
        status: security.currentStatus,
        risks: security.topRisks.length,
        priorities: security.topPriorities.length,
      },
      revenue: {
        status: revenue.currentStatus,
        risks: revenue.topRisks.length,
        priorities: revenue.topPriorities.length,
      },
    },
    recommendations: {
      before: beforeRecommendations.length,
      after: afterRecommendations.length,
      testSourceId: healthSourceId,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    const code = error?.code === 'P2021' || error?.code === 'P2022'
      ? 'DATABASE_SCHEMA_MISMATCH'
      : 'AI_CONTEXT_FAILED';
    console.error(JSON.stringify({
      ok: false,
      errorCode: code,
      message: error?.message || 'AI health check failed',
      prismaCode: error?.code,
      meta: error?.meta,
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (!process.env.DATABASE_URL) return;
    const { prisma } = await import('../src/config/database.js');
    await prisma.$disconnect();
  });
