import { Router, Response, NextFunction } from 'express';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { getOperationsContext } from '../services/operationsContext.service.js';
import { Department, TicketCategory, TicketPriority } from '@prisma/client';
import { prisma } from '../config/database.js';

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

const DEPARTMENT_VALUES = new Set<Department>([
  'FRONT_DESK',
  'HOUSEKEEPING',
  'MAINTENANCE',
  'CONCIERGE',
  'BILLING',
  'MANAGEMENT',
]);

function mapTicketPriority(value?: string): TicketPriority | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'high') return 'HIGH';
  if (normalized === 'low') return 'LOW';
  if (normalized === 'medium') return 'MEDIUM';
  return null;
}

function mapDepartment(value?: string): Department {
  const raw = String(value || '').trim();
  const upper = raw.toUpperCase();
  if (DEPARTMENT_VALUES.has(upper as Department)) return upper as Department;

  const cleaned = upper.replace(/\s+/g, '_');
  if (DEPARTMENT_VALUES.has(cleaned as Department)) return cleaned as Department;

  if (upper.includes('FRONT')) return 'FRONT_DESK';
  if (upper.includes('HOUSE')) return 'HOUSEKEEPING';
  if (upper.includes('MAINT')) return 'MAINTENANCE';
  if (upper.includes('CONCIERGE')) return 'CONCIERGE';
  if (upper.includes('BILL')) return 'BILLING';
  if (upper.includes('MANAG')) return 'MANAGEMENT';

  return 'FRONT_DESK';
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
    const priority = mapTicketPriority(rawPriority);
    const department = mapDepartment(body.department);

    const allowedPriorities = new Set(['low', 'medium', 'high']);
    if (!allowedPriorities.has(rawPriority)) {
      res.status(400).json({ success: false, error: 'priority must be low|medium|high' });
      return;
    }

    if (!title || !reason || !priority) {
      res.status(400).json({
        success: false,
        error: 'title, reason, priority, department are required',
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
            action: 'OPERATIONS_ADVISORY_TICKET_CREATED',
            entity: 'ticket',
            entityId: ticket.id,
            details: {
              source: body.source || 'WEATHER_ACTIONS',
              advisoryId: body.advisoryId || null,
              title,
              reason,
              department,
              priority,
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
        deduped: false,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
