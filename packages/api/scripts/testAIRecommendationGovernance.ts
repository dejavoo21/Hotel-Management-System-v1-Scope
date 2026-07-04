import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, '../../../.env') });
dotenv.config({ path: path.resolve(scriptDir, '../.env'), override: true });

async function main() {
  const { prisma } = await import('../src/config/database.js');
  const {
    approveAIRecommendation,
    createTaskFromAIRecommendation,
    expireAIRecommendation,
    persistAIRecommendations,
    rejectAIRecommendation,
  } = await import('../src/ai/recommendations/index.js');

  const hotel = await prisma.hotel.findFirst({ select: { id: true, name: true } });
  if (!hotel) throw new Error('No hotel found');

  const user = await prisma.user.findFirst({
    where: { hotelId: hotel.id, isActive: true },
    select: { id: true, email: true },
  });

  const actor = user
    ? { userId: user.id, ipAddress: 'script', userAgent: 'testAIRecommendationGovernance' }
    : undefined;
  const suffix = new Date().toISOString().replace(/[:.]/g, '-');

  const [approveTarget] = await persistAIRecommendations({
    hotelId: hotel.id,
    sourceType: 'DEPARTMENT_INTELLIGENCE',
    sourceId: `governance-approve-${suffix}`,
    actor,
    recommendations: [
      {
        title: `Governance test approved action ${suffix}`,
        description: 'Validate approval and task creation through the AI governance workflow.',
        category: 'Department Intelligence',
        department: 'Operations',
        priority: 'HIGH',
        confidence: 0.91,
        rationale: 'Test recommendation used to verify approval, audit, event, and task creation flow.',
      },
    ],
  });

  const [rejectTarget] = await persistAIRecommendations({
    hotelId: hotel.id,
    sourceType: 'DEPARTMENT_INTELLIGENCE',
    sourceId: `governance-reject-${suffix}`,
    actor,
    recommendations: [
      {
        title: `Governance test rejected action ${suffix}`,
        description: 'Validate rejection reason persistence.',
        category: 'Department Intelligence',
        department: 'Front Desk',
        priority: 'MEDIUM',
        confidence: 0.74,
        rationale: 'Test recommendation used to verify rejection governance.',
      },
    ],
  });

  const [expireTarget] = await persistAIRecommendations({
    hotelId: hotel.id,
    sourceType: 'DAILY_GM_BRIEFING',
    sourceId: `governance-expire-${suffix}`,
    actor,
    recommendations: [
      {
        title: `Governance test expired action ${suffix}`,
        description: 'Validate expiry prevents later task creation.',
        category: 'Daily GM Briefing',
        department: 'Management',
        priority: 'LOW',
        confidence: 0.64,
        rationale: 'Test recommendation used to verify expiry governance.',
      },
    ],
  });

  const approved = await approveAIRecommendation({ hotelId: hotel.id, recommendationId: approveTarget.id, actor });
  const taskCreated = await createTaskFromAIRecommendation({ hotelId: hotel.id, recommendationId: approved.id, actor });
  const duplicateAttempt = await createTaskFromAIRecommendation({ hotelId: hotel.id, recommendationId: approved.id, actor });
  const rejected = await rejectAIRecommendation({
    hotelId: hotel.id,
    recommendationId: rejectTarget.id,
    actor,
    rejectionReason: 'Script rejection test: recommendation is intentionally not needed.',
  });
  const expired = await expireAIRecommendation({ hotelId: hotel.id, recommendationId: expireTarget.id, actor });

  console.log(JSON.stringify({
    hotel: hotel.name,
    actor: user?.email || 'system',
    approved: { id: approved.id, status: approved.status },
    taskCreated: { id: taskCreated.id, status: taskCreated.status, taskId: taskCreated.createdTaskId },
    duplicateTaskAttempt: { id: duplicateAttempt.id, status: duplicateAttempt.status, taskId: duplicateAttempt.createdTaskId },
    rejected: { id: rejected.id, status: rejected.status, reason: rejected.rejectionReason },
    expired: { id: expired.id, status: expired.status },
    duplicatePreventionWorked: taskCreated.createdTaskId === duplicateAttempt.createdTaskId,
  }, null, 2));
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
