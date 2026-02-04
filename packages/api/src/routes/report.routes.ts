import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, requireManager } from '../middleware/auth.js';
import * as reportController from '../controllers/report.controller.js';

const router = Router();

// Validation schemas
const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  groupBy: z.enum(['day', 'week', 'month']).optional().default('day'),
});

// All routes require authentication and manager role
router.use(authenticate);
router.use(requireManager);

// Routes
router.get('/revenue', validate(dateRangeSchema, 'query'), reportController.getRevenueReport);
router.get('/occupancy', validate(dateRangeSchema, 'query'), reportController.getOccupancyReport);
router.get('/bookings', validate(dateRangeSchema, 'query'), reportController.getBookingsReport);
router.get('/sources', validate(dateRangeSchema, 'query'), reportController.getBookingSourcesReport);
router.get('/room-types', validate(dateRangeSchema, 'query'), reportController.getRoomTypePerformance);
router.get('/guests', validate(dateRangeSchema, 'query'), reportController.getGuestReport);
router.get('/summary', validate(dateRangeSchema, 'query'), reportController.getSummaryReport);

// Export
router.get('/export/:type', validate(dateRangeSchema, 'query'), reportController.exportReport);
router.post('/email', reportController.emailReport);

export default router;
