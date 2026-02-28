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
  getOpsContextForHotel,
  getWeatherOpsActions,
  logAiInteraction,
} from '../services/aiHooks.service.js';
import { getWeatherContextForHotel } from '../services/weatherContext.provider.js';
import { prisma } from '../config/database.js';

const router = Router();

router.use(authenticate);

type WeatherActionCreateTicketBody = {
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
      req.user!.id
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
      req.user!.id
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
      req.user!.id
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
      req.user!.id
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
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const body = (req.body ?? {}) as WeatherActionCreateTicketBody;

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

    const created = await prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          hotelId,
          subject: `[Weather Action] ${title.slice(0, 100)}`,
          status: 'OPEN',
          lastMessageAt: new Date(),
        },
      });

      await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderType: 'SYSTEM',
          senderUserId: userId,
          body: reason.slice(0, 500),
        },
      });

      const ticket = await tx.ticket.create({
        data: {
          hotelId,
          conversationId: conversation.id,
          type: 'GENERAL_INQUIRY',
          category: categoryForDepartment(department),
          department,
          priority,
          status: 'OPEN',
        },
        select: {
          id: true,
          status: true,
          department: true,
          priority: true,
        },
      });

      if (userId) {
        await tx.activityLog.create({
          data: {
            userId,
            action: 'WEATHER_ACTION_TICKET_CREATED',
            entity: 'ticket',
            entityId: ticket.id,
            details: {
              source: 'WEATHER_ACTIONS',
              title,
              reason,
              department,
              priority,
              weatherSyncedAtUtc: body.weatherSyncedAtUtc ?? null,
              aiGeneratedAtUtc: body.aiGeneratedAtUtc ?? null,
              conversationId: conversation.id,
            },
          },
        });
      }

      return { ticket, conversationId: conversation.id };
    });

    await logAiInteraction(
      'WEATHER_ACTIONS',
      JSON.stringify({ createTicket: true, hotelId, title }),
      {
        ticketId: created.ticket.id,
        department: created.ticket.department,
        priority: created.ticket.priority,
      },
      userId
    );

    res.json({
      success: true,
      data: {
        ticketId: created.ticket.id,
        status: created.ticket.status,
        department: created.ticket.department,
        conversationId: created.conversationId,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
