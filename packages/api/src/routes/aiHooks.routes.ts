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
  logAiInteraction,
} from '../services/aiHooks.service.js';

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
      req.user!.hotelId,
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

    const suggestions = await getSuggestedReplies(conversationId, intent);

    // Log for analytics
    await logAiInteraction(
      req.user!.hotelId,
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

    const actions = await getRecommendedActions(conversationId, ticketId, intent);

    // Log for analytics
    await logAiInteraction(
      req.user!.hotelId,
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

export default router;
