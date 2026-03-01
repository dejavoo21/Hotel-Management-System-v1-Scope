import { Router, Response, NextFunction } from 'express';
import { MessageSender } from '@prisma/client';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { prisma } from '../config/database.js';
import { getOpenAIClient, OPENAI_MODEL } from '../config/openai.js';
import { getOpsContextForHotel, getWeatherOpsActions } from '../services/operationsContext.service.js';
import { getWeatherContextForHotel } from '../services/weatherContext.provider.js';

const router = Router();

router.use(authenticate);
router.use(requireModuleAccess('bookings'));

type ChatMode = 'general' | 'operations' | 'pricing' | 'weather';
type ChatBody = {
  message?: string;
  mode?: ChatMode;
  conversationId?: string;
};

function toSenderTypeForUser(): MessageSender {
  return MessageSender.STAFF;
}

function toSenderTypeForAssistant(): MessageSender {
  return MessageSender.SYSTEM;
}

function buildSystemPrompt(mode: ChatMode): string {
  return `
You are LaFlo Operations Concierge.
You help hotel staff make operational and pricing decisions using the provided context.
Style:
- Be concise and practical.
- Use bullets for actions.
- Never mention "AI", model names, or training data.
Rules:
- If forecast/pricing data is stale or missing, say what is missing and what to do next.
- Never claim competitor pricing unless it is explicitly present in context.
Mode: ${mode}
`.trim();
}

function compactContext(input: {
  hotelId: string;
  ops?: Record<string, unknown> | null;
  weather?: Record<string, unknown> | null;
  pricingSignal?: Record<string, unknown> | null;
  advisories?: unknown[];
}) {
  return {
    hotelId: input.hotelId,
    generatedAtUtc: new Date().toISOString(),
    ops: input.ops
      ? {
          arrivalsNext24h: input.ops.arrivalsNext24h,
          departuresNext24h: input.ops.departuresNext24h,
          inhouseNow: input.ops.inhouseNow,
          windowStartUtc: input.ops.windowStartUtc,
          windowEndUtc: input.ops.windowEndUtc,
        }
      : null,
    weather: input.weather
      ? {
          syncedAtUtc: input.weather.syncedAtUtc,
          isFresh: input.weather.isFresh,
          staleHours: input.weather.staleHours,
          location: input.weather.location,
          daysAvailable: input.weather.daysAvailable,
          next24h: input.weather.next24h,
        }
      : null,
    pricingSignal: input.pricingSignal ?? null,
    advisories: Array.isArray(input.advisories) ? input.advisories.slice(0, 5) : [],
  };
}

function fallbackReply(mode: ChatMode, message: string, context: ReturnType<typeof compactContext>): string {
  const lower = message.toLowerCase();
  const advisories = (context.advisories ?? []) as Array<{ title?: string; department?: string }>;
  const top = advisories
    .slice(0, 3)
    .map((a, i) => `${i + 1}. ${a.title ?? 'Advisory'} (${a.department ?? 'FRONT_DESK'})`)
    .join('\n');

  if (lower.includes('what needs attention') || lower.includes('today')) {
    return top ? `Top items needing attention:\n${top}` : 'No advisories right now. Refresh forecast/context and try again.';
  }

  if (mode === 'pricing') {
    const p = context.pricingSignal as { note?: string; confidence?: string } | null;
    if (!p) return 'No pricing signal available yet. Add booking pace and market rates.';
    return `Pricing guidance: ${p.note || 'Maintain current rates and monitor pace.'} (Confidence: ${p.confidence || 'low'})`;
  }

  if (mode === 'weather') {
    const w = context.weather as { next24h?: { summary?: string; rainRisk?: string } } | null;
    if (!w) return 'No weather context available yet. Refresh forecast first.';
    return `Weather outlook: ${w.next24h?.summary || 'No summary available'} (Rain risk: ${w.next24h?.rainRisk || 'unknown'}).`;
  }

  return 'I can help with operations priorities, pricing guidance, weather risks, and creating actionable tasks.';
}

router.post('/chat', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const body = (req.body ?? {}) as ChatBody;
    const message = String(body.message ?? '').trim();
    const mode: ChatMode = body.mode ?? 'operations';

    if (!message) {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    let conversationId = body.conversationId ? String(body.conversationId).trim() : '';

    if (conversationId) {
      const exists = await prisma.conversation.findFirst({
        where: { id: conversationId, hotelId },
        select: { id: true },
      });
      if (!exists) conversationId = '';
    }

    if (!conversationId) {
      const conversation = await prisma.conversation.create({
        data: {
          hotelId,
          subject: 'Operations Concierge',
          status: 'OPEN',
          lastMessageAt: new Date(),
        },
        select: { id: true },
      });
      conversationId = conversation.id;
    }

    await prisma.message.create({
      data: {
        conversationId,
        senderType: toSenderTypeForUser(),
        senderUserId: userId,
        body: message,
      },
    });

    const history = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 30,
      select: {
        senderType: true,
        body: true,
      },
    });

    const [weather, ops] = await Promise.all([
      getWeatherContextForHotel(hotelId).catch(() => null),
      getOpsContextForHotel(hotelId).catch(() => null),
    ]);

    const advisoriesResult = await getWeatherOpsActions(weather, ops ?? undefined).catch(() => ({
      actions: [],
      generatedAtUtc: new Date().toISOString(),
    }));

    const context = compactContext({
      hotelId,
      weather: weather as unknown as Record<string, unknown> | null,
      ops: ops as unknown as Record<string, unknown> | null,
      pricingSignal: null,
      advisories: advisoriesResult.actions,
    });

    const inputMessages = history.map((m) => ({
      role: m.senderType === MessageSender.SYSTEM ? ('assistant' as const) : ('user' as const),
      content: m.body,
    }));

    let reply = '';
    const openai = getOpenAIClient();

    if (openai) {
      const response = await openai.responses.create({
        model: OPENAI_MODEL || 'gpt-5-mini',
        input: [
          { role: 'system', content: buildSystemPrompt(mode) },
          { role: 'user', content: `Live Context:\n${JSON.stringify(context, null, 2)}` },
          ...inputMessages,
        ],
      });
      reply =
        (typeof response.output_text === 'string' && response.output_text.trim()) ||
        'I could not generate a response right now. Please try again.';
    } else {
      reply = fallbackReply(mode, message, context);
    }

    await prisma.message.create({
      data: {
        conversationId,
        senderType: toSenderTypeForAssistant(),
        senderUserId: null,
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
        conversationId,
        reply,
        generatedAtUtc: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
