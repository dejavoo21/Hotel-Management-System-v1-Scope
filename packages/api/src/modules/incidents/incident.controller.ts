import { NextFunction, Response } from 'express';
import { IncidentSeverity, IncidentStatus } from '@prisma/client';
import { AuthenticatedRequest, ApiResponse } from '../../types/index.js';
import * as incidentService from './incident.service.js';

function getHotelId(req: AuthenticatedRequest) {
  const hotelId = req.user?.hotelId;
  if (!hotelId) throw new Error('hotelId is required');
  return hotelId;
}

function getUserAgent(req: AuthenticatedRequest) {
  const userAgent = req.headers['user-agent'];
  return Array.isArray(userAgent) ? userAgent.join(', ') : userAgent;
}

function actor(req: AuthenticatedRequest) {
  return { userId: req.user?.id, ipAddress: req.ip, userAgent: getUserAgent(req) };
}

export async function overview(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await incidentService.getIncidentOverview(getHotelId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function list(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const status = typeof req.query.status === 'string' && req.query.status in IncidentStatus ? (req.query.status as IncidentStatus) : undefined;
    const severity =
      typeof req.query.severity === 'string' && req.query.severity in IncidentSeverity
        ? (req.query.severity as IncidentSeverity)
        : undefined;
    const data = await incidentService.listIncidents(getHotelId(req), {
      view: typeof req.query.view === 'string' ? req.query.view : undefined,
      assignedToId: req.user?.id,
      status,
      severity,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function get(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await incidentService.getIncident(getHotelId(req), req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function create(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await incidentService.createIncident({
      hotelId: getHotelId(req),
      ...req.body,
      createdById: req.user?.id,
      actor: actor(req),
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await incidentService.updateIncident(getHotelId(req), req.params.id, req.body, actor(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function acknowledge(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await incidentService.acknowledgeIncident(getHotelId(req), req.params.id, actor(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function resolve(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await incidentService.resolveIncident(getHotelId(req), req.params.id, actor(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function close(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await incidentService.closeIncident(getHotelId(req), req.params.id, actor(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function comment(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const data = await incidentService.addIncidentComment(getHotelId(req), req.params.id, req.body.body, req.user?.id, actor(req));
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
