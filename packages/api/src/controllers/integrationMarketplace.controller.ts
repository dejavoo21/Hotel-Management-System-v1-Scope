import type { Response, NextFunction } from 'express';
import {
  disconnectIntegration,
  getIntegration,
  getIntegrationLogs,
  getIntegrationReadiness,
  listIntegrations,
  reconnectIntegration,
  testIntegration,
} from '../platform/integrations/integrationHub.service.js';
import { recordAuditEvent } from '../platform/audit/auditEngine.service.js';
import { eventBus } from '../platform/event-bus/eventBus.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

function actorFrom(req: AuthenticatedRequest) {
  return {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null,
  };
}

async function auditIntegrationAction(req: AuthenticatedRequest, action: string, providerId: string, details?: Record<string, unknown>) {
  await recordAuditEvent({
    hotelId: req.user!.hotelId,
    actor: actorFrom(req),
    action,
    entity: 'INTEGRATION_PROVIDER',
    entityId: providerId,
    source: 'integration-marketplace',
    details,
  });
  await eventBus.publish({
    eventType: `integration.${action.toLowerCase()}`,
    hotelId: req.user!.hotelId,
    source: 'integration-marketplace',
    userId: req.user!.id,
    payload: { providerId, ...details },
  });
}

export async function listMarketplaceIntegrations(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.json({
      success: true,
      data: {
        readiness: getIntegrationReadiness(),
        providers: listIntegrations(),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMarketplaceIntegration(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const provider = getIntegration(req.params.providerId);
    if (!provider) {
      res.status(404).json({ success: false, error: 'Integration provider not found' });
      return;
    }
    res.json({ success: true, data: { provider, logs: getIntegrationLogs(provider.id) } });
  } catch (error) {
    next(error);
  }
}

export async function getMarketplaceIntegrationLogs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const provider = getIntegration(req.params.providerId);
    if (!provider) {
      res.status(404).json({ success: false, error: 'Integration provider not found' });
      return;
    }
    res.json({ success: true, data: getIntegrationLogs(provider.id) });
  } catch (error) {
    next(error);
  }
}

export async function testMarketplaceIntegration(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = testIntegration(req.params.providerId);
    if (!result) {
      res.status(404).json({ success: false, error: 'Integration provider not found' });
      return;
    }
    await auditIntegrationAction(req, 'INTEGRATION_TEST_CONNECTION', req.params.providerId, {
      success: result.success,
      health: result.health,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function reconnectMarketplaceIntegration(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = reconnectIntegration(req.params.providerId);
    if (!result) {
      res.status(404).json({ success: false, error: 'Integration provider not found' });
      return;
    }
    await auditIntegrationAction(req, 'INTEGRATION_RECONNECT_REQUESTED', req.params.providerId, { success: result.success });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function disconnectMarketplaceIntegration(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = disconnectIntegration(req.params.providerId);
    if (!result) {
      res.status(404).json({ success: false, error: 'Integration provider not found' });
      return;
    }
    await auditIntegrationAction(req, 'INTEGRATION_DISCONNECT_REQUESTED', req.params.providerId, { success: result.success });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
