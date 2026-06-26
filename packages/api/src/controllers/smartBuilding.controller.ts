import { NextFunction, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { ApiResponse, AuthenticatedRequest } from '../types/index.js';
import { emitToHotel } from '../socket/index.js';
import * as smartBuildingService from '../services/smartBuilding.service.js';
import type { SmartBuildingEvent } from '../services/smartBuilding.service.js';

function getHotelId(req: AuthenticatedRequest) {
  const hotelId = req.user?.hotelId;
  if (!hotelId) {
    throw new Error('hotelId is required');
  }
  return hotelId;
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
    return event.sensor.status === 'ALERT' || event.sensor.sensorType === 'PANIC_BUTTON';
  }
  return false;
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

export async function acknowledgeSecurityAlert(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) throw new Error('userId is required');
    const data = await smartBuildingService.acknowledgeSecurityAlert(getHotelId(req), req.params.id, userId);
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
    emitSmartBuildingUpdate(req, 'INGESTED', { eventType: event.type });
    if (shouldEmitSmartBuildingAlert(event)) {
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
