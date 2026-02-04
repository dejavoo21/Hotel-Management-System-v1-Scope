import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, requireManager } from '../middleware/auth.js';
import * as roomTypeController from '../controllers/roomType.controller.js';

const router = Router();

// Validation schemas
const createRoomTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  description: z.string().optional(),
  baseRate: z.number().positive('Base rate must be positive'),
  maxGuests: z.number().int().min(1).max(10).default(2),
  maxChildren: z.number().int().min(0).max(10).default(0),
  amenities: z.array(z.string()).default([]),
  images: z.array(z.string().url()).default([]),
});

const updateRoomTypeSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().nullable().optional(),
  baseRate: z.number().positive().optional(),
  maxGuests: z.number().int().min(1).max(10).optional(),
  maxChildren: z.number().int().min(0).max(10).optional(),
  amenities: z.array(z.string()).optional(),
  images: z.array(z.string().url()).optional(),
  isActive: z.boolean().optional(),
});

// All routes require authentication
router.use(authenticate);

// Routes
router.get('/', roomTypeController.getAllRoomTypes);
router.get('/:id', roomTypeController.getRoomTypeById);
router.post('/', requireManager, validate(createRoomTypeSchema), roomTypeController.createRoomType);
router.patch('/:id', requireManager, validate(updateRoomTypeSchema), roomTypeController.updateRoomType);
router.delete('/:id', requireManager, roomTypeController.deleteRoomType);

export default router;
