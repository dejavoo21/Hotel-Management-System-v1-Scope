import {
  HardwareHealthStatus,
  HardwareIntegrationStatus,
  HardwareIntegrationType,
  HardwareProvider,
  HardwareProtocol,
} from '@prisma/client';
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

async function auditCctv(req: AuthenticatedRequest, action: string, entityId: string, details?: Record<string, unknown>) {
  await recordAuditEvent({
    hotelId: req.user!.hotelId,
    actor: actorFrom(req),
    action,
    entity: 'CCTV',
    entityId,
    source: 'cctv',
    details,
  });
  await eventBus.publish({
    eventType: `cctv.${action.toLowerCase()}`,
    hotelId: req.user!.hotelId,
    source: 'cctv',
    userId: req.user!.id,
    payload: { entityId, ...details },
  });
}

export async function listCctvCameras(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const [cameras, nvrs] = await Promise.all([
      hardwareIntegrationService.listHardwareIntegrations(req.user!.hotelId, { integrationType: HardwareIntegrationType.CCTV_CAMERA }),
      hardwareIntegrationService.listHardwareIntegrations(req.user!.hotelId, { integrationType: HardwareIntegrationType.CCTV_NVR }),
    ]);
    res.json({ success: true, data: [...cameras, ...nvrs] });
  } catch (error) {
    next(error);
  }
}

export async function createCctvCamera(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await hardwareIntegrationService.createHardwareIntegration(req.user!.hotelId, {
      ...req.body,
      integrationType: req.body.integrationType || HardwareIntegrationType.CCTV_CAMERA,
      metadata: {
        connectionMethod: req.body.connectionMethod || 'MANUAL_CAMERA',
        streamKind: req.body.streamKind,
        cloudProvider: req.body.cloudProvider,
        ...(req.body.metadata || {}),
      },
    });
    await auditCctv(req, 'CCTV_CAMERA_CREATED', data.id, {
      integrationType: data.integrationType,
      provider: data.provider,
      protocol: data.protocol,
      connectionMethod: req.body.connectionMethod || 'MANUAL_CAMERA',
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function discoverCctv(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = hardwareIntegrationService.discoverHardwareIntegrations({
      subnet: typeof req.body?.subnet === 'string' ? req.body.subnet : undefined,
      provider: typeof req.body?.provider === 'string' ? req.body.provider as HardwareProvider : undefined,
    });
    await auditCctv(req, 'CCTV_DISCOVERY_STARTED', req.body?.subnet || 'network-scan', {
      subnet: result.subnet,
      provider: result.provider,
      configured: result.configured,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function testNvr(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = hardwareIntegrationService.testHardwareConfiguration({
      host: req.body?.host,
      provider: req.body?.provider as HardwareProvider,
      protocol: req.body?.protocol as HardwareProtocol,
    });
    await auditCctv(req, result.success ? 'CCTV_NVR_TESTED' : 'CCTV_CONNECTION_FAILED', req.body?.host || 'nvr-test', {
      provider: req.body?.provider,
      protocol: req.body?.protocol,
      success: result.success,
      message: result.message,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function testCamera(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await hardwareIntegrationService.testHardwareIntegration(req.user!.hotelId, req.params.id);
    const success = data.status === HardwareIntegrationStatus.CONNECTED && data.healthStatus === HardwareHealthStatus.HEALTHY;
    await auditCctv(req, success ? 'CCTV_CAMERA_TESTED' : 'CCTV_CONNECTION_FAILED', data.id, {
      success,
      status: data.status,
      healthStatus: data.healthStatus,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getCameraPlayback(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await hardwareIntegrationService.getHardwareIntegration(req.user!.hotelId, req.params.id);
    await auditCctv(req, 'CCTV_CAMERA_VIEWED', data.id, {
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
        message: 'Playback and live viewing require the secure LaFlo media gateway. Raw RTSP URLs and credentials are never exposed to the browser.',
      },
    });
  } catch (error) {
    next(error);
  }
}
