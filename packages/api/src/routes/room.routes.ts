import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, requireManager, requireReceptionist, requireModuleAccess } from '../middleware/auth.js';
import * as roomController from '../controllers/room.controller.js';

const router = Router();

// Validation schemas
const createRoomSchema = z.object({
  roomTypeId: z.string().min(1, 'Room type is required'),
  number: z.string().min(1, 'Room number is required'),
  floor: z.number().int(),
  notes: z.string().optional(),
});

const updateRoomSchema = z.object({
  roomTypeId: z.string().optional(),
  number: z.string().optional(),
  floor: z.number().int().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'OUT_OF_SERVICE']),
  notes: z.string().optional(),
});

const updateHousekeepingSchema = z.object({
  housekeepingStatus: z.enum(['CLEAN', 'DIRTY', 'INSPECTION', 'OUT_OF_SERVICE']),
  notes: z.string().optional(),
});

const querySchema = z.object({
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'OUT_OF_SERVICE']).optional(),
  housekeepingStatus: z.enum(['CLEAN', 'DIRTY', 'INSPECTION', 'OUT_OF_SERVICE']).optional(),
  floor: z.string().optional(),
  roomTypeId: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

// All routes require authentication and rooms module access
router.use(authenticate);
router.use(requireModuleAccess('rooms'));

// Routes
router.get('/', validate(querySchema, 'query'), roomController.getAllRooms);
router.get('/availability', roomController.getAvailability);
router.get('/:id', roomController.getRoomById);
router.post('/', requireManager, validate(createRoomSchema), roomController.createRoom);
router.patch('/:id', requireManager, validate(updateRoomSchema), roomController.updateRoom);
router.delete('/:id', requireManager, roomController.deleteRoom);
router.patch('/:id/status', requireReceptionist, validate(updateStatusSchema), roomController.updateRoomStatus);
router.patch('/:id/housekeeping', validate(updateHousekeepingSchema), roomController.updateHousekeepingStatus);

export default router;
