import { NextFunction, Response } from 'express';
import { ApiResponse, AuthenticatedRequest } from '../types/index.js';
import * as maintenanceCenterService from '../services/maintenanceCenter.service.js';
import { recordAuditEvent } from '../platform/audit/auditEngine.service.js';
import { eventBus } from '../platform/event-bus/eventBus.service.js';

function getHotelId(req: AuthenticatedRequest) {
  const hotelId = req.user?.hotelId;
  if (!hotelId) throw new Error('hotelId is required');
  return hotelId;
}

function getUserId(req: AuthenticatedRequest) {
  const userId = req.user?.id;
  if (!userId) throw new Error('userId is required');
  return userId;
}

function getUserAgent(req: AuthenticatedRequest) {
  const userAgent = req.headers['user-agent'];
  return Array.isArray(userAgent) ? userAgent.join(', ') : userAgent;
}

const dateOrUndefined = (value?: string) => (value ? new Date(value) : undefined);

async function recordMaintenanceMutation(
  req: AuthenticatedRequest,
  action: string,
  entity: string,
  entityId: string,
  payload: Record<string, unknown>
) {
  const hotelId = getHotelId(req);
  const userId = getUserId(req);

  await recordAuditEvent({
    hotelId,
    actor: { userId, ipAddress: req.ip, userAgent: getUserAgent(req) },
    action,
    entity,
    entityId,
    details: payload,
    source: 'maintenance-center',
  });

  await eventBus.publish({
    eventType: `maintenance.${action.toLowerCase()}`,
    hotelId,
    source: 'maintenance-center',
    userId,
    payload: { entity, entityId, ...payload },
  });
}

export async function getOverview(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await maintenanceCenterService.getMaintenanceCenterOverview(getHotelId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listWorkOrders(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await maintenanceCenterService.listWorkOrders(getHotelId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createWorkOrder(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await maintenanceCenterService.createWorkOrder(getHotelId(req), {
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      location: req.body.location,
      assetName: req.body.assetName,
      assetExternalId: req.body.assetExternalId,
      priority: req.body.priority,
      status: req.body.status,
      assignedTo: req.body.assignedTo,
      dueAt: dateOrUndefined(req.body.dueAt),
    });
    await recordMaintenanceMutation(req, 'WORK_ORDER_CREATED', 'maintenance_work_order', data.id, {
      title: data.title,
      priority: data.priority,
      status: data.status,
      assignedTo: data.assignedTo,
      location: data.location,
    });
    res.status(201).json({ success: true, data, message: 'Work order created' });
  } catch (error) {
    next(error);
  }
}

export async function updateWorkOrder(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await maintenanceCenterService.updateWorkOrder(getHotelId(req), req.params.id, {
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      location: req.body.location,
      assetName: req.body.assetName,
      assetExternalId: req.body.assetExternalId,
      priority: req.body.priority,
      status: req.body.status,
      assignedTo: req.body.assignedTo,
      dueAt: dateOrUndefined(req.body.dueAt),
    });
    await recordMaintenanceMutation(req, 'WORK_ORDER_UPDATED', 'maintenance_work_order', data.id, {
      title: data.title,
      priority: data.priority,
      status: data.status,
      assignedTo: data.assignedTo,
      location: data.location,
    });
    res.json({ success: true, data, message: 'Work order updated' });
  } catch (error) {
    next(error);
  }
}

export async function listFaults(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await maintenanceCenterService.listFaults(getHotelId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createFault(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await maintenanceCenterService.createFault(getHotelId(req), {
      workOrderId: req.body.workOrderId,
      title: req.body.title,
      description: req.body.description,
      location: req.body.location,
      assetName: req.body.assetName,
      severity: req.body.severity,
      status: req.body.status,
    });
    await recordMaintenanceMutation(req, 'FAULT_CREATED', 'maintenance_fault', data.id, {
      title: data.title,
      severity: data.severity,
      status: data.status,
      location: data.location,
      workOrderId: data.workOrderId,
    });
    res.status(201).json({ success: true, data, message: 'Fault recorded' });
  } catch (error) {
    next(error);
  }
}

export async function listRepairs(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await maintenanceCenterService.listRepairs(getHotelId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createRepair(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await maintenanceCenterService.createRepair(getHotelId(req), {
      workOrderId: req.body.workOrderId,
      faultId: req.body.faultId,
      title: req.body.title,
      description: req.body.description,
      technician: req.body.technician,
      status: req.body.status,
      startedAt: dateOrUndefined(req.body.startedAt),
      completedAt: dateOrUndefined(req.body.completedAt),
      cost: req.body.cost,
    });
    await recordMaintenanceMutation(req, 'REPAIR_CREATED', 'maintenance_repair', data.id, {
      title: data.title,
      status: data.status,
      technician: data.technician,
      workOrderId: data.workOrderId,
      faultId: data.faultId,
    });
    res.status(201).json({ success: true, data, message: 'Repair recorded' });
  } catch (error) {
    next(error);
  }
}

export async function listPreventiveMaintenance(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await maintenanceCenterService.listPreventiveMaintenance(getHotelId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listAssets(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await maintenanceCenterService.listAssets(getHotelId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listSmartBuildingTasks(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await maintenanceCenterService.listSmartBuildingMaintenanceTasks(getHotelId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
