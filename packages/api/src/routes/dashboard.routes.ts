import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

// Dashboard endpoints
router.get('/summary', dashboardController.getSummary);
router.get('/arrivals', dashboardController.getTodayArrivals);
router.get('/departures', dashboardController.getTodayDepartures);
router.get('/housekeeping-summary', dashboardController.getHousekeepingSummary);
router.get('/priorities', dashboardController.getPriorities);
router.get('/occupancy-trend', dashboardController.getOccupancyTrend);
router.get('/booking-mix', dashboardController.getBookingMix);

export default router;
