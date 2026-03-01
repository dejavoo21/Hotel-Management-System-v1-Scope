import { Router, Response, NextFunction } from 'express';
import { Department, TicketPriority } from '@prisma/client';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { createAssistantTicket } from '../services/ticketsFromAssistant.service.js';

const router = Router();

router.use(authenticate);
router.use(requireModuleAccess('bookings'));

type CreateTicketBody = {
  title?: string;
  reason?: string;
  department?: keyof typeof Department;
  priority?: keyof typeof TicketPriority;
  source?: string;
  details?: Record<string, unknown> | null;
};

router.post('/create-ticket', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const body = (req.body ?? {}) as CreateTicketBody;
    const title = String(body.title ?? '').trim();
    const reason = body.reason ? String(body.reason).trim() : undefined;

    if (!title) {
      res.status(400).json({ success: false, error: 'title is required' });
      return;
    }

    if (!body.department || !(body.department in Department)) {
      res.status(400).json({ success: false, error: 'Valid department is required' });
      return;
    }

    if (!body.priority || !(body.priority in TicketPriority)) {
      res.status(400).json({ success: false, error: 'Valid priority is required' });
      return;
    }

    const result = await createAssistantTicket({
      hotelId,
      userId,
      title,
      reason,
      department: Department[body.department],
      priority: TicketPriority[body.priority],
      source: body.source || 'OPS_ASSISTANT',
      details: body.details ?? null,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;

