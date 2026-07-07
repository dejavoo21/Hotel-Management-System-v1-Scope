import { Role } from '@prisma/client';
import type { Response, NextFunction } from 'express';
import {
  approveAIRecommendation,
  expireAIRecommendation,
  getAIRecommendation,
  listAIRecommendations,
  rejectAIRecommendation,
} from '../ai/recommendations/index.js';
import { executeAIRecommendationAction } from '../ai/action-execution/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

function actorFrom(req: AuthenticatedRequest) {
  return {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null,
  };
}

function canGovernRecommendations(req: AuthenticatedRequest): boolean {
  if (!req.user) return false;
  if (req.user.role === Role.ADMIN || req.user.role === Role.MANAGER) return true;
  const permissions = req.user.modulePermissions || [];
  return permissions.includes('bookings') || permissions.includes('settings');
}

function requireGovernanceAccess(req: AuthenticatedRequest, res: Response): boolean {
  if (canGovernRecommendations(req)) return true;
  res.status(403).json({ success: false, error: 'AI recommendation governance requires Admin, Manager, or Operations access' });
  return false;
}

function recommendationActionInput(req: AuthenticatedRequest) {
  return {
    hotelId: req.user!.hotelId,
    recommendationId: req.params.id,
    actor: actorFrom(req),
  };
}

export async function listRecommendations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!requireGovernanceAccess(req, res)) return;
    const limit = Number(req.query.limit);
    const recommendations = await listAIRecommendations(req.user!.hotelId, {
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      limit: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 250)) : undefined,
    });
    res.json({ success: true, data: recommendations });
  } catch (error) {
    next(error);
  }
}

export async function getRecommendation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!requireGovernanceAccess(req, res)) return;
    const recommendation = await getAIRecommendation(req.user!.hotelId, req.params.id);
    res.json({ success: true, data: recommendation });
  } catch (error) {
    next(error);
  }
}

export async function approveRecommendation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!requireGovernanceAccess(req, res)) return;
    const recommendation = await approveAIRecommendation(recommendationActionInput(req));
    res.json({ success: true, data: recommendation });
  } catch (error) {
    next(error);
  }
}

export async function rejectRecommendation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!requireGovernanceAccess(req, res)) return;
    const rejectionReason = typeof req.body?.rejectionReason === 'string' ? req.body.rejectionReason.trim() : '';
    if (!rejectionReason) {
      res.status(400).json({ success: false, error: 'Rejection reason is required' });
      return;
    }
    const recommendation = await rejectAIRecommendation({
      ...recommendationActionInput(req),
      rejectionReason,
    });
    res.json({ success: true, data: recommendation });
  } catch (error) {
    next(error);
  }
}

export async function createRecommendationTask(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!requireGovernanceAccess(req, res)) return;
    const recommendation = await executeAIRecommendationAction({
      ...recommendationActionInput(req),
      actionType: 'CREATE_TASK',
    });
    res.json({ success: true, data: recommendation });
  } catch (error) {
    next(error);
  }
}

export async function executeRecommendationAction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!requireGovernanceAccess(req, res)) return;
    const actionType = typeof req.body?.actionType === 'string' ? req.body.actionType : 'CREATE_TASK';
    if (actionType !== 'CREATE_TASK') {
      res.status(400).json({ success: false, error: 'Unsupported actionType. Supported actionType: CREATE_TASK' });
      return;
    }
    const recommendation = await executeAIRecommendationAction({
      ...recommendationActionInput(req),
      actionType,
    });
    res.json({ success: true, data: recommendation });
  } catch (error) {
    next(error);
  }
}

export async function expireRecommendation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!requireGovernanceAccess(req, res)) return;
    const recommendation = await expireAIRecommendation(recommendationActionInput(req));
    res.json({ success: true, data: recommendation });
  } catch (error) {
    next(error);
  }
}
