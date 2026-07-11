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

async function publishIntegrationLifecycle(req: AuthenticatedRequest, eventType: string, entityId: string, details?: Record<string, unknown>) {
  await eventBus.publish({
    eventType,
    hotelId: req.user!.hotelId,
    source: 'integration-manager',
    userId: req.user!.id,
    payload: { integrationId: entityId, ...details },
  });
}

async function publishCctvEvent(req: AuthenticatedRequest, eventType: string, entityId: string, details?: Record<string, unknown>) {
  await eventBus.publish({
    eventType,
    hotelId: req.user!.hotelId,
    source: 'cctv',
    userId: req.user!.id,
    payload: { integrationId: entityId, ...details },
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
    const data = await hardwareIntegrationService.createHardwareIntegration(
      req.user!.hotelId,
      {
        ...req.body,
        integrationType: req.body.integrationType || HardwareIntegrationType.CCTV_CAMERA,
        metadata: {
          connectionMethod: req.body.connectionMethod || 'MANUAL_CAMERA',
          streamKind: req.body.streamKind,
          cloudProvider: req.body.cloudProvider,
          ...(req.body.metadata || {}),
        },
      },
      req.user!.id
    );
    await auditCctv(req, 'CCTV_CAMERA_CREATED', data.id, {
      integrationType: data.integrationType,
      provider: data.provider,
      protocol: data.protocol,
      connectionMethod: req.body.connectionMethod || 'MANUAL_CAMERA',
    });
    await publishIntegrationLifecycle(req, 'integration.created', data.id, {
      integrationType: data.integrationType,
      provider: data.provider,
      protocol: data.protocol,
      category: 'CCTV',
      credentialReference: data.credentialReference,
    });
    await publishCctvEvent(req, 'cctv.integration.created', data.id, {
      integrationType: data.integrationType,
      provider: data.provider,
      protocol: data.protocol,
      connectionMethod: req.body.connectionMethod || 'MANUAL_CAMERA',
    });
    if (req.body?.metadata?.importedFrom === 'discovery') {
      await auditCctv(req, 'CCTV_CAMERA_IMPORTED', data.id, {
        provider: data.provider,
        protocol: data.protocol,
        source: 'discovery',
      });
      await publishCctvEvent(req, 'cctv.camera.imported', data.id, {
        provider: data.provider,
        source: 'discovery',
      });
    }
    if (req.body?.metadata?.importedFrom === 'nvr-channel') {
      await auditCctv(req, 'CCTV_NVR_CHANNEL_IMPORTED', data.id, {
        provider: data.provider,
        channelNumber: data.channelNumber,
      });
      await publishCctvEvent(req, 'cctv.nvr.channelImported', data.id, {
        provider: data.provider,
        channelNumber: data.channelNumber,
      });
    }
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
    await publishIntegrationLifecycle(req, 'integration.device.discovered', req.body?.subnet || 'network-scan', {
      subnet: result.subnet,
      provider: result.provider,
      configured: result.configured,
      discoveredCount: result.discovered.length,
    });
    await auditCctv(req, 'CCTV_DISCOVERY_COMPLETED', req.body?.subnet || 'network-scan', {
      subnet: result.subnet,
      provider: result.provider,
      state: result.state,
      discoveredCount: result.discovered.length,
    });
    await publishCctvEvent(req, 'cctv.camera.discovered', req.body?.subnet || 'network-scan', {
      subnet: result.subnet,
      provider: result.provider,
      state: result.state,
      discoveredCount: result.discovered.length,
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
      channelCount: req.body?.channelCount,
    });
    await auditCctv(req, result.success ? 'CCTV_NVR_TESTED' : 'CCTV_CONNECTION_FAILED', req.body?.host || 'nvr-test', {
      provider: req.body?.provider,
      protocol: req.body?.protocol,
      success: result.success,
      message: result.message,
    });
    await publishIntegrationLifecycle(
      req,
      result.success ? 'integration.connection.tested' : 'integration.connection.failed',
      req.body?.host || 'nvr-test',
      {
        provider: req.body?.provider,
        protocol: req.body?.protocol,
        success: result.success,
        message: result.message,
      }
    );
    await publishCctvEvent(req, result.success ? 'cctv.nvr.connected' : 'cctv.connection.failed', req.body?.host || 'nvr-test', {
      provider: req.body?.provider,
      protocol: req.body?.protocol,
      success: result.success,
      message: result.message,
      channelCount: result.channels?.length || 0,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function testPreview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = hardwareIntegrationService.testHardwareConfiguration({
      host: req.body?.host,
      provider: req.body?.provider as HardwareProvider,
      protocol: req.body?.protocol as HardwareProtocol,
    });
    await auditCctv(req, result.success ? 'CCTV_STREAM_PREVIEW_STARTED' : 'CCTV_STREAM_PREVIEW_FAILED', req.body?.host || 'stream-preview', {
      provider: req.body?.provider,
      protocol: req.body?.protocol,
      success: result.success,
      message: result.message,
      mediaGatewayRequired: true,
    });
    await publishCctvEvent(req, result.success ? 'cctv.stream.previewStarted' : 'cctv.stream.previewFailed', req.body?.host || 'stream-preview', {
      provider: req.body?.provider,
      protocol: req.body?.protocol,
      success: result.success,
      message: result.message,
      mediaGatewayRequired: true,
    });
    res.json({
      success: true,
      data: {
        ...result,
        message: result.success
          ? `${result.message} Preview requires the secure LaFlo media gateway before live video can be rendered in-browser.`
          : result.message,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function testCamera(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await hardwareIntegrationService.testHardwareIntegration(req.user!.hotelId, req.params.id, req.user!.id);
    const success = data.status === HardwareIntegrationStatus.CONNECTED && data.healthStatus === HardwareHealthStatus.HEALTHY;
    await auditCctv(req, success ? 'CCTV_CAMERA_TESTED' : 'CCTV_CONNECTION_FAILED', data.id, {
      success,
      status: data.status,
      healthStatus: data.healthStatus,
    });
    await publishIntegrationLifecycle(req, success ? 'integration.connection.tested' : 'integration.connection.failed', data.id, {
      status: data.status,
      healthStatus: data.healthStatus,
      message: (data.lastTestResult as any)?.message,
    });
    await publishCctvEvent(req, success ? 'cctv.connection.tested' : 'cctv.connection.failed', data.id, {
      status: data.status,
      healthStatus: data.healthStatus,
      message: (data.lastTestResult as any)?.message,
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
    await publishCctvEvent(req, 'cctv.stream.previewStarted', data.id, {
      provider: data.provider,
      protocol: data.protocol,
      mediaGatewayRequired: true,
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
