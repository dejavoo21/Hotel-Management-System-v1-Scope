import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as securityCenterController from '../controllers/securityCenter.controller.js';

const router = Router();

const visitorSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  company: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  purpose: z.string().optional(),
  hostName: z.string().optional(),
  status: z.enum(['CHECKED_IN', 'CHECKED_OUT', 'DENIED']).optional(),
  notes: z.string().optional(),
});

router.use(authenticate);
router.use(requireModuleAccess('security_center'));

router.get('/overview', securityCenterController.getOverview);
router.get('/cctv', securityCenterController.listCctv);
router.get('/access-logs', securityCenterController.listAccessLogs);
router.get('/visitors', securityCenterController.listVisitors);
router.post('/visitors', validate(visitorSchema), securityCenterController.createVisitor);
router.patch('/visitors/:id/checkout', securityCenterController.checkoutVisitor);
router.get('/alerts', securityCenterController.listAlerts);
router.patch('/alerts/:id/acknowledge', securityCenterController.acknowledgeAlert);
router.patch('/alerts/:id/resolve', securityCenterController.resolveAlert);

export default router;
