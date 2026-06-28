import { NextFunction, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { ApiResponse, AuthenticatedRequest } from '../types/index.js';
import { emitToHotel } from '../socket/index.js';
import * as smartBuildingService from '../services/smartBuilding.service.js';
import type { SmartBuildingEvent } from '../services/smartBuilding.service.js';
import { eventBus } from '../platform/event-bus/eventBus.service.js';
import { recordAuditEvent } from '../platform/audit/auditEngine.service.js';

function getHotelId(req: AuthenticatedRequest) {
  const hotelId = req.user?.hotelId;
  if (!hotelId) {
    throw new Error('hotelId is required');
  }
  return hotelId;
}

function getUserAgent(req: AuthenticatedRequest) {
  const userAgent = req.headers['user-agent'];
  return Array.isArray(userAgent) ? userAgent.join(', ') : userAgent;
}

function emitSmartBuildingUpdate(
  req: AuthenticatedRequest,
  action: 'INGESTED' | 'ALERT_ACKNOWLEDGED' | 'ALERT_RESOLVED',
  payload: Record<string, unknown>
) {
  const io = req.app.get('io') as SocketIOServer | undefined;
  if (!io) return;

  emitToHotel(io, getHotelId(req), 'smart-building:update', {
    action,
    hotelId: getHotelId(req),
    timestamp: new Date().toISOString(),
    ...payload,
  });
}

function shouldEmitSmartBuildingAlert(event: SmartBuildingEvent) {
  if (event.type === 'SECURITY_ALERT') return true;
  if (event.type === 'CAMERA_STATUS') return event.camera.status === 'OFFLINE';
  if (event.type === 'DEVICE_STATUS') return event.device.status === 'OFFLINE' || event.device.status === 'WARNING';
  if (event.type === 'DOOR_STATUS') return event.door.openState === 'FORCED_OPEN' || event.door.openState === 'HELD_OPEN';
  if (event.type === 'DOOR_ACCESS') {
    return event.accessEvent.result === 'FORCED' || event.accessEvent.result === 'HELD_OPEN' || event.accessEvent.result === 'DENIED';
  }
  if (event.type === 'SENSOR_READING') {
    return (
      event.sensor.status === 'ALERT' ||
      event.sensor.status === 'WARNING' ||
      event.sensor.status === 'OFFLINE' ||
      event.sensor.sensorType === 'PANIC_BUTTON'
    );
  }
  return false;
}

function smartBuildingEventDetails(event: SmartBuildingEvent, resultId?: string) {
  const base = {
    smartBuildingEventType: event.type,
    resultId,
    occurredAt: event.occurredAt,
    sourceModule: 'SMART_BUILDING',
    metadata: event.metadata,
  };

  if (event.type === 'CAMERA_STATUS') {
    return {
      ...base,
      signal: event.camera.status === 'OFFLINE' ? 'CAMERA_OFFLINE' : 'CAMERA_STATUS',
      linkedEntityType: 'CAMERA',
      linkedEntityId: resultId,
      deviceExternalId: event.camera.deviceExternalId || event.camera.externalId,
      externalId: event.camera.externalId,
      location: event.camera.location,
      status: event.camera.status,
      title: event.camera.status === 'OFFLINE' ? 'Camera offline' : 'Camera status updated',
      summary: `${event.camera.name || event.camera.externalId} is ${event.camera.status.toLowerCase()}`,
    };
  }

  if (event.type === 'DOOR_STATUS') {
    return {
      ...base,
      signal: event.door.openState === 'FORCED_OPEN' ? 'DOOR_FORCED' : event.door.openState,
      linkedEntityType: 'DOOR',
      linkedEntityId: resultId,
      deviceExternalId: event.door.deviceExternalId || event.door.externalId,
      externalId: event.door.externalId,
      location: event.door.location,
      status: event.door.openState,
      title: event.door.openState === 'FORCED_OPEN' ? 'Door forced open' : 'Door status updated',
      summary: `${event.door.name || event.door.externalId} is ${event.door.openState.toLowerCase().replace('_', ' ')}`,
    };
  }

  if (event.type === 'DOOR_ACCESS') {
    return {
      ...base,
      signal: event.accessEvent.result === 'FORCED' ? 'DOOR_FORCED' : event.accessEvent.result,
      linkedEntityType: 'DOOR_ACCESS_EVENT',
      linkedEntityId: resultId,
      deviceExternalId: event.accessEvent.doorExternalId,
      externalId: event.accessEvent.externalId,
      location: event.accessEvent.doorName,
      status: event.accessEvent.result,
      title: event.accessEvent.result === 'FORCED' ? 'Door forced open' : 'Door access event',
      summary: `${event.accessEvent.doorName || event.accessEvent.doorExternalId || 'Door'} ${event.accessEvent.result.toLowerCase().replace('_', ' ')}`,
    };
  }

  if (event.type === 'SENSOR_READING') {
    const signal =
      event.sensor.status === 'OFFLINE'
        ? 'SENSOR_OFFLINE'
        : event.sensor.sensorType === 'WATER_LEAK' && event.sensor.status === 'ALERT'
        ? 'WATER_LEAK'
        : event.sensor.sensorType === 'PANIC_BUTTON'
          ? 'PANIC_BUTTON'
          : event.sensor.sensorType === 'HVAC' && (event.sensor.status === 'WARNING' || event.sensor.status === 'ALERT')
            ? 'HVAC_ALERT'
          : event.sensor.sensorType;

    return {
      ...base,
      signal,
      linkedEntityType: 'SENSOR_READING',
      linkedEntityId: resultId,
      deviceExternalId: event.sensor.deviceExternalId || event.sensor.externalId,
      externalId: event.sensor.externalId,
      location: event.sensor.location,
      status: event.sensor.status,
      sensorType: event.sensor.sensorType,
      title:
        signal === 'WATER_LEAK'
          ? 'Critical water leak detected'
          : signal === 'PANIC_BUTTON'
            ? 'Panic button activated'
            : signal === 'HVAC_ALERT'
              ? 'HVAC warning detected'
              : signal === 'SENSOR_OFFLINE'
                ? 'Sensor offline'
                : 'Sensor reading received',
      summary: `${event.sensor.sensorType.toLowerCase().replace('_', ' ')} ${event.sensor.status.toLowerCase()} at ${event.sensor.location || 'unknown location'}`,
    };
  }

  if (event.type === 'SECURITY_ALERT') {
    return {
      ...base,
      signal:
        event.alert.alertType === 'FORCED_DOOR'
          ? 'DOOR_FORCED'
          : event.alert.alertType === 'PANIC'
            ? 'PANIC_BUTTON'
            : event.alert.alertType === 'CAMERA_OFFLINE'
              ? 'CAMERA_OFFLINE'
              : event.alert.alertType === 'HVAC'
                ? 'HVAC_ALERT'
                : event.alert.alertType === 'DEVICE_OFFLINE'
                  ? 'SENSOR_OFFLINE'
              : event.alert.alertType,
      linkedEntityType: 'SECURITY_ALERT',
      linkedEntityId: resultId,
      deviceExternalId: event.alert.deviceExternalId || event.alert.externalId,
      externalId: event.alert.externalId,
      location: event.alert.location,
      severity: event.alert.severity,
      title: event.alert.title,
      summary: event.alert.message || event.alert.title,
    };
  }

  const deviceSignal =
    event.device.deviceType === 'HVAC' && (event.device.status === 'WARNING' || event.device.status === 'OFFLINE')
      ? 'HVAC_ALERT'
      : event.device.status === 'OFFLINE' &&
          ['TEMPERATURE_SENSOR', 'WATER_LEAK_SENSOR', 'MOTION_SENSOR', 'PANIC_BUTTON', 'ENERGY_METER'].includes(
            event.device.deviceType
          )
        ? 'SENSOR_OFFLINE'
        : event.device.status;

  return {
    ...base,
    signal: deviceSignal,
    linkedEntityType: 'IOT_DEVICE',
    linkedEntityId: resultId,
    deviceExternalId: event.device.externalId,
    externalId: event.device.externalId,
    location: event.device.location,
    status: event.device.status,
    title: `${event.device.name || event.device.externalId} ${event.device.status.toLowerCase()}`,
    summary: `${event.device.name || event.device.externalId} is ${event.device.status.toLowerCase()}`,
  };
}

export async function getOverview(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await smartBuildingService.getSmartBuildingOverview(getHotelId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listDevices(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await smartBuildingService.listDevices(getHotelId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listCameraFeeds(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await smartBuildingService.listCameraFeeds(getHotelId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listDoorAccessEvents(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await smartBuildingService.listDoorAccessEvents(getHotelId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listDoorStatuses(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await smartBuildingService.listDoorStatuses(getHotelId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listSensorReadings(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await smartBuildingService.listSensorReadings(getHotelId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listSecurityAlerts(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await smartBuildingService.listSecurityAlerts(getHotelId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listLinkedTasks(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await smartBuildingService.listLinkedSmartBuildingTasks(getHotelId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function acknowledgeSecurityAlert(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) throw new Error('userId is required');
    const data = await smartBuildingService.acknowledgeSecurityAlert(getHotelId(req), req.params.id, userId);
    await recordAuditEvent({
      hotelId: getHotelId(req),
      actor: { userId, ipAddress: req.ip, userAgent: getUserAgent(req) },
      action: 'SMART_BUILDING_ALERT_ACKNOWLEDGED',
      entity: 'security_alert',
      entityId: req.params.id,
      source: 'smart-building',
    });
    await eventBus.publish({
      eventType: 'smart_building.alert_acknowledged',
      hotelId: getHotelId(req),
      source: 'smart-building',
      userId,
      payload: { alertId: req.params.id },
    });
    emitSmartBuildingUpdate(req, 'ALERT_ACKNOWLEDGED', { alertId: req.params.id });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function resolveSecurityAlert(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) throw new Error('userId is required');
    const data = await smartBuildingService.resolveSecurityAlert(getHotelId(req), req.params.id, userId);
    await recordAuditEvent({
      hotelId: getHotelId(req),
      actor: { userId, ipAddress: req.ip, userAgent: getUserAgent(req) },
      action: 'SMART_BUILDING_ALERT_RESOLVED',
      entity: 'security_alert',
      entityId: req.params.id,
      source: 'smart-building',
    });
    await eventBus.publish({
      eventType: 'smart_building.alert_resolved',
      hotelId: getHotelId(req),
      source: 'smart-building',
      userId,
      payload: { alertId: req.params.id },
    });
    emitSmartBuildingUpdate(req, 'ALERT_RESOLVED', { alertId: req.params.id });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function ingestEvent(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const event = req.body as SmartBuildingEvent;
    const data = await smartBuildingService.ingestSmartBuildingEvent(getHotelId(req), event);
    const resultId = (data as { id?: string })?.id;
    const eventDetails = smartBuildingEventDetails(event, resultId);
    await recordAuditEvent({
      hotelId: getHotelId(req),
      actor: { userId: req.user?.id, ipAddress: req.ip, userAgent: getUserAgent(req) },
      action: 'SMART_BUILDING_EVENT_RECEIVED',
      entity: 'smart_building_event',
      entityId: resultId,
      details: eventDetails,
      source: 'smart-building',
    });
    await eventBus.publish({
      eventType: 'smart_building.event_ingested',
      hotelId: getHotelId(req),
      source: 'smart-building',
      userId: req.user?.id,
      idempotencyKey:
        'device' in event && event.device?.externalId
          ? `${event.type}:${event.device.externalId}`
          : 'camera' in event && event.camera?.externalId
            ? `${event.type}:${event.camera.externalId}`
            : undefined,
      payload: eventDetails,
    });
    emitSmartBuildingUpdate(req, 'INGESTED', { eventType: event.type });
    if (shouldEmitSmartBuildingAlert(event)) {
      await eventBus.publish({
        eventType: 'smart_building.alert_detected',
        hotelId: getHotelId(req),
        source: 'smart-building',
        userId: req.user?.id,
        payload: eventDetails,
      });
      const io = req.app.get('io') as SocketIOServer | undefined;
      if (io) {
        emitToHotel(io, getHotelId(req), 'smart-building:alert', {
          eventType: event.type,
          hotelId: getHotelId(req),
          timestamp: new Date().toISOString(),
        });
      }
    }
    res.status(201).json({ success: true, data, message: 'Smart building event ingested' });
  } catch (error) {
    next(error);
  }
}
