import { AIRecommendationStatus } from '@prisma/client';
import { eventBus } from '../../platform/event-bus/eventBus.service.js';
import { recordAuditEvent } from '../../platform/audit/auditEngine.service.js';
import {
  createTaskFromAIRecommendation,
  getAIRecommendation,
} from '../recommendations/index.js';
import type {
  AIActionExecutionInput,
  AIActionExecutionPreview,
} from './aiActionExecution.types.js';

export async function previewAIActionExecution(input: AIActionExecutionInput): Promise<AIActionExecutionPreview> {
  const recommendation = await getAIRecommendation(input.hotelId, input.recommendationId);
  const approved = recommendation.status === AIRecommendationStatus.APPROVED || recommendation.status === AIRecommendationStatus.TASK_CREATED;
  const existingTaskId = recommendation.createdTaskId || null;

  if (existingTaskId) {
    return {
      recommendationId: recommendation.id,
      actionType: input.actionType || 'CREATE_TASK',
      approved,
      executable: false,
      existingTaskId,
      reason: 'Recommendation already has a linked task.',
    };
  }

  if (recommendation.status !== AIRecommendationStatus.APPROVED) {
    return {
      recommendationId: recommendation.id,
      actionType: input.actionType || 'CREATE_TASK',
      approved: false,
      executable: false,
      existingTaskId,
      reason: `Recommendation must be APPROVED before execution. Current status: ${recommendation.status}.`,
    };
  }

  return {
    recommendationId: recommendation.id,
    actionType: input.actionType || 'CREATE_TASK',
    approved,
    executable: true,
    existingTaskId,
  };
}

export async function executeAIRecommendationAction(input: AIActionExecutionInput) {
  const actionType = input.actionType || 'CREATE_TASK';
  if (actionType !== 'CREATE_TASK') {
    throw new Error(`Unsupported AI action type: ${actionType}`);
  }

  const preview = await previewAIActionExecution(input);
  await recordAuditEvent({
    hotelId: input.hotelId,
    actor: input.actor,
    action: 'AI_ACTION_EXECUTION_REQUESTED',
    entity: 'AI_RECOMMENDATION',
    entityId: input.recommendationId,
    source: 'hotel-brain',
    details: {
      actionType,
      executable: preview.executable,
      reason: preview.reason,
      existingTaskId: preview.existingTaskId,
    },
  });

  await eventBus.publish({
    eventType: 'ai.action.execution_requested',
    hotelId: input.hotelId,
    source: 'hotel-brain',
    userId: input.actor?.userId || undefined,
    payload: {
      recommendationId: input.recommendationId,
      actionType,
      executable: preview.executable,
      reason: preview.reason,
    },
  });

  if (!preview.executable) {
    await recordAuditEvent({
      hotelId: input.hotelId,
      actor: input.actor,
      action: 'AI_ACTION_EXECUTION_BLOCKED',
      entity: 'AI_RECOMMENDATION',
      entityId: input.recommendationId,
      source: 'hotel-brain',
      details: {
        actionType,
        reason: preview.reason,
        existingTaskId: preview.existingTaskId,
      },
    });

    await eventBus.publish({
      eventType: 'ai.action.execution_blocked',
      hotelId: input.hotelId,
      source: 'hotel-brain',
      userId: input.actor?.userId || undefined,
      payload: {
        recommendationId: input.recommendationId,
        actionType,
        reason: preview.reason,
        existingTaskId: preview.existingTaskId,
      },
    });

    if (preview.existingTaskId) {
      return getAIRecommendation(input.hotelId, input.recommendationId);
    }
    throw new Error(preview.reason || 'AI action execution is not allowed');
  }

  try {
    const result = await createTaskFromAIRecommendation(input);
    await recordAuditEvent({
      hotelId: input.hotelId,
      actor: input.actor,
      action: 'AI_ACTION_EXECUTION_COMPLETED',
      entity: 'AI_RECOMMENDATION',
      entityId: input.recommendationId,
      source: 'hotel-brain',
      details: {
        actionType,
        taskId: result.createdTaskId,
      },
    });

    await eventBus.publish({
      eventType: 'ai.action.execution_completed',
      hotelId: input.hotelId,
      source: 'hotel-brain',
      userId: input.actor?.userId || undefined,
      payload: {
        recommendationId: input.recommendationId,
        actionType,
        taskId: result.createdTaskId,
      },
    });

    return result;
  } catch (error) {
    await recordAuditEvent({
      hotelId: input.hotelId,
      actor: input.actor,
      action: 'AI_ACTION_EXECUTION_FAILED',
      entity: 'AI_RECOMMENDATION',
      entityId: input.recommendationId,
      source: 'hotel-brain',
      details: {
        actionType,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    throw error;
  }
}

export const AIActionExecutionService = {
  previewAIActionExecution,
  executeAIRecommendationAction,
};
