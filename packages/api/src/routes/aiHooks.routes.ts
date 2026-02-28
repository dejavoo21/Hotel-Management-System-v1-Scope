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
import {
  detectIntent,
  getSuggestedReplies,
  getRecommendedActions,
  getOpsContextForHotel,
  getWeatherOpsActions,
  logAiInteraction,
} from '../services/aiHooks.service.js';
import { getWeatherContextForHotel } from '../services/weatherContext.provider.js';

const router = Router();

router.use(authenticate);

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

export default router;
