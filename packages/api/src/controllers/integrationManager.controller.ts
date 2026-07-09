import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import { recordAuditEvent } from '../platform/audit/auditEngine.service.js';
import { eventBus } from '../platform/event-bus/eventBus.service.js';
import {
  getIntegrationManagerDevices,
  getIntegrationManagerLogs,
  getIntegrationManagerOverview,
  providerRegistry,
  type IntegrationManagerCategory,
} from '../services/integrationManager.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

const categorySchema = z.enum([
  'CCTV',
  'SMART_LOCKS',
  'SENSORS',
  'HVAC',
  'ENERGY_METERS',
  'WEATHER',
  'PAYMENTS',
  'BOOKING_CHANNELS',
  'MICROSOFT_365',
  'AI_PROVIDERS',
  'OTHER_PROVIDERS',
]);

function actorFrom(req: AuthenticatedRequest) {
  return {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null,
  };
}

async function auditIntegrationManager(req: AuthenticatedRequest, action: string, entityId: string, details?: Record<string, unknown>) {
  await recordAuditEvent({
    hotelId: req.user!.hotelId,
    actor: actorFrom(req),
    action,
    entity: 'INTEGRATION_MANAGER',
    entityId,
    source: 'integration-manager',
    details,
  });
}

export async function getOverview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await getIntegrationManagerOverview(req.user!.hotelId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getRegistry(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: providerRegistry });
  } catch (error) {
    next(error);
  }
}

export async function getLogs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await getIntegrationManagerLogs(req.user!.hotelId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getDevices(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const parsed = categorySchema.safeParse(req.query.category);
    const data = await getIntegrationManagerDevices(
      req.user!.hotelId,
      parsed.success ? (parsed.data as IntegrationManagerCategory) : undefined
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function publishSetupEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const eventType = typeof req.body?.eventType === 'string' ? req.body.eventType : 'integration.updated';
    const integrationId = typeof req.body?.integrationId === 'string' ? req.body.integrationId : 'integration-manager';
    const payload = typeof req.body?.payload === 'object' && req.body.payload ? req.body.payload : {};
    await auditIntegrationManager(req, 'INTEGRATION_MANAGER_EVENT_PUBLISHED', integrationId, {
      eventType,
      payload,
    });
    await eventBus.publish({
      eventType,
      hotelId: req.user!.hotelId,
      source: 'integration-manager',
      userId: req.user!.id,
      payload: {
        integrationId,
        ...payload,
      },
    });
    res.json({ success: true, data: { eventType, integrationId, published: true } });
  } catch (error) {
    next(error);
  }
}
