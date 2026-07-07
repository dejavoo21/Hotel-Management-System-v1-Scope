import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, '../../../.env') });
dotenv.config({ path: path.resolve(scriptDir, '../.env'), override: true });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log(JSON.stringify({
      skipped: true,
      reason: 'DATABASE_URL is not configured. Set DATABASE_URL to run the end-to-end AI action execution test.',
      checksCoveredWhenConfigured: [
        'pending recommendation execution is blocked',
        'approved recommendation executes through Task Engine',
        'duplicate execution returns the existing linked task',
      ],
    }, null, 2));
    return;
  }

  const { prisma } = await import('../src/config/database.js');
  const {
    approveAIRecommendation,
    persistAIRecommendations,
  } = await import('../src/ai/recommendations/index.js');
  const { executeAIRecommendationAction, previewAIActionExecution } = await import('../src/ai/action-execution/index.js');

  const hotel = await prisma.hotel.findFirst({ select: { id: true, name: true } });
  if (!hotel) throw new Error('No hotel found');

  const user = await prisma.user.findFirst({
    where: { hotelId: hotel.id, isActive: true },
    select: { id: true, email: true },
  });
  const actor = user
    ? { userId: user.id, ipAddress: 'script', userAgent: 'testAIActionExecution' }
    : undefined;
  const suffix = new Date().toISOString().replace(/[:.]/g, '-');

  const [recommendation] = await persistAIRecommendations({
    hotelId: hotel.id,
    sourceType: 'AI_COPILOT',
    sourceId: `action-execution-${suffix}`,
    actor,
    recommendations: [
      {
        title: `Action execution test ${suffix}`,
        description: 'Validate approval-gated AI action execution through the Task Engine.',
        category: 'AI Action Execution',
        department: 'Operations',
        priority: 'HIGH',
        confidence: 0.88,
        rationale: 'Script recommendation used to verify pending actions are blocked and approved actions execute once.',
      },
    ],
  });

  let pendingBlocked = false;
  try {
    await executeAIRecommendationAction({
      hotelId: hotel.id,
      recommendationId: recommendation.id,
      actionType: 'CREATE_TASK',
      actor,
    });
  } catch (error) {
    pendingBlocked = /approved/i.test(error instanceof Error ? error.message : String(error));
  }

  const pendingPreview = await previewAIActionExecution({
    hotelId: hotel.id,
    recommendationId: recommendation.id,
    actionType: 'CREATE_TASK',
    actor,
  });

  const approved = await approveAIRecommendation({
    hotelId: hotel.id,
    recommendationId: recommendation.id,
    actor,
  });

  const executed = await executeAIRecommendationAction({
    hotelId: hotel.id,
    recommendationId: approved.id,
    actionType: 'CREATE_TASK',
    actor,
  });

  const duplicate = await executeAIRecommendationAction({
    hotelId: hotel.id,
    recommendationId: approved.id,
    actionType: 'CREATE_TASK',
    actor,
  });

  console.log(JSON.stringify({
    hotel: hotel.name,
    actor: user?.email || 'system',
    recommendationId: recommendation.id,
    pendingBlocked,
    pendingPreview,
    approved: { status: approved.status },
    executed: {
      status: executed.status,
      taskId: executed.createdTaskId,
    },
    duplicate: {
      status: duplicate.status,
      taskId: duplicate.createdTaskId,
      duplicatePreventionWorked: executed.createdTaskId === duplicate.createdTaskId,
    },
  }, null, 2));

  if (!pendingBlocked) throw new Error('Pending recommendation was not blocked from execution');
  if (!executed.createdTaskId) throw new Error('Approved recommendation did not create a task');
  if (executed.createdTaskId !== duplicate.createdTaskId) throw new Error('Duplicate execution created a different task');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import('../src/config/database.js');
    await prisma.$disconnect();
  });
