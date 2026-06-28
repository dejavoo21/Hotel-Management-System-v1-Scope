import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { eventBus } from '../event-bus/eventBus.service.js';

export type AuditActor = {
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type RecordAuditEventInput = {
  hotelId?: string;
  actor?: AuditActor;
  action: string;
  entity: string;
  entityId?: string | null;
  bookingId?: string | null;
  details?: Record<string, unknown>;
  source?: string;
  correlationId?: string;
  idempotencyKey?: string;
};

type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

export async function recordAuditEvent(input: RecordAuditEventInput, client: PrismaClientLike = prisma) {
  if (!input.actor?.userId) {
    await eventBus.publish({
      eventType: 'audit.skipped',
      hotelId: input.hotelId || 'unknown',
      source: input.source || 'audit-engine',
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      payload: {
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        reason: 'missing_user_id',
      },
    });
    return null;
  }

  const auditLog = await client.activityLog.create({
    data: {
      userId: input.actor.userId,
      bookingId: input.bookingId || undefined,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId || undefined,
      details: {
        ...(typeof input.details === 'object' && input.details && !Array.isArray(input.details) ? input.details : {}),
        hotelId: input.hotelId,
        source: input.source || 'audit-engine',
        correlationId: input.correlationId,
      },
      ipAddress: input.actor.ipAddress || undefined,
      userAgent: input.actor.userAgent || undefined,
    },
  });

  await eventBus.publish({
    eventType: 'audit.recorded',
    hotelId: input.hotelId || 'unknown',
    source: input.source || 'audit-engine',
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
    userId: input.actor.userId,
    payload: {
      auditLogId: auditLog.id,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
    },
  });

  return auditLog;
}

export async function getAuditHistory(filters: {
  userId?: string;
  entity?: string;
  entityId?: string;
  bookingId?: string;
  limit?: number;
}) {
  return prisma.activityLog.findMany({
    where: {
      userId: filters.userId,
      entity: filters.entity,
      entityId: filters.entityId,
      bookingId: filters.bookingId,
    },
    orderBy: { createdAt: 'desc' },
    take: filters.limit || 100,
  });
}
