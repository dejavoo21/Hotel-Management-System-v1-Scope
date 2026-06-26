import { NextFunction, Response } from 'express';
import { VisitorStatus } from '@prisma/client';
import { ApiResponse, AuthenticatedRequest } from '../types/index.js';
import * as securityCenterService from '../services/securityCenter.service.js';

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

export async function getOverview(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await securityCenterService.getSecurityCenterOverview(getHotelId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listCctv(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await securityCenterService.listCctv(getHotelId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listAccessLogs(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await securityCenterService.listAccessLogs(getHotelId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listVisitors(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await securityCenterService.listVisitors(getHotelId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createVisitor(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await securityCenterService.createVisitor(getHotelId(req), {
      fullName: req.body.fullName,
      company: req.body.company,
      phone: req.body.phone,
      email: req.body.email,
      purpose: req.body.purpose,
      hostName: req.body.hostName,
      notes: req.body.notes,
      status: req.body.status as VisitorStatus | undefined,
    });
    res.status(201).json({ success: true, data, message: 'Visitor recorded' });
  } catch (error) {
    next(error);
  }
}

export async function checkoutVisitor(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await securityCenterService.checkoutVisitor(getHotelId(req), req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listAlerts(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await securityCenterService.listAlerts(getHotelId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function acknowledgeAlert(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await securityCenterService.acknowledgeSecurityAlert(getHotelId(req), req.params.id, getUserId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function resolveAlert(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await securityCenterService.resolveSecurityAlert(getHotelId(req), req.params.id, getUserId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
