import type { NextFunction, Response } from 'express';
import { recordAuditEvent } from '../platform/audit/auditEngine.service.js';
import { eventBus } from '../platform/event-bus/eventBus.service.js';
import * as hardwareIntegrationService from '../services/hardwareIntegration.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

function actorFrom(req: AuthenticatedRequest) {
  return {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null,
  };
}

async function auditHardware(req: AuthenticatedRequest, action: string, entityId: string, details?: Record<string, unknown>) {
  await recordAuditEvent({
    hotelId: req.user!.hotelId,
    actor: actorFrom(req),
    action,
    entity: 'HARDWARE_INTEGRATION',
    entityId,
    source: 'hardware-integration',
    details,
  });
  await eventBus.publish({
    eventType: `hardware.${action.toLowerCase()}`,
    hotelId: req.user!.hotelId,
    source: 'hardware-integration',
    userId: req.user!.id,
    payload: { integrationId: entityId, ...details },
  });
}

export async function listHardwareIntegrations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await hardwareIntegrationService.listHardwareIntegrations(req.user!.hotelId, {
      integrationType: req.query.integrationType as any,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getHardwareIntegration(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await hardwareIntegrationService.getHardwareIntegration(req.user!.hotelId, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createHardwareIntegration(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await hardwareIntegrationService.createHardwareIntegration(req.user!.hotelId, req.body);
    await auditHardware(req, 'HARDWARE_INTEGRATION_CREATED', data.id, {
      integrationType: data.integrationType,
      provider: data.provider,
      protocol: data.protocol,
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateHardwareIntegration(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await hardwareIntegrationService.updateHardwareIntegration(req.user!.hotelId, req.params.id, req.body);
    await auditHardware(req, 'HARDWARE_INTEGRATION_UPDATED', data.id, {
      integrationType: data.integrationType,
      provider: data.provider,
      protocol: data.protocol,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function testHardwareIntegration(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await hardwareIntegrationService.testHardwareIntegration(req.user!.hotelId, req.params.id);
    await auditHardware(req, 'HARDWARE_INTEGRATION_TESTED', data.id, {
      success: (data.lastTestResult as any)?.success,
      status: data.status,
      healthStatus: data.healthStatus,
    });
    if (data.iotDeviceId && (data.lastTestResult as any)?.success) {
      await auditHardware(req, 'DEVICE_STATUS_RECEIVED', data.id, {
        deviceId: data.iotDeviceId,
        status: data.status,
        healthStatus: data.healthStatus,
        source: 'connection-test',
      });
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getHardwareIntegrationHealth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await hardwareIntegrationService.getHardwareIntegrationHealth(req.user!.hotelId, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function disableHardwareIntegration(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await hardwareIntegrationService.disableHardwareIntegration(req.user!.hotelId, req.params.id);
    await auditHardware(req, 'HARDWARE_INTEGRATION_DISABLED', data.id, {
      status: data.status,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteHardwareIntegration(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await hardwareIntegrationService.deleteHardwareIntegration(req.user!.hotelId, req.params.id);
    await auditHardware(req, 'HARDWARE_INTEGRATION_DISABLED', req.params.id, {
      deleted: true,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function viewCameraFeed(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await hardwareIntegrationService.getHardwareIntegration(req.user!.hotelId, req.params.id);
    await auditHardware(req, 'CAMERA_VIEWED', data.id, {
      provider: data.provider,
      protocol: data.protocol,
    });
    res.json({
      success: true,
      data: {
        id: data.id,
        name: data.name,
        status: data.status,
        healthStatus: data.healthStatus,
        message: 'Live viewing requires the secure LaFlo streaming proxy. Raw RTSP/HLS credentials are never exposed to the browser.',
      },
    });
  } catch (error) {
    next(error);
  }
}
