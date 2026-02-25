import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, requireReceptionist, requireManager, requireModuleAccess } from '../middleware/auth.js';
import * as guestController from '../controllers/guest.controller.js';

const router = Router();

// Validation schemas
const createGuestSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  idType: z.string().optional().nullable(),
  idNumber: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  dateOfBirth: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
  vipStatus: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

const updateGuestSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  idType: z.string().nullable().optional(),
  idNumber: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  dateOfBirth: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
  vipStatus: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

const querySchema = z.object({
  search: z.string().optional(),
  vipStatus: z.enum(['true', 'false']).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

// All routes require authentication and guests module access
router.use(authenticate);
router.use(requireModuleAccess('guests'));

// Routes
router.get('/', validate(querySchema, 'query'), guestController.getAllGuests);
router.get('/search', guestController.searchGuests);
router.get('/:id', guestController.getGuestById);
router.get('/:id/history', guestController.getGuestHistory);
router.post('/', requireReceptionist, validate(createGuestSchema), guestController.createGuest);
router.patch('/:id', requireReceptionist, validate(updateGuestSchema), guestController.updateGuest);
router.delete('/:id', requireManager, guestController.deleteGuest);

export default router;
