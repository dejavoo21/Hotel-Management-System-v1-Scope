import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';
import * as housekeepingController from '../controllers/housekeeping.controller.js';

const router = Router();

// Validation schemas
const updateStatusSchema = z.object({
  status: z.enum(['CLEAN', 'DIRTY', 'INSPECTION', 'OUT_OF_SERVICE']),
  notes: z.string().optional(),
});

const reportIssueSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

const updateIssueSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  notes: z.string().optional(),
});

const querySchema = z.object({
  status: z.enum(['CLEAN', 'DIRTY', 'INSPECTION', 'OUT_OF_SERVICE']).optional(),
  floor: z.string().optional(),
  priority: z.enum(['arrivals', 'departures', 'stayovers']).optional(),
});

// All routes require authentication and housekeeping module access
router.use(authenticate);
router.use(requireModuleAccess('housekeeping'));

// Routes
router.get('/rooms', validate(querySchema, 'query'), housekeepingController.getRoomsByStatus);
router.get('/summary', housekeepingController.getHousekeepingSummary);
router.get('/priority', housekeepingController.getPriorityRooms);
router.patch('/rooms/:roomId', validate(updateStatusSchema), housekeepingController.updateRoomStatus);
router.get('/history/:roomId', housekeepingController.getRoomHistory);

// Maintenance issues
router.get('/issues', housekeepingController.getMaintenanceIssues);
router.post('/rooms/:roomId/issues', validate(reportIssueSchema), housekeepingController.reportIssue);
router.patch('/issues/:issueId', validate(updateIssueSchema), housekeepingController.updateIssue);

export default router;
