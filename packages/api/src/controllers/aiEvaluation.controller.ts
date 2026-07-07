import type { Response, NextFunction } from 'express';
import {
  listAIEvaluationCases,
  runAllEvaluationCases,
  runEvaluationCase,
} from '../ai/evaluation/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

function actorFrom(req: AuthenticatedRequest) {
  return {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null,
  };
}

export async function listEvaluationCases(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: listAIEvaluationCases() });
  } catch (error) {
    next(error);
  }
}

export async function runEvaluation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const caseId = typeof req.body?.caseId === 'string' ? req.body.caseId.trim() : '';
    if (!caseId) {
      res.status(400).json({ success: false, error: 'caseId is required' });
      return;
    }
    const result = await runEvaluationCase(caseId, {
      hotelId: req.user!.hotelId,
      actor: actorFrom(req),
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function runAllEvaluations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await runAllEvaluationCases({
      hotelId: req.user!.hotelId,
      actor: actorFrom(req),
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
