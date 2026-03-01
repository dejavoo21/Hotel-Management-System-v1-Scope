import { Router, Response, NextFunction } from 'express';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { runOpsAssistant } from '../services/ai/opsAssistant.service.js';
import { prisma } from '../config/database.js';

const router = Router();

router.use(authenticate);
router.use(requireModuleAccess('bookings'));

type OpsChatMode = 'general' | 'operations' | 'pricing' | 'weather';
type OpsChatBody = {
  message?: string;
  mode?: OpsChatMode;
  context?: Record<string, unknown> | null;
  conversationId?: string | null;
};

const handleOpsChat = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const body = (req.body ?? {}) as OpsChatBody;
    const message = String(body.message ?? '').trim();
    const mode: OpsChatMode = body.mode ?? 'operations';
    const context = body.context ?? null;
    const incomingConversationId = body.conversationId ? String(body.conversationId).trim() : '';

    if (!message) {
      res.status(400).json({ success: false, error: 'message is required' });
      return;
    }

    let conversation = null as { id: string } | null;

    if (incomingConversationId) {
      conversation = await prisma.conversation.findFirst({
        where: { id: incomingConversationId, hotelId },
        select: { id: true },
      });
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          hotelId,
          subject: `Operations Concierge (${mode})`,
          status: 'OPEN',
          lastMessageAt: new Date(),
        },
        select: { id: true },
      });
    }

    const conversationId = conversation.id;

    await prisma.message.create({
      data: {
        conversationId,
        senderType: 'STAFF',
        senderUserId: userId,
        body: message,
      },
    });

    const reply = await generateOpsAssistantReply({
      hotelId,
      userId,
      message,
      mode,
      context,
    });

    await prisma.message.create({
      data: {
        conversationId,
        senderType: 'SYSTEM',
        body: reply,
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    res.json({
      success: true,
      data: {
        reply,
        mode,
        generatedAtUtc: new Date().toISOString(),
        conversationId,
      },
    });
  } catch (error) {
    next(error);
  }
};

router.post('/chat', handleOpsChat);
router.post('/ops/chat', handleOpsChat);

router.post('/ops', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const message = String(req.body?.message ?? '').trim();

    if (!message) {
      res.status(400).json({ success: false, error: 'message is required' });
      return;
    }

    const reply = await runOpsAssistant({ hotelId, userId, message });

    res.json({
      success: true,
      data: { reply },
    });
  } catch (error) {
    next(error);
  }
});

async function generateOpsAssistantReply(args: {
  hotelId: string;
  userId: string;
  message: string;
  mode: OpsChatMode;
  context?: Record<string, unknown> | null;
}): Promise<string> {
  const { hotelId, userId, message, mode, context } = args;

  const hasContext = Boolean(context && typeof context === 'object');
  const help = [
    'I can help with:',
    "- Today's priorities (advisories)",
    '- Pricing guidance (rate suggestions + market coverage)',
    '- Weather impact (risk + next 24h)',
    '- Creating tasks from advisories',
  ].join('\n');

  // Fallback mode: useful without model/runtime provider configured.
  if (!process.env.OPENAI_API_KEY || process.env.ASSISTANT_PROVIDER === 'none') {
    if (!hasContext) return `${help}\n\nLoad Operations Center context first for richer answers.`;

    const advisories = Array.isArray(context?.advisories) ? context.advisories : [];
    const top = advisories
      .slice(0, 3)
      .map((a: any, i: number) => `${i + 1}. ${a?.title ?? 'Advisory'} (${a?.department ?? 'FRONT_DESK'})`)
      .join('\n');

    const lower = message.toLowerCase();
    if (lower.includes('what needs attention') || lower.includes('today')) {
      return top
        ? `Here are the top items needing attention:\n${top}`
        : 'No advisories available right now. Refresh context and forecast.';
    }

    if (mode === 'pricing') {
      const p: any = context?.pricingSignal ?? context?.pricing;
      if (!p) return 'No pricing signal available yet. Add booking pace data or market rates.';
      return `Pricing guidance: ${p.note || 'Keep current rates and monitor booking pace.'} (Confidence: ${p.confidence || 'low'})`;
    }

    if (mode === 'weather') {
      const w: any = context?.weather;
      if (!w) return 'No weather context available yet. Refresh forecast first.';
      return `Weather outlook: ${w?.next24h?.summary || 'No summary available'} (Rain risk: ${w?.next24h?.rainRisk || 'unknown'}).`;
    }

    return `${help}\n\nTry: "What needs attention today?" or "What's the pricing guidance?"`;
  }

  const contextBlock = hasContext
    ? `\n\nMode: ${mode}\nContext:\n${JSON.stringify(context).slice(0, 6000)}`
    : `\n\nMode: ${mode}`;

  return runOpsAssistant({
    hotelId,
    userId,
    message: `${message}${contextBlock}`,
  });
}

export default router;
