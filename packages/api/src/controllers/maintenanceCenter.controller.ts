import { NextFunction, Response } from 'express';
import { ApiResponse, AuthenticatedRequest } from '../types/index.js';
import * as maintenanceCenterService from '../services/maintenanceCenter.service.js';

function getHotelId(req: AuthenticatedRequest) {
  const hotelId = req.user?.hotelId;
  if (!hotelId) throw new Error('hotelId is required');
  return hotelId;
}

const dateOrUndefined = (value?: string) => (value ? new Date(value) : undefined);

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
