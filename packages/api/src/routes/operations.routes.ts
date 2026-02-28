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
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
