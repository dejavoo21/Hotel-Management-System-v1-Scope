import {
  AIRecommendationPriority,
  AIRecommendationSource,
  AIRecommendationStatus,
  Department,
  Role,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
import { prisma } from '../../config/database.js';
import { eventBus } from '../../platform/event-bus/eventBus.service.js';
import { recordAuditEvent } from '../../platform/audit/auditEngine.service.js';
import { createTask } from '../../platform/tasks/taskEngine.service.js';
import { notifyRoles } from '../../platform/notifications/notificationEngine.service.js';
import type {
  AIRecommendationSeed,
  PersistAIRecommendationsInput,
  RecommendationActionInput,
} from './aiRecommendationGovernance.types.js';

function toPriority(priority: string): AIRecommendationPriority {
  if (priority === 'CRITICAL') return AIRecommendationPriority.CRITICAL;
  if (priority === 'HIGH') return AIRecommendationPriority.HIGH;
  if (priority === 'LOW') return AIRecommendationPriority.LOW;
  return AIRecommendationPriority.MEDIUM;
}

function toTaskPriority(priority: AIRecommendationPriority): TicketPriority {
  if (priority === AIRecommendationPriority.CRITICAL) return TicketPriority.URGENT;
  if (priority === AIRecommendationPriority.HIGH) return TicketPriority.HIGH;
  if (priority === AIRecommendationPriority.LOW) return TicketPriority.LOW;
  return TicketPriority.MEDIUM;
}

function toTaskDepartment(department: string): Department {
  const normalized = department.toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized === 'FRONT_DESK') return Department.FRONT_DESK;
  if (normalized === 'HOUSEKEEPING') return Department.HOUSEKEEPING;
  if (normalized === 'MAINTENANCE') return Department.MAINTENANCE;
  if (normalized === 'CONCIERGE' || normalized === 'GUEST_EXPERIENCE') return Department.CONCIERGE;
  if (normalized === 'BILLING' || normalized === 'REVENUE') return Department.BILLING;
  return Department.MANAGEMENT;
}

function toTaskCategory(category: string): TicketCategory {
  const normalized = category.toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized.includes('HOUSEKEEPING')) return TicketCategory.HOUSEKEEPING;
  if (normalized.includes('MAINTENANCE')) return TicketCategory.MAINTENANCE;
  if (normalized.includes('BILLING') || normalized.includes('REVENUE')) return TicketCategory.BILLING;
  if (normalized.includes('CONCIERGE') || normalized.includes('GUEST')) return TicketCategory.CONCIERGE;
  if (normalized.includes('CHECK')) return TicketCategory.CHECK_IN_OUT;
  return TicketCategory.OTHER;
}

function sourceToEnum(sourceType: PersistAIRecommendationsInput['sourceType']): AIRecommendationSource {
  return sourceType === 'DAILY_GM_BRIEFING'
    ? AIRecommendationSource.DAILY_GM_BRIEFING
    : AIRecommendationSource.DEPARTMENT_INTELLIGENCE;
}

export async function persistAIRecommendations(input: PersistAIRecommendationsInput) {
  const saved = [];
  for (const seed of input.recommendations) {
    const priority = toPriority(seed.priority);
    const existing = await prisma.aIRecommendation.findUnique({
      where: {
        hotelId_sourceType_sourceId_title: {
          hotelId: input.hotelId,
          sourceType: sourceToEnum(input.sourceType),
          sourceId: input.sourceId,
          title: seed.title,
        },
      },
    });
    if (existing) {
      saved.push(existing);
      continue;
    }

    const recommendation = await prisma.aIRecommendation.create({
      data: {
        hotelId: input.hotelId,
        sourceType: sourceToEnum(input.sourceType),
        sourceId: input.sourceId,
        title: seed.title,
        description: seed.description,
        category: seed.category,
        department: seed.department,
        priority,
        confidence: seed.confidence ?? 0.75,
        rationale: seed.rationale,
      },
    });

    await recordAuditEvent({
      hotelId: input.hotelId,
      actor: input.actor,
      action: 'AI_RECOMMENDATION_CREATED',
      entity: 'AI_RECOMMENDATION',
      entityId: recommendation.id,
      source: 'hotel-brain',
      details: {
        sourceType: recommendation.sourceType,
        sourceId: recommendation.sourceId,
        department: recommendation.department,
        priority: recommendation.priority,
      },
      idempotencyKey: `ai-recommendation-created:${recommendation.id}`,
    });

    await eventBus.publish({
      eventType: 'ai.recommendation.created',
      hotelId: input.hotelId,
      source: 'hotel-brain',
      userId: input.actor?.userId || undefined,
      idempotencyKey: `ai-recommendation-created:${recommendation.id}`,
      payload: {
        recommendationId: recommendation.id,
        title: recommendation.title,
        department: recommendation.department,
        priority: recommendation.priority,
      },
    });

    saved.push(recommendation);
  }
  return saved;
}

export async function listAIRecommendations(hotelId: string, filters: { status?: string; limit?: number } = {}) {
  const status = filters.status && Object.values(AIRecommendationStatus).includes(filters.status as AIRecommendationStatus)
    ? filters.status as AIRecommendationStatus
    : undefined;

  return prisma.aIRecommendation.findMany({
    where: {
      hotelId,
      status,
    },
    orderBy: { createdAt: 'desc' },
    take: filters.limit || 100,
    include: {
      createdTask: { select: { id: true, status: true, priority: true, department: true, conversationId: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function getAIRecommendation(hotelId: string, recommendationId: string) {
  const recommendation = await prisma.aIRecommendation.findFirst({
    where: { id: recommendationId, hotelId },
    include: {
      createdTask: { select: { id: true, status: true, priority: true, department: true, conversationId: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!recommendation) throw new Error('AI recommendation not found');
  return recommendation;
}

async function updateRecommendationStatus(
  input: RecommendationActionInput,
  status: AIRecommendationStatus,
  auditAction: string,
  extra?: Record<string, unknown>
) {
  const existing = await getAIRecommendation(input.hotelId, input.recommendationId);
  const updated = await prisma.aIRecommendation.update({
    where: { id: existing.id },
    data: {
      status,
      reviewedById: input.actor?.userId || existing.reviewedById || undefined,
      reviewedAt: new Date(),
      rejectionReason: status === AIRecommendationStatus.REJECTED ? input.rejectionReason : existing.rejectionReason,
    },
    include: {
      createdTask: { select: { id: true, status: true, priority: true, department: true, conversationId: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  await recordAuditEvent({
    hotelId: input.hotelId,
    actor: input.actor,
    action: auditAction,
    entity: 'AI_RECOMMENDATION',
    entityId: updated.id,
    source: 'hotel-brain',
    details: {
      status: updated.status,
      rejectionReason: input.rejectionReason,
      ...extra,
    },
  });

  await eventBus.publish({
    eventType: `ai.recommendation.${status.toLowerCase()}`,
    hotelId: input.hotelId,
    source: 'hotel-brain',
    userId: input.actor?.userId || undefined,
    payload: {
      recommendationId: updated.id,
      title: updated.title,
      status: updated.status,
    },
  });

  return updated;
}

export async function approveAIRecommendation(input: RecommendationActionInput) {
  const updated = await updateRecommendationStatus(input, AIRecommendationStatus.APPROVED, 'AI_RECOMMENDATION_APPROVED');
  if (updated.priority === AIRecommendationPriority.HIGH || updated.priority === AIRecommendationPriority.CRITICAL) {
    await notifyRoles({
      hotelId: input.hotelId,
      roles: [Role.ADMIN, Role.MANAGER],
      channels: ['DASHBOARD'],
      type: 'SYSTEM',
      title: 'AI recommendation approved',
      body: updated.title,
      source: 'hotel-brain',
    });
  }
  return updated;
}

export async function rejectAIRecommendation(input: RecommendationActionInput) {
  if (!input.rejectionReason?.trim()) throw new Error('Rejection reason is required');
  const existing = await getAIRecommendation(input.hotelId, input.recommendationId);
  if (existing.status === AIRecommendationStatus.TASK_CREATED) {
    throw new Error('Cannot reject a recommendation after task creation');
  }
  return updateRecommendationStatus(input, AIRecommendationStatus.REJECTED, 'AI_RECOMMENDATION_REJECTED');
}

export async function expireAIRecommendation(input: RecommendationActionInput) {
  const existing = await getAIRecommendation(input.hotelId, input.recommendationId);
  if (existing.status === AIRecommendationStatus.TASK_CREATED) {
    throw new Error('Cannot expire a recommendation after task creation');
  }
  return updateRecommendationStatus(input, AIRecommendationStatus.EXPIRED, 'AI_RECOMMENDATION_EXPIRED');
}

export async function createTaskFromAIRecommendation(input: RecommendationActionInput) {
  const recommendation = await getAIRecommendation(input.hotelId, input.recommendationId);
  if (recommendation.status === AIRecommendationStatus.REJECTED || recommendation.status === AIRecommendationStatus.EXPIRED) {
    throw new Error('Rejected or expired recommendations cannot create tasks');
  }
  if (recommendation.createdTaskId) {
    return getAIRecommendation(input.hotelId, recommendation.id);
  }

  const task = await createTask({
    hotelId: input.hotelId,
    title: recommendation.title,
    description: `${recommendation.description}\n\nRationale: ${recommendation.rationale}`,
    department: toTaskDepartment(recommendation.department),
    category: toTaskCategory(recommendation.category),
    priority: toTaskPriority(recommendation.priority),
    status: TicketStatus.OPEN,
    sourceKey: `ai-recommendation:${recommendation.id}`,
    details: {
      sourceModule: 'HOTEL_BRAIN',
      sourceType: recommendation.sourceType,
      sourceId: recommendation.sourceId,
      recommendationId: recommendation.id,
      confidence: recommendation.confidence,
    },
    actor: input.actor,
    source: 'hotel-brain',
    idempotencyKey: `ai-recommendation-task:${recommendation.id}`,
  });

  const updated = await prisma.aIRecommendation.update({
    where: { id: recommendation.id },
    data: {
      status: AIRecommendationStatus.TASK_CREATED,
      createdTaskId: task.id,
      reviewedById: input.actor?.userId || recommendation.reviewedById || undefined,
      reviewedAt: new Date(),
    },
    include: {
      createdTask: { select: { id: true, status: true, priority: true, department: true, conversationId: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  await recordAuditEvent({
    hotelId: input.hotelId,
    actor: input.actor,
    action: 'AI_RECOMMENDATION_TASK_CREATED',
    entity: 'AI_RECOMMENDATION',
    entityId: updated.id,
    source: 'hotel-brain',
    details: { taskId: task.id },
  });

  await eventBus.publish({
    eventType: 'ai.recommendation.task_created',
    hotelId: input.hotelId,
    source: 'hotel-brain',
    userId: input.actor?.userId || undefined,
    payload: {
      recommendationId: updated.id,
      taskId: task.id,
      title: updated.title,
    },
  });

  return updated;
}

export const AIRecommendationGovernanceService = {
  persistAIRecommendations,
  listAIRecommendations,
  getAIRecommendation,
  approveAIRecommendation,
  rejectAIRecommendation,
  expireAIRecommendation,
  createTaskFromAIRecommendation,
};
