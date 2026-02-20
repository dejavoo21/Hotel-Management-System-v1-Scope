import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as conciergeController from '../controllers/concierge.controller.js';

const router = Router();

const createSchema = z.object({
  guestId: z.string().optional(),
  roomId: z.string().optional(),
  bookingId: z.string().optional(),
  assignedToId: z.string().optional(),
  title: z.string().min(1),
  details: z.string().optional(),
  source: z.enum(['CHATBOT', 'APP', 'MANUAL']).optional(),
  notifySupport: z.boolean().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueAt: z.string().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  details: z.string().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedToId: z.string().optional(),
  dueAt: z.string().optional(),
});

router.use(authenticate);

router.get('/requests', conciergeController.listConciergeRequests);
router.post('/requests', validate(createSchema), conciergeController.createConciergeRequest);
router.patch('/requests/:id', validate(updateSchema), conciergeController.updateConciergeRequest);

export default router;
