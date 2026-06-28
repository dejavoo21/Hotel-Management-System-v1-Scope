import { Department, type Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';

type SmartBuildingTaskScope = 'all' | 'maintenance' | 'security';

type RecordValue = Record<string, unknown>;

function asRecord(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordValue) : {};
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function smartBuildingTaskWhere(hotelId: string, scope: SmartBuildingTaskScope): Prisma.TicketWhereInput {
  const where: Prisma.TicketWhereInput = {
    hotelId,
    details: { path: ['sourceModule'], equals: 'SMART_BUILDING' },
  };

  if (scope === 'maintenance') {
    where.department = Department.MAINTENANCE;
  }

  if (scope === 'security') {
    where.department = Department.MANAGEMENT;
    where.details = {
      path: ['workflowId'],
      in: ['smart-building-door-forced-open', 'smart-building-camera-offline', 'smart-building-panic-button'],
    } as Prisma.JsonFilter<'Ticket'>;
  }

  return where;
}

function mapSmartBuildingTask(ticket: Awaited<ReturnType<typeof fetchSmartBuildingTasks>>[number]) {
  const details = asRecord(ticket.details);
  const sourcePayload = asRecord(details.sourcePayload);
  const firstMessage = ticket.conversation.messages[0];

  return {
    id: ticket.id,
    title: ticket.conversation.subject || ticket.category,
    description: firstMessage?.body || stringValue(sourcePayload.summary) || null,
    department: ticket.department,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    sourceModule: stringValue(details.sourceModule) || 'SMART_BUILDING',
    workflowId: stringValue(details.workflowId) || null,
    sourceSignal: stringValue(sourcePayload.signal) || null,
    eventType: stringValue(sourcePayload.smartBuildingEventType) || stringValue(details.sourceEventType) || null,
    linkedEntityType: stringValue(details.linkedEntityType) || stringValue(sourcePayload.linkedEntityType) || null,
    linkedEntityId: stringValue(details.linkedEntityId) || stringValue(sourcePayload.linkedEntityId) || null,
    deviceExternalId: stringValue(sourcePayload.deviceExternalId) || stringValue(sourcePayload.externalId) || null,
    location: stringValue(sourcePayload.location) || null,
    sourceSummary: stringValue(sourcePayload.summary) || null,
    dueAt: ticket.resolutionDueAtUtc,
    createdAt: ticket.createdAtUtc,
    updatedAt: ticket.updatedAtUtc,
  };
}

async function fetchSmartBuildingTasks(hotelId: string, scope: SmartBuildingTaskScope) {
  return prisma.ticket.findMany({
    where: smartBuildingTaskWhere(hotelId, scope),
    include: {
      conversation: {
        select: {
          subject: true,
          messages: {
            select: { body: true },
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAtUtc: 'desc' }],
    take: 100,
  });
}

export async function listSmartBuildingWorkflowTasks(hotelId: string, scope: SmartBuildingTaskScope = 'all') {
  const tasks = await fetchSmartBuildingTasks(hotelId, scope);
  return tasks.map(mapSmartBuildingTask);
}

export async function getSmartBuildingWorkflowTaskSummary(hotelId: string) {
  const [maintenance, security, criticalOpen] = await Promise.all([
    prisma.ticket.count({ where: smartBuildingTaskWhere(hotelId, 'maintenance') }),
    prisma.ticket.count({ where: smartBuildingTaskWhere(hotelId, 'security') }),
    prisma.ticket.count({
      where: {
        ...smartBuildingTaskWhere(hotelId, 'all'),
        priority: 'URGENT',
        status: { in: ['OPEN', 'PENDING', 'IN_PROGRESS', 'BREACHED'] },
      },
    }),
  ]);

  return { maintenance, security, criticalOpen };
}
