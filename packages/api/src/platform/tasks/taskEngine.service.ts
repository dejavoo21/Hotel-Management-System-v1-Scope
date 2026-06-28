import {
  Department,
  MessageSender,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TicketType,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../../config/database.js';
import { eventBus } from '../event-bus/eventBus.service.js';
import { recordAuditEvent, type AuditActor } from '../audit/auditEngine.service.js';
import { notifyUser } from '../notifications/notificationEngine.service.js';

type TaskDetails = Record<string, unknown>;

export type CreateTaskInput = {
  hotelId: string;
  title: string;
  description?: string;
  type?: TicketType;
  category?: TicketCategory;
  department?: Department;
  priority?: TicketPriority;
  status?: TicketStatus;
  assignedToId?: string | null;
  dueDate?: Date;
  sourceKey?: string | null;
  details?: TaskDetails;
  actor?: AuditActor;
  source?: string;
  correlationId?: string;
  idempotencyKey?: string;
};

export type TaskMutationInput = {
  hotelId: string;
  taskId: string;
  actor?: AuditActor;
  source?: string;
  correlationId?: string;
};

function mergeDetails(existing: unknown, next: TaskDetails): Prisma.InputJsonValue {
  return {
    ...(existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}),
    ...next,
  } as Prisma.InputJsonObject;
}

async function getTaskForHotel(taskId: string, hotelId: string) {
  const task = await prisma.ticket.findFirst({
    where: { id: taskId, hotelId },
    include: {
      conversation: true,
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  return task;
}

export async function createTask(input: CreateTaskInput) {
  if (input.sourceKey) {
    const existing = await prisma.ticket.findFirst({
      where: { hotelId: input.hotelId, sourceKey: input.sourceKey },
    });
    if (existing) return existing;
  }

  const created = await prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.create({
      data: {
        hotelId: input.hotelId,
        subject: input.title.slice(0, 120),
        status: 'OPEN',
        lastMessageAt: new Date(),
      },
    });

    if (input.description) {
      await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderType: MessageSender.SYSTEM,
          senderUserId: input.actor?.userId || undefined,
          body: input.description.slice(0, 5000),
        },
      });
    }

    const task = await tx.ticket.create({
      data: {
        hotelId: input.hotelId,
        conversationId: conversation.id,
        type: input.type || TicketType.GENERAL_INQUIRY,
        category: input.category || TicketCategory.OTHER,
        department: input.department || Department.MANAGEMENT,
        priority: input.priority || TicketPriority.MEDIUM,
        status: input.status || TicketStatus.OPEN,
        assignedToId: input.assignedToId || undefined,
        resolutionDueAtUtc: input.dueDate,
        sourceKey: input.sourceKey || undefined,
        details: mergeDetails(input.details, {
          taskEngine: true,
          source: input.source || 'task-engine',
          correlationId: input.correlationId,
          idempotencyKey: input.idempotencyKey,
        }),
      },
    });

    await recordAuditEvent(
      {
        hotelId: input.hotelId,
        actor: input.actor,
        action: 'TASK_CREATED',
        entity: 'ticket',
        entityId: task.id,
        details: {
          ...(input.details || {}),
          title: input.title,
          department: task.department,
          priority: task.priority,
          assignedToId: task.assignedToId,
          conversationId: conversation.id,
        },
        source: input.source || 'task-engine',
        correlationId: input.correlationId,
        idempotencyKey: input.idempotencyKey,
      },
      tx
    );

    return { task, conversation };
  });

  await eventBus.publish({
    eventType: 'task.created',
    hotelId: input.hotelId,
    source: input.source || 'task-engine',
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
    userId: input.actor?.userId || undefined,
    payload: {
      taskId: created.task.id,
      conversationId: created.conversation.id,
      title: input.title,
      summary: input.description || input.title,
      department: created.task.department,
      priority: created.task.priority,
      status: created.task.status,
      sourceModule: input.details?.sourceModule,
      location:
        input.details?.sourcePayload && typeof input.details.sourcePayload === 'object' && !Array.isArray(input.details.sourcePayload)
          ? (input.details.sourcePayload as Record<string, unknown>).location
          : undefined,
      linkedEntityType: input.details?.linkedEntityType,
      linkedEntityId: input.details?.linkedEntityId,
    },
  });

  if (created.task.assignedToId) {
    await notifyUser({
      hotelId: input.hotelId,
      userId: created.task.assignedToId,
      channels: ['DASHBOARD'],
      type: 'TICKET_ASSIGNED',
      title: 'Task Assigned',
      body: input.title,
      ticketId: created.task.id,
      conversationId: created.conversation.id,
      source: input.source || 'task-engine',
      correlationId: input.correlationId,
    });
  }

  return created.task;
}

export async function assignTask(input: TaskMutationInput & { assignedToId: string }) {
  const task = await getTaskForHotel(input.taskId, input.hotelId);
  const updated = await prisma.ticket.update({
    where: { id: task.id },
    data: {
      assignedToId: input.assignedToId,
      status: task.status === TicketStatus.OPEN ? TicketStatus.IN_PROGRESS : task.status,
    },
  });

  await recordAuditEvent({
    hotelId: input.hotelId,
    actor: input.actor,
    action: 'TASK_ASSIGNED',
    entity: 'ticket',
    entityId: task.id,
    details: { assignedToId: input.assignedToId },
    source: input.source || 'task-engine',
    correlationId: input.correlationId,
  });

  await notifyUser({
    hotelId: input.hotelId,
    userId: input.assignedToId,
    channels: ['DASHBOARD'],
    type: 'TICKET_ASSIGNED',
    title: 'Task Assigned',
    body: task.conversation.subject || 'You have been assigned a task.',
    ticketId: task.id,
    conversationId: task.conversationId,
    source: input.source || 'task-engine',
    correlationId: input.correlationId,
  });

  await eventBus.publish({
    eventType: 'task.assigned',
    hotelId: input.hotelId,
    source: input.source || 'task-engine',
    correlationId: input.correlationId,
    userId: input.actor?.userId || undefined,
    payload: { taskId: task.id, assignedToId: input.assignedToId },
  });

  return updated;
}

export async function completeTask(input: TaskMutationInput & { resolutionNote?: string }) {
  const task = await getTaskForHotel(input.taskId, input.hotelId);
  const updated = await prisma.ticket.update({
    where: { id: task.id },
    data: {
      status: TicketStatus.RESOLVED,
      resolvedAtUtc: new Date(),
    },
  });

  if (input.resolutionNote) {
    await addTaskComment({
      ...input,
      body: input.resolutionNote,
      senderType: MessageSender.STAFF,
    });
  }

  await recordAuditEvent({
    hotelId: input.hotelId,
    actor: input.actor,
    action: 'TASK_COMPLETED',
    entity: 'ticket',
    entityId: task.id,
    source: input.source || 'task-engine',
    correlationId: input.correlationId,
  });

  await eventBus.publish({
    eventType: 'task.completed',
    hotelId: input.hotelId,
    source: input.source || 'task-engine',
    correlationId: input.correlationId,
    userId: input.actor?.userId || undefined,
    payload: { taskId: task.id },
  });

  return updated;
}

export async function reopenTask(input: TaskMutationInput & { reason?: string }) {
  const task = await getTaskForHotel(input.taskId, input.hotelId);
  const updated = await prisma.ticket.update({
    where: { id: task.id },
    data: {
      status: TicketStatus.OPEN,
      resolvedAtUtc: null,
    },
  });

  if (input.reason) {
    await addTaskComment({
      ...input,
      body: input.reason,
      senderType: MessageSender.STAFF,
    });
  }

  await recordAuditEvent({
    hotelId: input.hotelId,
    actor: input.actor,
    action: 'TASK_REOPENED',
    entity: 'ticket',
    entityId: task.id,
    source: input.source || 'task-engine',
    correlationId: input.correlationId,
  });

  await eventBus.publish({
    eventType: 'task.reopened',
    hotelId: input.hotelId,
    source: input.source || 'task-engine',
    correlationId: input.correlationId,
    userId: input.actor?.userId || undefined,
    payload: { taskId: task.id },
  });

  return updated;
}

export async function escalateTask(input: TaskMutationInput & { reason?: string }) {
  const task = await getTaskForHotel(input.taskId, input.hotelId);
  const updated = await prisma.ticket.update({
    where: { id: task.id },
    data: {
      escalatedLevel: { increment: 1 },
      lastEscalationAtUtc: new Date(),
      priority: task.priority === TicketPriority.URGENT ? TicketPriority.URGENT : TicketPriority.HIGH,
    },
  });

  if (input.reason) {
    await addTaskComment({
      ...input,
      body: input.reason,
      senderType: MessageSender.SYSTEM,
    });
  }

  await recordAuditEvent({
    hotelId: input.hotelId,
    actor: input.actor,
    action: 'TASK_ESCALATED',
    entity: 'ticket',
    entityId: task.id,
    details: { previousEscalatedLevel: task.escalatedLevel },
    source: input.source || 'task-engine',
    correlationId: input.correlationId,
  });

  await eventBus.publish({
    eventType: 'task.escalated',
    hotelId: input.hotelId,
    source: input.source || 'task-engine',
    correlationId: input.correlationId,
    userId: input.actor?.userId || undefined,
    payload: { taskId: task.id, escalatedLevel: updated.escalatedLevel },
  });

  return updated;
}

export async function addTaskComment(
  input: TaskMutationInput & {
    body: string;
    senderType?: MessageSender;
    attachments?: Prisma.InputJsonValue;
  }
) {
  const task = await getTaskForHotel(input.taskId, input.hotelId);
  const message = await prisma.message.create({
    data: {
      conversationId: task.conversationId,
      senderType: input.senderType || MessageSender.STAFF,
      senderUserId: input.actor?.userId || undefined,
      body: input.body,
      attachments: input.attachments,
    },
  });

  await prisma.conversation.update({
    where: { id: task.conversationId },
    data: { lastMessageAt: new Date() },
  });

  await recordAuditEvent({
    hotelId: input.hotelId,
    actor: input.actor,
    action: 'TASK_COMMENT_ADDED',
    entity: 'ticket',
    entityId: task.id,
    details: { messageId: message.id, hasAttachments: Boolean(input.attachments) },
    source: input.source || 'task-engine',
    correlationId: input.correlationId,
  });

  await eventBus.publish({
    eventType: 'task.comment_added',
    hotelId: input.hotelId,
    source: input.source || 'task-engine',
    correlationId: input.correlationId,
    userId: input.actor?.userId || undefined,
    payload: { taskId: task.id, messageId: message.id },
  });

  return message;
}

export async function addTaskAttachment(
  input: TaskMutationInput & {
    filename: string;
    url: string;
    contentType?: string;
    sizeBytes?: number;
    note?: string;
  }
) {
  return addTaskComment({
    ...input,
    body: input.note || `Attachment added: ${input.filename}`,
    attachments: [
      {
        filename: input.filename,
        url: input.url,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
      },
    ],
  });
}

export async function getTaskAuditHistory(input: { hotelId: string; taskId: string; limit?: number }) {
  await getTaskForHotel(input.taskId, input.hotelId);
  return prisma.activityLog.findMany({
    where: {
      entity: 'ticket',
      entityId: input.taskId,
    },
    orderBy: { createdAt: 'desc' },
    take: input.limit || 100,
  });
}
