/**
 * AI Hooks Routes - Backend-ready endpoints for AI integration
 * 
 * These endpoints provide:
 * - Intent detection from messages
 * - Suggested replies
 * - Recommended actions
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { Department, TicketCategory, TicketPriority } from '@prisma/client';
import {
  detectIntent,
  getSuggestedReplies,
  getRecommendedActions,
  logAiInteraction,
} from '../services/aiHooks.service.js';
import { getWeatherContextForHotel } from '../services/weatherContext.provider.js';
import { getOpsContextForHotel, getWeatherOpsActions } from '../services/operationsContext.service.js';
import { prisma } from '../config/database.js';
import { pickAssigneeForDepartment } from '../services/opsAssignment.rules.js';
import { createTask } from '../platform/tasks/taskEngine.service.js';

const router = Router();

router.use(authenticate);

type WeatherActionCreateTicketBody = {
  actionId?: string;
  title?: string;
  reason?: string;
  priority?: string;
  department?: string;
  weatherSyncedAtUtc?: string | null;
  aiGeneratedAtUtc?: string | null;
};

function parseTicketPriority(value?: string): TicketPriority | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === 'LOW' || normalized === 'MEDIUM' || normalized === 'HIGH' || normalized === 'URGENT') {
    return normalized;
  }
  return null;
}

function parseDepartment(value?: string): Department | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '_');
  if (Object.values(Department).includes(normalized as Department)) {
    return normalized as Department;
  }
  return null;
}

function categoryForDepartment(department: Department): TicketCategory {
  switch (department) {
    case 'HOUSEKEEPING':
      return 'HOUSEKEEPING';
    case 'MAINTENANCE':
      return 'MAINTENANCE';
    case 'CONCIERGE':
      return 'CONCIERGE';
    case 'BILLING':
      return 'BILLING';
    case 'MANAGEMENT':
      return 'COMPLAINT';
    case 'FRONT_DESK':
    default:
      return 'OTHER';
  }
}

async function createWeatherActionTicket(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
  actionIdParam?: string
) {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const body = (req.body ?? {}) as WeatherActionCreateTicketBody;
    const actionId = (actionIdParam || body.actionId || '').trim();

    const title = (body.title || '').trim();
    const reason = (body.reason || '').trim();
    const priority = parseTicketPriority(body.priority);
    const department = parseDepartment(body.department);

    if (!title || !reason || !priority || !department) {
      res.status(400).json({
        success: false,
        error: 'title, reason, priority, department are required',
      });
      return;
    }

    const assignedToId = await prisma.$transaction((tx) =>
      pickAssigneeForDepartment({
        tx,
        hotelId,
        department,
      })
    );

    const ticket = await createTask({
      hotelId,
      title: `[Weather Action] ${title.slice(0, 100)}`,
      description: reason,
      category: categoryForDepartment(department),
      department,
      priority,
      assignedToId,
      details: {
        source: 'WEATHER_ACTIONS',
        actionId: actionId || null,
        title,
        reason,
        weatherSyncedAtUtc: body.weatherSyncedAtUtc ?? null,
        aiGeneratedAtUtc: body.aiGeneratedAtUtc ?? null,
        createdAtUtc: new Date().toISOString(),
        createdByUserId: userId || null,
      },
      actor: { userId },
      source: 'ai',
      idempotencyKey: actionId ? `weather-action:${actionId}` : undefined,
    });

    await logAiInteraction(
      'WEATHER_ACTIONS',
      JSON.stringify({ createTicket: true, hotelId, title, actionId: actionId || null }),
      {
        ticketId: ticket.id,
        department: ticket.department,
        priority: ticket.priority,
      },
      userId,
      hotelId
    );

    res.json({
      success: true,
      data: {
        ticketId: ticket.id,
        status: ticket.status,
        department: ticket.department,
        conversationId: ticket.conversationId,
        source: 'WEATHER_ACTIONS',
        actionId: actionId || null,
        title,
        reason,
        priority,
        createdAtUtc: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/ai/intent
 * 
 * Detect intent from a message
 */
router.post('/intent', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    const intent = await detectIntent(message);

    // Log for analytics
    await logAiInteraction(
      'INTENT_DETECTION',
      message,
      intent,
      req.user!.id,
      req.user!.hotelId
    );

    res.json({
      success: true,
      data: intent,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/suggestions
 * 
 * Get suggested replies based on conversation context
 */
router.post('/suggestions', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { conversationId, message } = req.body;

    if (!conversationId) {
      res.status(400).json({ success: false, error: 'conversationId is required' });
      return;
    }

    // Optionally detect intent from the latest message
    let intent;
    if (message) {
      intent = await detectIntent(message);
    }

    const weather = await getWeatherContextForHotel(req.user!.hotelId);
    const suggestions = await getSuggestedReplies(conversationId, intent, {
      weather,
      latestMessage: message,
    });

    // Log for analytics
    await logAiInteraction(
      'SUGGESTED_REPLY',
      message || conversationId,
      suggestions,
      req.user!.id,
      req.user!.hotelId
    );

    res.json({
      success: true,
      data: {
        suggestions,
        intent,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/actions
 * 
 * Get recommended actions based on conversation and ticket state
 */
router.post('/actions', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { conversationId, ticketId, message } = req.body;

    if (!conversationId) {
      res.status(400).json({ success: false, error: 'conversationId is required' });
      return;
    }

    // Optionally detect intent from the latest message
    let intent;
    if (message) {
      intent = await detectIntent(message);
    }

    const weather = await getWeatherContextForHotel(req.user!.hotelId);
    const actions = await getRecommendedActions(conversationId, ticketId, intent, {
      weather,
      latestMessage: message,
    });

    // Log for analytics
    await logAiInteraction(
      'RECOMMENDED_ACTION',
      message || conversationId,
      actions,
      req.user!.id,
      req.user!.hotelId
    );

    res.json({
      success: true,
      data: {
        actions,
        intent,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/weather-actions
 *
 * Get weather-driven operational recommendations for hotel staff.
 */
router.post('/weather-actions', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const requestedHotelId = req.body?.hotelId as string | undefined;
    const hotelId = req.user!.hotelId;

    if (requestedHotelId && requestedHotelId !== hotelId) {
      res.status(403).json({ success: false, error: 'Forbidden for this hotelId' });
      return;
    }

    const [weather, ops] = await Promise.all([
      getWeatherContextForHotel(hotelId),
      getOpsContextForHotel(hotelId),
    ]);
    const result = await getWeatherOpsActions(weather, ops);

    await logAiInteraction(
      'WEATHER_ACTIONS',
      JSON.stringify({
        hotelId,
        weatherSyncedAtUtc: weather?.syncedAtUtc ?? null,
        opsContext: ops,
      }),
      result,
      req.user!.id,
      hotelId
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/weather-actions/create-ticket
 *
 * Create an executable ticket from a weather recommendation card.
 */
router.post('/weather-actions/create-ticket', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  return createWeatherActionTicket(req, res, next);
});

/**
 * POST /api/ai/weather-actions/:actionId/create-ticket
 *
 * Create an executable ticket from a weather recommendation card, with actionId in path.
 */
router.post('/weather-actions/:actionId/create-ticket', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  return createWeatherActionTicket(req, res, next, req.params.actionId);
});

export default router;
