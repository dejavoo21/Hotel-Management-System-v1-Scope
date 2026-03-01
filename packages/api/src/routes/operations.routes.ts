import { Router, Response, NextFunction } from 'express';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { getOperationsContext } from '../services/operationsContext.service.js';
import { Department, TicketCategory, TicketPriority } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AdvisoryPriority, routeOpsAdvisory } from '../services/opsRouting.rules.js';
import { pickAssigneeForDepartment } from '../services/opsAssignment.rules.js';
import { runOpsAssistant } from '../services/ai/opsAssistant.service.js';
import { getOpenAIClient, OPENAI_MODEL } from '../config/openai.js';

const router = Router();

router.use(authenticate);
router.use(requireModuleAccess('bookings'));

type OpsChatMode = 'general' | 'operations' | 'pricing' | 'weather';

type OpsChatBody = {
  message: string;
  mode?: OpsChatMode;
  context?: Record<string, unknown> | null;
  conversationId?: string | null;
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '');
}

async function generateOpsAssistantReply(args: {
  hotelId: string;
  userId: string;
  message: string;
  mode: OpsChatMode;
  context?: Record<string, unknown> | null;
  conversationId?: string;
}) {
  const { hotelId, userId, message, mode, context, conversationId } = args;

  const hasContext = Boolean(context && typeof context === 'object');
  if (!process.env.OPENAI_API_KEY || process.env.ASSISTANT_PROVIDER === 'none') {
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

    if (!hasContext) {
      return 'Load Operations Center context first for richer answers.';
    }
    return 'I can help with priorities, pricing guidance, weather risks, and creating tasks.';
  }

  const openai = getOpenAIClient();
  if (!openai) {
    const contextBlock = hasContext
      ? `\n\nMode: ${mode}\nContext:\n${JSON.stringify(context).slice(0, 6000)}`
      : `\n\nMode: ${mode}`;
    return runOpsAssistant({
      hotelId,
      userId,
      message: `${message}${contextBlock}`,
    });
  }

  const history = conversationId
    ? await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: 24,
        select: { senderType: true, body: true },
      })
    : [];

  const chatHistory = history.map((m) => ({
    role: m.senderType === 'SYSTEM' ? ('assistant' as const) : ('user' as const),
    content: m.body,
  }));

  const lastHistory = chatHistory.length ? chatHistory[chatHistory.length - 1] : null;
  const hasLatestUserMessage = lastHistory?.role === 'user' && lastHistory.content === message;
  const latestUserMessage = hasLatestUserMessage ? [] : [{ role: 'user' as const, content: message }];

  const systemPrompt = [
    'You are LaFlo Operations Concierge for a hotel team.',
    'You give concise, practical guidance.',
    'Never mention AI, model names, or training.',
    'If forecast data is missing or stale, recommend refreshing forecast.',
    'Do not claim competitor rates unless present in context.',
    `Mode: ${mode}`,
  ].join('\n');

  const contextText = hasContext ? JSON.stringify(context).slice(0, 6000) : null;

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL || 'gpt-5-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        ...(contextText ? [{ role: 'system' as const, content: `Context:\n${contextText}` }] : []),
        ...chatHistory,
        ...latestUserMessage,
      ],
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();
    if (reply) return reply;
  } catch {
    // Fall through to existing assistant runner.
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

const handleOpsChat = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;

    const body = (req.body ?? {}) as OpsChatBody;
    const message = asString(body.message).trim();
    const mode: OpsChatMode = body.mode ?? 'operations';
    const context = body.context ?? null;
    const incomingConversationId = body.conversationId ? asString(body.conversationId) : null;

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
      conversationId,
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

router.post('/assistant/chat', handleOpsChat);
router.post('/assistant/ops/chat', handleOpsChat);

router.get('/assistant/conversations/:conversationId/transcript', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const conversationId = String(req.params.conversationId);

    const convo = await prisma.conversation.findFirst({
      where: { id: conversationId, hotelId },
      select: { id: true, subject: true, createdAt: true, lastMessageAt: true },
    });

    if (!convo) {
      res.status(404).json({ success: false, error: 'Conversation not found' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        senderType: true,
        senderUserId: true,
        body: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      data: {
        conversation: convo,
        messages,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/assistant/conversations/:conversationId/transcript.txt', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const conversationId = String(req.params.conversationId);

    const convo = await prisma.conversation.findFirst({
      where: { id: conversationId, hotelId },
      select: { id: true, subject: true, createdAt: true },
    });

    if (!convo) {
      res.status(404).json({ success: false, error: 'Conversation not found' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: { senderType: true, body: true, createdAt: true },
    });

    const lines: string[] = [];
    lines.push(`Conversation: ${convo.subject ?? 'Operations Concierge'}`);
    lines.push(`Started: ${convo.createdAt.toISOString()}`);
    lines.push('---');

    for (const m of messages) {
      const who =
        m.senderType === 'STAFF' ? 'Staff' :
        m.senderType === 'GUEST' ? 'Guest' :
        'Assistant';
      lines.push(`[${m.createdAt.toISOString()}] ${who}: ${m.body}`);
    }

    const text = lines.join('\n');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transcript-${conversationId}.txt"`);
    res.status(200).send(text);
  } catch (error) {
    next(error);
  }
});

type CreateAdvisoryTicketBody = {
  advisoryId?: string;
  title?: string;
  reason?: string;
  priority?: string;
  department?: string;
  source?: string;
  meta?: {
    weatherSyncedAtUtc?: string | null;
    generatedAtUtc?: string | null;
  } | null;
};

type CreatePricingActionTicketBody = {
  nightDate?: string;
  action?: string;
  reason?: string;
  department?: string;
  priority?: string;
  confidence?: string;
  metadata?: Record<string, unknown> | null;
};

function mapTicketPriority(value: AdvisoryPriority, title: string, reason?: string): TicketPriority {
  const text = `${title} ${reason ?? ''}`.toLowerCase();
  const isUrgent = /(storm|thunder|lightning|flood|evacuat|safety|hazard|emergency)/.test(text);
  if (isUrgent) return 'URGENT';
  if (value === 'high') return 'HIGH';
  if (value === 'low') return 'LOW';
  return 'MEDIUM';
}

function parseTicketPriority(value?: string): TicketPriority {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'LOW') return 'LOW';
  if (normalized === 'HIGH') return 'HIGH';
  if (normalized === 'URGENT') return 'URGENT';
  return 'MEDIUM';
}

function parseDepartment(value?: string): Department {
  const normalized = String(value ?? '').trim().toUpperCase();
  switch (normalized) {
    case 'FRONT_DESK':
    case 'HOUSEKEEPING':
    case 'MAINTENANCE':
    case 'CONCIERGE':
    case 'BILLING':
    case 'MANAGEMENT':
      return normalized;
    default:
      return 'MANAGEMENT';
  }
}

function chooseDepartment(): Department {
  return 'MANAGEMENT';
}

function choosePriority(confidence: 'low' | 'medium' | 'high', pct: number): TicketPriority {
  if (confidence === 'high' && Math.abs(pct) >= 8) return 'HIGH';
  if (confidence === 'high') return 'MEDIUM';
  return 'LOW';
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

router.get('/context', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const context = await getOperationsContext(hotelId);

    res.json({
      success: true,
      data: context,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/advisories/create-ticket', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const body = (req.body ?? {}) as CreateAdvisoryTicketBody;
    const title = (body.title || '').trim();
    const reason = (body.reason || '').trim();
    const rawPriority = String(body.priority || '').trim().toLowerCase();

    const allowedPriorities = new Set(['low', 'medium', 'high']);
    if (!allowedPriorities.has(rawPriority)) {
      res.status(400).json({ success: false, error: 'priority must be low|medium|high' });
      return;
    }
    const advisoryPriority = rawPriority as AdvisoryPriority;
    const routed = routeOpsAdvisory({
      title,
      reason,
      priority: advisoryPriority,
    });
    const priority = mapTicketPriority(routed.priority, title, reason);
    const department: Department = routed.department;

    if (!title || !reason) {
      res.status(400).json({
        success: false,
        error: 'title, reason, priority are required',
      });
      return;
    }

    if (body.advisoryId && userId) {
      const dedupeSince = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const existingLog = await prisma.activityLog.findFirst({
        where: {
          userId,
          action: 'OPERATIONS_ADVISORY_TICKET_CREATED',
          entity: 'ticket',
          createdAt: { gte: dedupeSince },
          details: {
            path: ['advisoryId'],
            equals: body.advisoryId,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingLog?.entityId) {
        const existingTicket = await prisma.ticket.findFirst({
          where: {
            id: existingLog.entityId,
            hotelId,
          },
        select: {
          id: true,
          status: true,
          department: true,
          conversationId: true,
          assignedToId: true,
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

        if (existingTicket) {
          res.json({
            success: true,
            data: {
              ticketId: existingTicket.id,
              status: existingTicket.status,
              department: existingTicket.department,
              conversationId: existingTicket.conversationId,
              assignedToId: existingTicket.assignedToId,
              assignedTo: existingTicket.assignedTo,
              deduped: true,
            },
          });
          return;
        }
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          hotelId,
          subject: `[Operations Advisory] ${title.slice(0, 100)}`,
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
          assignedToId: await pickAssigneeForDepartment({
            tx,
            hotelId,
            department,
          }),
        },
        select: {
          id: true,
          status: true,
          department: true,
          priority: true,
          assignedToId: true,
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (userId) {
        await tx.activityLog.create({
          data: {
            userId,
            action: 'OPERATIONS_ADVISORY_TICKET_CREATED',
            entity: 'ticket',
            entityId: ticket.id,
            details: {
              source: body.source || 'WEATHER_ACTIONS',
              advisoryId: body.advisoryId || null,
              title,
              reason,
              requestedDepartment: body.department || null,
              department,
              priority: routed.priority,
              weatherSyncedAtUtc: body.meta?.weatherSyncedAtUtc ?? null,
              generatedAtUtc: body.meta?.generatedAtUtc ?? null,
              conversationId: conversation.id,
            },
          },
        });
      }

      return { ticket, conversationId: conversation.id };
    });

    res.json({
      success: true,
      data: {
        ticketId: created.ticket.id,
        status: created.ticket.status,
        department: created.ticket.department,
        conversationId: created.conversationId,
        assignedToId: created.ticket.assignedToId,
        assignedTo: created.ticket.assignedTo,
        deduped: false,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/pricing-actions/create-ticket', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const body = (req.body ?? {}) as CreatePricingActionTicketBody;
    const nightDate = String(body.nightDate ?? '').trim();
    const action = String(body.action ?? '').trim();
    const reason = String(body.reason ?? '').trim();
    const metadata = body.metadata ?? {};
    const rawSuggestedPct = Number((metadata as Record<string, unknown>)?.suggestedAdjustmentPct ?? 0);
    const suggestedAdjustmentPct = Number.isFinite(rawSuggestedPct) ? Math.round(rawSuggestedPct) : 0;
    const confidenceRaw = String(body.confidence ?? (metadata as Record<string, unknown>)?.confidence ?? 'low').toLowerCase();
    const confidence: 'low' | 'medium' | 'high' =
      confidenceRaw === 'high' ? 'high' : confidenceRaw === 'medium' ? 'medium' : 'low';
    const department = body.department ? parseDepartment(body.department) : chooseDepartment();
    const priority = body.priority ? parseTicketPriority(body.priority) : choosePriority(confidence, suggestedAdjustmentPct);
    const sourceKey = `PRICING:${nightDate}:${suggestedAdjustmentPct}`;

    if (!nightDate || !action || !reason) {
      res.status(400).json({
        success: false,
        error: 'nightDate, action, reason are required',
      });
      return;
    }

    const existing = await prisma.ticket.findFirst({
      where: { hotelId, sourceKey },
      select: {
        id: true,
        conversationId: true,
        status: true,
        department: true,
        priority: true,
        assignedToId: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (existing) {
      res.json({
        success: true,
        data: {
          ticketId: existing.id,
          status: existing.status,
          department: existing.department,
          priority: existing.priority,
          conversationId: existing.conversationId,
          assignedToId: existing.assignedToId,
          assignedTo: existing.assignedTo,
          deduped: true,
          ticketUrl: `/tickets/${existing.id}`,
        },
      });
      return;
    }

    const created = await prisma.$transaction(async (tx) => {
      const subject = `[Pricing Task] ${nightDate} - ${action}`.slice(0, 120);
      const conversation = await tx.conversation.create({
        data: {
          hotelId,
          subject,
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
          assignedToId: await pickAssigneeForDepartment({
            tx,
            hotelId,
            department,
          }),
          sourceKey,
          details: {
            source: 'PRICING_ACTION',
            nightDate,
            action,
            reason,
            metadata,
            createdByUserId: userId,
            createdAtUtc: new Date().toISOString(),
            confidence,
            suggestedAdjustmentPct,
          },
        },
        select: {
          id: true,
          conversationId: true,
          status: true,
          department: true,
          priority: true,
          assignedToId: true,
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      await tx.activityLog.create({
        data: {
          userId,
          action: 'PRICING_ACTION_TICKET_CREATED',
          entity: 'ticket',
          entityId: ticket.id,
          details: {
            source: 'PRICING_ACTION',
            nightDate,
            action,
            reason,
            department,
            priority,
            sourceKey,
            metadata,
            conversationId: conversation.id,
          },
        },
      });

      return ticket;
    });

    res.json({
      success: true,
      data: {
        ticketId: created.id,
        status: created.status,
        department: created.department,
        priority: created.priority,
        conversationId: created.conversationId,
        assignedToId: created.assignedToId,
        assignedTo: created.assignedTo,
        deduped: false,
        ticketUrl: `/tickets/${created.id}`,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
