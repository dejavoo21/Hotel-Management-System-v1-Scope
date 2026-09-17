import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import * as roomTypeController from '../controllers/roomType.controller.js';

const roomImageSchema = z.string().max(3_000_000, 'Room image is too large').refine((value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' || (parsed.protocol === 'data:' && /^data:image\/(?:jpeg|png|webp);base64,/i.test(value));
  } catch {
    return false;
  }
}, 'Room image must be a valid image URL or upload');

const router = Router();

// Validation schemas
const createRoomTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  description: z.string().optional(),
  baseRate: z.number().positive('Base rate must be positive'),
  maxGuests: z.number().int().min(1).max(10).default(2),
  maxChildren: z.number().int().min(0).max(10).default(0),
  amenities: z.array(z.string()).default([]),
  images: z.array(roomImageSchema).max(1, 'Only one preferred room image is supported').default([]),
});

const updateRoomTypeSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().nullable().optional(),
  baseRate: z.number().positive().optional(),
  maxGuests: z.number().int().min(1).max(10).optional(),
  maxChildren: z.number().int().min(0).max(10).optional(),
  amenities: z.array(z.string()).optional(),
  images: z.array(roomImageSchema).max(1, 'Only one preferred room image is supported').optional(),
  isActive: z.boolean().optional(),
});

// All routes require authentication
router.use(authenticate);

// Routes
router.get('/', roomTypeController.getAllRoomTypes);
router.get('/:id', roomTypeController.getRoomTypeById);
router.post('/', requireAdmin, validate(createRoomTypeSchema), roomTypeController.createRoomType);
router.patch('/:id', requireAdmin, validate(updateRoomTypeSchema), roomTypeController.updateRoomType);
router.delete('/:id', requireAdmin, roomTypeController.deleteRoomType);

export default router;
