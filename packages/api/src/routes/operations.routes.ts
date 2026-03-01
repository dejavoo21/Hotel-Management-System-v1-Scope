import { Router, Response, NextFunction } from 'express';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { getOperationsContext } from '../services/operationsContext.service.js';
import { Department, TicketCategory, TicketPriority } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AdvisoryPriority, routeOpsAdvisory } from '../services/opsRouting.rules.js';
import { pickAssigneeForDepartment } from '../services/opsAssignment.rules.js';

const router = Router();

router.use(authenticate);
router.use(requireModuleAccess('bookings'));

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
