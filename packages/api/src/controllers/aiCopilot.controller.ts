import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import { askCopilot } from '../ai/copilot/index.js';
import type { AIContextSection } from '../ai/context/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

const contextSectionSchema = z.enum([
  'hotelProfile',
  'occupancy',
  'revenue',
  'weather',
  'bookings',
  'guests',
  'housekeeping',
  'maintenance',
  'security',
  'smartBuilding',
  'incidents',
  'tasks',
  'reviews',
  'messages',
  'financialSummary',
]);

const askCopilotSchema = z.object({
  question: z.string().trim().min(2).max(1000),
  contextScope: z.array(contextSectionSchema).optional(),
  linkedEntityType: z.string().trim().max(80).optional(),
  linkedEntityId: z.string().trim().max(120).optional(),
  saveAsRecommendation: z.boolean().optional(),
});

function actorFrom(req: AuthenticatedRequest) {
  return {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null,
  };
}

export async function askAICopilot(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const parsed = askCopilotSchema.parse(req.body || {});
    const response = await askCopilot(req.user!.hotelId, req.user!.id, parsed.question, {
      contextScope: parsed.contextScope as AIContextSection[] | undefined,
      linkedEntityType: parsed.linkedEntityType,
      linkedEntityId: parsed.linkedEntityId,
      saveAsRecommendation: parsed.saveAsRecommendation,
      actor: actorFrom(req),
    });
    res.json({ success: true, data: response });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid Copilot request',
        errors: error.errors.map((item) => ({
          field: item.path.join('.'),
          message: item.message,
        })),
      });
      return;
    }
    next(error);
  }
}
