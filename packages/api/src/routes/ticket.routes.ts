/**
 * Ticket Routes - CRUD operations for support tickets
 *
 * Protected by user authentication.
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import {
  listTickets,
  getTicketById,
  getTicketByConversationId,
  updateTicket,
  assignTicket,
  resolveTicket,
  closeTicket,
  backfillTicketsForConversations,
} from '../services/ticket.service.js';
import { TicketStatus, TicketPriority, Department, TicketCategory } from '@prisma/client';

const router = Router();

router.use(authenticate);

/**
 * GET /api/tickets
 *
 * List tickets for the authenticated user's hotel.
 * Supports filtering by status, priority, department, category, assignedToId.
 */
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const {
      status,
      priority,
      department,
      category,
      assignedToId,
      page,
      limit,
    } = req.query;

    const result = await listTickets(hotelId, {
      status: status as TicketStatus | undefined,
      priority: priority as TicketPriority | undefined,
      department: department as Department | undefined,
      category: category as TicketCategory | undefined,
      assignedToId: assignedToId as string | undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tickets/:id
 *
 * Get a single ticket by ID.
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const ticket = await getTicketById(id);

    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found' });
      return;
    }

    // Verify user has access to this hotel's ticket
    if (ticket.hotelId !== req.user!.hotelId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    res.json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tickets/conversation/:conversationId
 *
 * Get ticket by conversation ID.
 */
router.get('/conversation/:conversationId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { conversationId } = req.params;
    const ticket = await getTicketByConversationId(conversationId);

    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found for this conversation' });
      return;
    }

    // Verify user has access to this hotel's ticket
    if (ticket.hotelId !== req.user!.hotelId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    res.json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/tickets/:id
 *
 * Update a ticket (status, priority, department, category, assignment).
 */
router.patch('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, priority, department, category, assignedToId } = req.body;

    // First verify ticket exists and user has access
    const existing = await getTicketById(id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Ticket not found' });
      return;
    }

    if (existing.hotelId !== req.user!.hotelId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const ticket = await updateTicket(
      id,
      {
        status: status as TicketStatus | undefined,
        priority: priority as TicketPriority | undefined,
        department: department as Department | undefined,
        category: category as TicketCategory | undefined,
        assignedToId: assignedToId !== undefined ? assignedToId : undefined,
      },
      req.user!.id
    );

    res.json({ success: true, data: ticket, message: 'Ticket updated' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tickets/:id/assign
 *
 * Assign a ticket to a user.
 */
router.post('/:id/assign', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { assignedToId } = req.body;

    // Verify ticket exists and user has access
    const existing = await getTicketById(id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Ticket not found' });
      return;
    }

    if (existing.hotelId !== req.user!.hotelId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const ticket = await assignTicket(id, assignedToId || null, req.user!.id);

    res.json({ success: true, data: ticket, message: assignedToId ? 'Ticket assigned' : 'Ticket unassigned' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tickets/:id/resolve
 *
 * Mark a ticket as resolved.
 */
router.post('/:id/resolve', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await getTicketById(id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Ticket not found' });
      return;
    }

    if (existing.hotelId !== req.user!.hotelId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const ticket = await resolveTicket(id, req.user!.id);

    res.json({ success: true, data: ticket, message: 'Ticket resolved' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tickets/:id/close
 *
 * Mark a ticket as closed.
 */
router.post('/:id/close', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await getTicketById(id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Ticket not found' });
      return;
    }

    if (existing.hotelId !== req.user!.hotelId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const ticket = await closeTicket(id, req.user!.id);

    res.json({ success: true, data: ticket, message: 'Ticket closed' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tickets/backfill
 *
 * Backfill tickets for all existing conversations without tickets.
 * Admin only.
 */
router.post('/backfill', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Only allow admin/manager to run backfill
    if (!['ADMIN', 'MANAGER'].includes(req.user!.role)) {
      res.status(403).json({ success: false, error: 'Admin or Manager role required' });
      return;
    }

    const result = await backfillTicketsForConversations();

    res.json({
      success: true,
      data: result,
      message: `Backfill complete: ${result.created} tickets created, ${result.skipped} skipped`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
