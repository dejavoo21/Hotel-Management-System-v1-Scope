import { Department, HousekeepingStatus, TicketCategory, TicketPriority, TicketStatus, type NotificationType } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { eventBus, type PlatformEvent } from '../event-bus/eventBus.service.js';
import { createTask } from '../tasks/taskEngine.service.js';
import { notifyRoles, type NotificationChannel } from '../notifications/notificationEngine.service.js';
import { recordAuditEvent } from '../audit/auditEngine.service.js';
import { logger } from '../../config/logger.js';

export type WorkflowTrigger = {
  eventTypes: string[];
};

export type WorkflowCondition =
  | { type: 'ALWAYS' }
  | { type: 'SOURCE_EQUALS'; value: string }
  | { type: 'PAYLOAD_EQUALS'; path: string; value: unknown }
  | { type: 'PAYLOAD_IN'; path: string; values: unknown[] }
  | { type: 'EVENT_TYPE_IN'; values: string[] };

export type WorkflowAction =
  | {
      type: 'CREATE_TASK';
      title: string;
      description?: string;
      department?: Department;
      category?: TicketCategory;
      priority?: TicketPriority;
      linkedEntityType?: string;
      linkedEntityIdPath?: string;
      dueDate?: 'SAME_DAY';
      sourceKey?: string;
      sourceModule?: string;
      duplicateKey?: string;
      duplicateWindowMinutes?: number;
      status?: TicketStatus;
    }
  | {
      type: 'UPDATE_ROOM_HOUSEKEEPING_STATUS';
      roomIdPath: string;
      status: HousekeepingStatus;
    }
  | {
      type: 'NOTIFY_ROLES';
      roles: string[];
      channels: NotificationChannel[];
      title: string;
      body: string;
      notificationType?: NotificationType;
    }
  | {
      type: 'AUDIT';
      action: string;
      entity: string;
      entityIdPath?: string;
    }
  | {
      type: 'PUBLISH_EVENT';
      eventType: string;
      payload?: Record<string, unknown>;
    };

export type WorkflowEscalation = {
  delayMs: number;
  actions: WorkflowAction[];
};

export type WorkflowCompletion = {
  eventType?: string;
  auditAction?: string;
};

export type WorkflowDefinition = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  escalation?: WorkflowEscalation;
  completion?: WorkflowCompletion;
};

export type WorkflowExecutionResult = {
  workflowId: string;
  workflowName: string;
  eventId: string;
  status: 'SKIPPED' | 'COMPLETED' | 'FAILED';
  actionsRun: number;
  reason?: string;
};

function payloadRecord(event: PlatformEvent): Record<string, unknown> {
  return event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
    ? (event.payload as Record<string, unknown>)
    : {};
}

function getPathValue(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

function interpolate(template: string, event: PlatformEvent) {
  const payload = payloadRecord(event);
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    if (key === 'eventType') return event.metadata.eventType;
    if (key === 'eventId') return event.metadata.eventId;
    if (key === 'hotelId') return event.metadata.hotelId;
    const value = getPathValue(payload, key);
    return value === undefined || value === null ? '' : String(value);
  });
}

function entityIdForAction(action: WorkflowAction, event: PlatformEvent) {
  if (action.type === 'AUDIT' && action.entityIdPath) {
    const value = getPathValue(payloadRecord(event), action.entityIdPath);
    return value === undefined || value === null ? undefined : String(value);
  }
  const payload = payloadRecord(event);
  return (
    getPathValue(payload, 'bookingId') ||
    getPathValue(payload, 'taskId') ||
    getPathValue(payload, 'alertId') ||
    getPathValue(payload, 'roomId') ||
    getPathValue(payload, 'resultId') ||
    event.metadata.eventId
  ) as string;
}

function matchesCondition(condition: WorkflowCondition, event: PlatformEvent) {
  const payload = payloadRecord(event);
  if (condition.type === 'ALWAYS') return true;
  if (condition.type === 'SOURCE_EQUALS') return event.metadata.source === condition.value;
  if (condition.type === 'EVENT_TYPE_IN') return condition.values.includes(event.metadata.eventType);
  if (condition.type === 'PAYLOAD_EQUALS') return getPathValue(payload, condition.path) === condition.value;
  if (condition.type === 'PAYLOAD_IN') return condition.values.includes(getPathValue(payload, condition.path));
  return false;
}

function shouldRunWorkflow(definition: WorkflowDefinition, event: PlatformEvent) {
  if (!definition.enabled) return false;
  if (!definition.trigger.eventTypes.includes(event.metadata.eventType)) return false;
  return definition.conditions.every((condition) => matchesCondition(condition, event));
}

async function runWorkflowAction(definition: WorkflowDefinition, action: WorkflowAction, event: PlatformEvent) {
  const payload = payloadRecord(event);
  const correlationId = event.metadata.correlationId;
  const idempotencyKey = `${definition.id}:${event.metadata.eventId}:${action.type}`;

  if (action.type === 'CREATE_TASK') {
    const linkedEntityId = action.linkedEntityIdPath
      ? String(getPathValue(payload, action.linkedEntityIdPath) || '')
      : undefined;
    const dueDate = action.dueDate === 'SAME_DAY' ? endOfToday() : undefined;
    const duplicateKey = action.duplicateKey ? interpolate(action.duplicateKey, event) : undefined;

    if (duplicateKey && action.duplicateWindowMinutes) {
      const duplicateCutoff = new Date(Date.now() - action.duplicateWindowMinutes * 60 * 1000);
      const existingOpenTask = await prisma.ticket.findFirst({
        where: {
          hotelId: event.metadata.hotelId,
          status: { in: ['OPEN', 'PENDING', 'IN_PROGRESS', 'BREACHED'] },
          createdAtUtc: { gte: duplicateCutoff },
          details: { path: ['duplicateKey'], equals: duplicateKey },
        },
      });

      if (existingOpenTask) {
        logger.info('Workflow task skipped because duplicate open task exists', {
          workflowId: definition.id,
          eventId: event.metadata.eventId,
          duplicateKey,
          existingTaskId: existingOpenTask.id,
        });
        return;
      }
    }

    await createTask({
      hotelId: event.metadata.hotelId,
      title: interpolate(action.title, event).slice(0, 120),
      description: action.description ? interpolate(action.description, event) : undefined,
      department: action.department || Department.MANAGEMENT,
      category: action.category || TicketCategory.OTHER,
      priority: action.priority || TicketPriority.MEDIUM,
      status: action.status,
      dueDate,
      sourceKey: action.sourceKey ? interpolate(action.sourceKey, event) : undefined,
      details: {
        workflowId: definition.id,
        sourceModule: action.sourceModule,
        duplicateKey,
        duplicateWindowMinutes: action.duplicateWindowMinutes,
        linkedEntityType: action.linkedEntityType,
        linkedEntityId,
        dueDate: dueDate?.toISOString(),
        sourceEventId: event.metadata.eventId,
        sourceEventType: event.metadata.eventType,
        sourcePayload: payload,
      },
      actor: { userId: event.metadata.userId },
      source: 'workflow-engine',
      correlationId,
      idempotencyKey,
    });
    return;
  }

  if (action.type === 'UPDATE_ROOM_HOUSEKEEPING_STATUS') {
    const roomId = String(getPathValue(payload, action.roomIdPath) || '');
    if (!roomId) throw new Error(`Workflow ${definition.id} missing room id at ${action.roomIdPath}`);
    const room = await prisma.room.findFirst({
      where: { id: roomId, hotelId: event.metadata.hotelId },
      select: { id: true, number: true, housekeepingStatus: true },
    });
    if (!room) throw new Error(`Workflow ${definition.id} room not found: ${roomId}`);

    if (room.housekeepingStatus !== action.status) {
      await prisma.room.update({
        where: { id: room.id },
        data: { housekeepingStatus: action.status },
      });
    }

    await eventBus.publish({
      eventType: 'room.housekeeping_status_updated',
      hotelId: event.metadata.hotelId,
      source: 'workflow-engine',
      correlationId,
      causationId: event.metadata.eventId,
      idempotencyKey,
      userId: event.metadata.userId,
      payload: {
        roomId: room.id,
        location: `Room ${room.number}`,
        status: action.status,
        summary: `Room ${room.number} marked ${action.status.replace(/_/g, ' ')}`,
      },
    });
    return;
  }

  if (action.type === 'NOTIFY_ROLES') {
    await notifyRoles({
      hotelId: event.metadata.hotelId,
      roles: action.roles,
      channels: action.channels,
      type: action.notificationType || 'SYSTEM',
      title: interpolate(action.title, event),
      body: interpolate(action.body, event),
      source: 'workflow-engine',
      correlationId,
      idempotencyKey,
    });
    return;
  }

  if (action.type === 'AUDIT') {
    await recordAuditEvent({
      hotelId: event.metadata.hotelId,
      actor: { userId: event.metadata.userId },
      action: action.action,
      entity: action.entity,
      entityId: entityIdForAction(action, event),
      details: {
        workflowId: definition.id,
        sourceEventId: event.metadata.eventId,
        sourceEventType: event.metadata.eventType,
      },
      source: 'workflow-engine',
      correlationId,
      idempotencyKey,
    });
    return;
  }

  if (action.type === 'PUBLISH_EVENT') {
    await eventBus.publish({
      eventType: action.eventType,
      hotelId: event.metadata.hotelId,
      source: 'workflow-engine',
      correlationId,
      causationId: event.metadata.eventId,
      idempotencyKey,
      userId: event.metadata.userId,
      payload: {
        workflowId: definition.id,
        workflowName: definition.name,
        sourceEventId: event.metadata.eventId,
        sourceEventType: event.metadata.eventType,
        ...(action.payload || {}),
      },
    });
  }
}

export async function runWorkflow(definition: WorkflowDefinition, event: PlatformEvent): Promise<WorkflowExecutionResult> {
  if (!shouldRunWorkflow(definition, event)) {
    return {
      workflowId: definition.id,
      workflowName: definition.name,
      eventId: event.metadata.eventId,
      status: 'SKIPPED',
      actionsRun: 0,
      reason: 'trigger_or_conditions_not_matched',
    };
  }

  try {
    for (const action of definition.actions) {
      await runWorkflowAction(definition, action, event);
    }

    if (definition.completion?.auditAction) {
      await recordAuditEvent({
        hotelId: event.metadata.hotelId,
        actor: { userId: event.metadata.userId },
        action: definition.completion.auditAction,
        entity: 'workflow',
        entityId: definition.id,
        details: { sourceEventId: event.metadata.eventId, sourceEventType: event.metadata.eventType },
        source: 'workflow-engine',
        correlationId: event.metadata.correlationId,
        idempotencyKey: `${definition.id}:${event.metadata.eventId}:completion-audit`,
      });
    }

    if (definition.completion?.eventType) {
      await eventBus.publish({
        eventType: definition.completion.eventType,
        hotelId: event.metadata.hotelId,
        source: 'workflow-engine',
        correlationId: event.metadata.correlationId,
        causationId: event.metadata.eventId,
        idempotencyKey: `${definition.id}:${event.metadata.eventId}:completion-event`,
        userId: event.metadata.userId,
        payload: {
          workflowId: definition.id,
          workflowName: definition.name,
          sourceEventId: event.metadata.eventId,
          status: 'COMPLETED',
          summary: `${definition.name} completed`,
        },
      });
    }

    if (definition.escalation) {
      scheduleEscalation(definition, event);
    }

    return {
      workflowId: definition.id,
      workflowName: definition.name,
      eventId: event.metadata.eventId,
      status: 'COMPLETED',
      actionsRun: definition.actions.length,
    };
  } catch (error) {
    logger.error('Workflow execution failed', {
      workflowId: definition.id,
      eventId: event.metadata.eventId,
      error,
    });
    return {
      workflowId: definition.id,
      workflowName: definition.name,
      eventId: event.metadata.eventId,
      status: 'FAILED',
      actionsRun: 0,
      reason: error instanceof Error ? error.message : 'unknown_error',
    };
  }
}

function scheduleEscalation(definition: WorkflowDefinition, event: PlatformEvent) {
  if (!definition.escalation) return;
  const escalation = definition.escalation;
  setTimeout(() => {
    Promise.all(escalation.actions.map((action) => runWorkflowAction(definition, action, event))).catch((error) => {
      logger.error('Workflow escalation failed', {
        workflowId: definition.id,
        eventId: event.metadata.eventId,
        error,
      });
    });
  }, escalation.delayMs);
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}
