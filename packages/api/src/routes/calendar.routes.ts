import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';
import * as calendarController from '../controllers/calendar.controller.js';

const router = Router();

const createSchema = z.object({
  title: z.string().min(1),
  type: z.enum(['BOOKING', 'MAINTENANCE', 'HOUSEKEEPING', 'EVENT', 'OTHER']),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  startAt: z.string(),
  endAt: z.string(),
  roomId: z.string().optional(),
  bookingId: z.string().optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  type: z.enum(['BOOKING', 'MAINTENANCE', 'HOUSEKEEPING', 'EVENT', 'OTHER']).optional(),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  roomId: z.string().optional(),
  bookingId: z.string().optional(),
  notes: z.string().optional(),
});

router.use(authenticate);

// Require calendar module access
router.use(requireModuleAccess('calendar'));

router.get('/', calendarController.listCalendarEvents);
router.post('/', validate(createSchema), calendarController.createCalendarEvent);
router.patch('/:id', validate(updateSchema), calendarController.updateCalendarEvent);
router.delete('/:id', calendarController.deleteCalendarEvent);

export default router;
