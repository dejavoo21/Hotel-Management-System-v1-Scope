import {
  Department,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../../config/database.js';
import { eventBus, type PlatformEvent } from '../../platform/event-bus/eventBus.service.js';
import { createTask } from '../../platform/tasks/taskEngine.service.js';
import { notifyRoles } from '../../platform/notifications/notificationEngine.service.js';
import { recordAuditEvent, type AuditActor } from '../../platform/audit/auditEngine.service.js';
import { logger } from '../../config/logger.js';

export type CreateIncidentInput = {
  hotelId: string;
  title: string;
  description?: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status?: IncidentStatus;
  sourceModule: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  createdById?: string | null;
  assignedManagerId?: string | null;
  startedAt?: Date;
  metadata?: Prisma.InputJsonValue;
  actor?: AuditActor;
  correlationId?: string;
};

export type UpdateIncidentInput = Partial<{
  title: string;
  description: string | null;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  assignedManagerId: string | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  metadata: Prisma.InputJsonValue;
}>;

const activeIncidentStatuses: IncidentStatus[] = [
  IncidentStatus.NEW,
  IncidentStatus.ACKNOWLEDGED,
  IncidentStatus.INVESTIGATING,
  IncidentStatus.IN_PROGRESS,
];

function payloadRecord(event: PlatformEvent): Record<string, unknown> {
  return event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
    ? (event.payload as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function taskPriorityForSeverity(severity: IncidentSeverity): TicketPriority {
  if (severity === IncidentSeverity.CRITICAL) return TicketPriority.URGENT;
  if (severity === IncidentSeverity.HIGH) return TicketPriority.HIGH;
  if (severity === IncidentSeverity.LOW) return TicketPriority.LOW;
  return TicketPriority.MEDIUM;
}

function categoryForSmartBuildingSignal(signal?: string): IncidentCategory {
  if (signal === 'WATER_LEAK' || signal === 'HVAC_ALERT' || signal === 'SENSOR_OFFLINE') return IncidentCategory.MAINTENANCE;
  if (signal === 'DOOR_FORCED' || signal === 'CAMERA_OFFLINE' || signal === 'PANIC_BUTTON') return IncidentCategory.SECURITY;
  return IncidentCategory.SMART_BUILDING;
}

function departmentForIncident(category: IncidentCategory): Department {
  if (category === IncidentCategory.MAINTENANCE) return Department.MAINTENANCE;
  if (category === IncidentCategory.HOUSEKEEPING) return Department.HOUSEKEEPING;
  if (category === IncidentCategory.GUEST) return Department.FRONT_DESK;
  return Department.MANAGEMENT;
}

function ticketCategoryForIncident(category: IncidentCategory): TicketCategory {
  if (category === IncidentCategory.MAINTENANCE) return TicketCategory.MAINTENANCE;
  if (category === IncidentCategory.HOUSEKEEPING) return TicketCategory.HOUSEKEEPING;
  if (category === IncidentCategory.GUEST) return TicketCategory.OTHER;
  return TicketCategory.OTHER;
}

async function nextIncidentNumber(hotelId: string) {
  const count = await prisma.incident.count({ where: { hotelId } });
  return `INC-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
}

function includeIncidentRelations() {
  return {
    createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    assignedManager: { select: { id: true, firstName: true, lastName: true, email: true } },
    tasks: {
      include: {
        ticket: {
          include: {
            conversation: {
              select: {
                subject: true,
                messages: { select: { body: true, createdAt: true }, orderBy: { createdAt: 'asc' as const }, take: 1 },
              },
            },
          },
        },
      },
    },
    comments: {
      include: { author: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' as const },
      take: 50,
    },
    attachments: { orderBy: { createdAt: 'desc' as const }, take: 50 },
  };
}

export async function getIncidentOverview(hotelId: string) {
  const [active, critical, resolved, closed, all, byCategory, bySource] = await Promise.all([
    prisma.incident.count({ where: { hotelId, status: { in: activeIncidentStatuses } } }),
    prisma.incident.count({ where: { hotelId, severity: IncidentSeverity.CRITICAL, status: { in: activeIncidentStatuses } } }),
    prisma.incident.findMany({
      where: { hotelId, resolvedAt: { not: null } },
      select: { startedAt: true, resolvedAt: true },
      take: 100,
      orderBy: { resolvedAt: 'desc' },
    }),
    prisma.incident.count({ where: { hotelId, status: IncidentStatus.CLOSED } }),
    prisma.incident.count({ where: { hotelId } }),
    prisma.incident.groupBy({ by: ['category'], where: { hotelId }, _count: { _all: true } }),
    prisma.incident.groupBy({ by: ['sourceModule'], where: { hotelId }, _count: { _all: true } }),
  ]);

  const averageResolutionMinutes =
    resolved.length === 0
      ? 0
      : Math.round(
          resolved.reduce((sum, incident) => {
            const resolvedAt = incident.resolvedAt ? incident.resolvedAt.getTime() : Date.now();
            return sum + Math.max(0, resolvedAt - incident.startedAt.getTime());
          }, 0) /
            resolved.length /
            60000
        );

  return {
    active,
    critical,
    resolved: resolved.length,
    closed,
    total: all,
    averageResolutionMinutes,
    byDepartment: byCategory.map((item) => ({ department: item.category, count: item._count._all })),
    bySourceModule: bySource.map((item) => ({ sourceModule: item.sourceModule, count: item._count._all })),
  };
}

export async function listIncidents(
  hotelId: string,
  filters: { view?: string; assignedToId?: string; status?: IncidentStatus; severity?: IncidentSeverity } = {}
) {
  const where: Prisma.IncidentWhereInput = { hotelId };
  if (filters.status) where.status = filters.status;
  if (filters.severity) where.severity = filters.severity;
  if (filters.view === 'active') where.status = { in: activeIncidentStatuses };
  if (filters.view === 'critical') {
    where.severity = IncidentSeverity.CRITICAL;
    where.status = { in: activeIncidentStatuses };
  }
  if (filters.view === 'assigned_to_me' && filters.assignedToId) {
    where.assignedManagerId = filters.assignedToId;
    where.status = { in: activeIncidentStatuses };
  }
  if (filters.view === 'resolved') where.status = IncidentStatus.RESOLVED;
  if (filters.view === 'closed') where.status = IncidentStatus.CLOSED;

  return prisma.incident.findMany({
    where,
    include: includeIncidentRelations(),
    orderBy: [{ severity: 'desc' }, { startedAt: 'desc' }],
    take: 250,
  });
}

export async function getIncident(hotelId: string, id: string) {
  const incident = await prisma.incident.findFirst({
    where: { id, hotelId },
    include: includeIncidentRelations(),
  });
  if (!incident) throw new Error('Incident not found');
  return incident;
}

export async function createIncident(input: CreateIncidentInput) {
  const incident = await prisma.incident.create({
    data: {
      hotelId: input.hotelId,
      incidentNumber: await nextIncidentNumber(input.hotelId),
      title: input.title,
      description: input.description,
      category: input.category,
      severity: input.severity,
      status: input.status || IncidentStatus.NEW,
      sourceModule: input.sourceModule,
      linkedEntityType: input.linkedEntityType,
      linkedEntityId: input.linkedEntityId,
      createdById: input.createdById || input.actor?.userId || undefined,
      assignedManagerId: input.assignedManagerId || undefined,
      startedAt: input.startedAt || new Date(),
      metadata: input.metadata,
    },
    include: includeIncidentRelations(),
  });

  await recordAuditEvent({
    hotelId: input.hotelId,
    actor: input.actor || { userId: input.createdById },
    action: 'INCIDENT_CREATED',
    entity: 'incident',
    entityId: incident.id,
    details: { incidentNumber: incident.incidentNumber, severity: incident.severity, category: incident.category },
    source: 'incident-management',
    correlationId: input.correlationId,
  });

  await eventBus.publish({
    eventType: 'incident.created',
    hotelId: input.hotelId,
    source: 'incident-management',
    correlationId: input.correlationId,
    userId: input.createdById || input.actor?.userId || undefined,
    payload: {
      incidentId: incident.id,
      incidentNumber: incident.incidentNumber,
      title: incident.title,
      summary: incident.title,
      severity: incident.severity,
      status: incident.status,
      category: incident.category,
      sourceModule: incident.sourceModule,
      linkedEntityType: incident.linkedEntityType,
      linkedEntityId: incident.linkedEntityId,
    },
  });

  return incident;
}

export async function updateIncident(hotelId: string, id: string, data: UpdateIncidentInput, actor?: AuditActor) {
  await getIncident(hotelId, id);
  const updated = await prisma.incident.update({
    where: { id },
    data: {
      ...data,
      resolvedAt: data.status === IncidentStatus.RESOLVED ? new Date() : undefined,
      closedAt: data.status === IncidentStatus.CLOSED ? new Date() : undefined,
    },
    include: includeIncidentRelations(),
  });

  await recordAuditEvent({
    hotelId,
    actor,
    action: 'INCIDENT_UPDATED',
    entity: 'incident',
    entityId: id,
    details: data as Record<string, unknown>,
    source: 'incident-management',
  });

  await eventBus.publish({
    eventType: 'incident.updated',
    hotelId,
    source: 'incident-management',
    userId: actor?.userId || undefined,
    payload: { incidentId: id, title: updated.title, status: updated.status, severity: updated.severity },
  });

  return updated;
}

export function acknowledgeIncident(hotelId: string, id: string, actor?: AuditActor) {
  return updateIncident(hotelId, id, { status: IncidentStatus.ACKNOWLEDGED }, actor);
}

export function resolveIncident(hotelId: string, id: string, actor?: AuditActor) {
  return updateIncident(hotelId, id, { status: IncidentStatus.RESOLVED }, actor);
}

export function closeIncident(hotelId: string, id: string, actor?: AuditActor) {
  return updateIncident(hotelId, id, { status: IncidentStatus.CLOSED }, actor);
}

export async function addIncidentComment(hotelId: string, incidentId: string, body: string, authorId?: string | null, actor?: AuditActor) {
  await getIncident(hotelId, incidentId);
  const comment = await prisma.incidentComment.create({
    data: { hotelId, incidentId, authorId: authorId || undefined, body },
    include: { author: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });

  await recordAuditEvent({
    hotelId,
    actor,
    action: 'INCIDENT_COMMENT_ADDED',
    entity: 'incident',
    entityId: incidentId,
    details: { commentId: comment.id },
    source: 'incident-management',
  });

  await eventBus.publish({
    eventType: 'incident.comment_added',
    hotelId,
    source: 'incident-management',
    userId: authorId || undefined,
    payload: { incidentId, commentId: comment.id, summary: 'Incident comment added' },
  });

  return comment;
}

async function linkTaskToIncident(incidentId: string, ticketId: string) {
  return prisma.incidentTask.upsert({
    where: { incidentId_ticketId: { incidentId, ticketId } },
    update: {},
    create: { incidentId, ticketId },
  });
}

async function findDuplicateOpenTask(hotelId: string, duplicateKey: string, minutes: number) {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  return prisma.ticket.findFirst({
    where: {
      hotelId,
      status: { in: [TicketStatus.OPEN, TicketStatus.PENDING, TicketStatus.IN_PROGRESS, TicketStatus.BREACHED] },
      createdAtUtc: { gte: cutoff },
      details: { path: ['duplicateKey'], equals: duplicateKey },
    },
  });
}

async function findOrCreateSmartBuildingIncident(event: PlatformEvent) {
  const payload = payloadRecord(event);
  const signal = stringValue(payload.signal);
  const deviceExternalId = stringValue(payload.deviceExternalId) || stringValue(payload.externalId) || 'unknown-device';
  const duplicateKey = `SMART_BUILDING:${event.metadata.hotelId}:${deviceExternalId}:${signal || event.metadata.eventType}`;
  const duplicateCutoff = new Date(Date.now() - 30 * 60 * 1000);

  const existing = await prisma.incident.findFirst({
    where: {
      hotelId: event.metadata.hotelId,
      sourceModule: 'SMART_BUILDING',
      status: { in: activeIncidentStatuses },
      startedAt: { gte: duplicateCutoff },
      metadata: { path: ['duplicateKey'], equals: duplicateKey },
    },
    include: includeIncidentRelations(),
  });
  if (existing) return { incident: existing, duplicateKey, created: false };

  const category = categoryForSmartBuildingSignal(signal);
  const severity =
    signal === 'WATER_LEAK' ||
    signal === 'PANIC_BUTTON' ||
    signal === 'DOOR_FORCED' ||
    (signal === 'HVAC_ALERT' && stringValue(payload.status) === 'ALERT')
      ? IncidentSeverity.CRITICAL
      : IncidentSeverity.HIGH;

  const incident = await createIncident({
    hotelId: event.metadata.hotelId,
    title: stringValue(payload.title) || stringValue(payload.summary) || 'Smart Building incident',
    description: stringValue(payload.summary) || stringValue(payload.title),
    category,
    severity,
    status: IncidentStatus.NEW,
    sourceModule: 'SMART_BUILDING',
    linkedEntityType: stringValue(payload.linkedEntityType),
    linkedEntityId: stringValue(payload.linkedEntityId),
    createdById: event.metadata.userId,
    actor: { userId: event.metadata.userId },
    correlationId: event.metadata.correlationId,
    metadata: {
      duplicateKey,
      signal,
      sourceEventId: event.metadata.eventId,
      sourcePayload: payload as Prisma.InputJsonObject,
    } as Prisma.InputJsonObject,
  });

  return { incident, duplicateKey, created: true };
}

async function createSmartBuildingIncidentTask(event: PlatformEvent, incidentId: string, duplicateKey: string) {
  const payload = payloadRecord(event);
  const signal = stringValue(payload.signal);
  const category = categoryForSmartBuildingSignal(signal);
  const severity =
    signal === 'WATER_LEAK' ||
    signal === 'PANIC_BUTTON' ||
    signal === 'DOOR_FORCED' ||
    (signal === 'HVAC_ALERT' && stringValue(payload.status) === 'ALERT')
      ? IncidentSeverity.CRITICAL
      : IncidentSeverity.HIGH;
  const existingTask = await findDuplicateOpenTask(event.metadata.hotelId, duplicateKey, 30);
  if (existingTask) {
    await linkTaskToIncident(incidentId, existingTask.id);
    return existingTask;
  }

  const title =
    signal === 'WATER_LEAK'
      ? 'Investigate water leak incident'
      : signal === 'DOOR_FORCED'
        ? 'Investigate forced door incident'
        : signal === 'CAMERA_OFFLINE'
          ? 'Inspect offline camera incident'
          : signal === 'PANIC_BUTTON'
            ? 'Respond to panic button incident'
            : signal === 'HVAC_ALERT'
              ? 'Inspect HVAC incident'
              : signal === 'SENSOR_OFFLINE'
                ? 'Inspect offline sensor incident'
                : 'Respond to Smart Building incident';

  const task = await createTask({
    hotelId: event.metadata.hotelId,
    title,
    description: stringValue(payload.summary) || stringValue(payload.title),
    department: departmentForIncident(category),
    category: ticketCategoryForIncident(category),
    priority: taskPriorityForSeverity(severity),
    status: TicketStatus.OPEN,
    dueDate: endOfToday(),
    sourceKey: `incident:${incidentId}:${signal || event.metadata.eventId}`,
    details: {
      incidentId,
      sourceModule: 'SMART_BUILDING',
      duplicateKey,
      linkedEntityType: stringValue(payload.linkedEntityType),
      linkedEntityId: stringValue(payload.linkedEntityId),
      sourceEventId: event.metadata.eventId,
      sourceEventType: event.metadata.eventType,
      sourcePayload: payload,
    },
    actor: { userId: event.metadata.userId },
    source: 'incident-management',
    correlationId: event.metadata.correlationId,
    idempotencyKey: `incident-task:${incidentId}:${event.metadata.eventId}`,
  });

  await linkTaskToIncident(incidentId, task.id);
  return task;
}

async function notifyForSmartBuildingIncident(event: PlatformEvent, incidentId: string) {
  const payload = payloadRecord(event);
  const signal = stringValue(payload.signal);
  const category = categoryForSmartBuildingSignal(signal);
  const roles =
    category === IncidentCategory.MAINTENANCE
      ? ['ADMIN', 'MANAGER', 'MODULE:maintenance_center', 'MODULE:security_center']
      : ['ADMIN', 'MANAGER', 'MODULE:security_center'];

  await notifyRoles({
    hotelId: event.metadata.hotelId,
    roles,
    channels: ['DASHBOARD'],
    type: 'SYSTEM',
    title: `Incident opened: ${stringValue(payload.title) || 'Smart Building alert'}`,
    body: stringValue(payload.summary) || 'A Smart Building event opened an incident.',
    source: 'incident-management',
    correlationId: event.metadata.correlationId,
    idempotencyKey: `incident-notify:${incidentId}:${event.metadata.eventId}`,
  });
}

let smartBuildingSubscriptionStarted = false;

export function startIncidentSubscriptions() {
  if (smartBuildingSubscriptionStarted) return;
  smartBuildingSubscriptionStarted = true;

  eventBus.subscribe('smart_building.alert_detected', async (event) => {
    const payload = payloadRecord(event);
    const signal = stringValue(payload.signal);
    if (!['WATER_LEAK', 'DOOR_FORCED', 'CAMERA_OFFLINE', 'PANIC_BUTTON', 'HVAC_ALERT', 'SENSOR_OFFLINE'].includes(signal || '')) {
      return;
    }

    try {
      const { incident, duplicateKey } = await findOrCreateSmartBuildingIncident(event);

      await recordAuditEvent({
        hotelId: event.metadata.hotelId,
        actor: { userId: event.metadata.userId },
        action: 'INCIDENT_WORKFLOW_STARTED',
        entity: 'incident',
        entityId: incident.id,
        details: { signal, sourceEventId: event.metadata.eventId },
        source: 'incident-management',
        correlationId: event.metadata.correlationId,
      });

      const task = await createSmartBuildingIncidentTask(event, incident.id, duplicateKey);
      await recordAuditEvent({
        hotelId: event.metadata.hotelId,
        actor: { userId: event.metadata.userId },
        action: 'INCIDENT_TASK_LINKED',
        entity: 'incident',
        entityId: incident.id,
        details: { taskId: task.id, signal },
        source: 'incident-management',
        correlationId: event.metadata.correlationId,
      });

      await notifyForSmartBuildingIncident(event, incident.id);
      await recordAuditEvent({
        hotelId: event.metadata.hotelId,
        actor: { userId: event.metadata.userId },
        action: 'INCIDENT_NOTIFICATION_SENT',
        entity: 'incident',
        entityId: incident.id,
        details: { signal },
        source: 'incident-management',
        correlationId: event.metadata.correlationId,
      });

      await eventBus.publish({
        eventType: 'incident.smart_building_workflow_completed',
        hotelId: event.metadata.hotelId,
        source: 'incident-management',
        correlationId: event.metadata.correlationId,
        causationId: event.metadata.eventId,
        userId: event.metadata.userId,
        payload: {
          incidentId: incident.id,
          incidentNumber: incident.incidentNumber,
          taskId: task.id,
          signal,
          severity: incident.severity,
          status: incident.status,
          summary: `Incident ${incident.incidentNumber} opened from Smart Building`,
          sourceModule: 'SMART_BUILDING',
          location: stringValue(payload.location),
        },
      });
    } catch (error) {
      logger.error('Smart Building incident workflow failed', {
        eventId: event.metadata.eventId,
        correlationId: event.metadata.correlationId,
        error,
      });
    }
  });

  logger.info('Incident subscriptions started');
}
