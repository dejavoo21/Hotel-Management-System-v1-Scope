import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import * as accessRequestController from '../controllers/accessRequest.controller.js';

const router = Router();

const createSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email'),
  company: z.string().optional(),
  role: z.string().optional(),
  message: z.string().optional(),
});

const approveSchema = z.object({
  role: z.string().optional(),
});

const notesSchema = z.object({
  notes: z.string().min(1, 'Notes are required'),
});

router.post('/', validate(createSchema), accessRequestController.createAccessRequest);
router.get('/', authenticate, requireAdmin, accessRequestController.listAccessRequests);
router.get(
  '/:id/replies',
  authenticate,
  requireAdmin,
  accessRequestController.listAccessRequestReplies
);
router.get(
  '/:id/replies/:replyId/attachments/:index',
  authenticate,
  requireAdmin,
  accessRequestController.downloadAccessRequestAttachment
);
router.post(
  '/:id/approve',
  authenticate,
  requireAdmin,
  validate(approveSchema),
  accessRequestController.approveAccessRequest
);
router.post(
  '/:id/reject',
  authenticate,
  requireAdmin,
  validate(notesSchema),
  accessRequestController.rejectAccessRequest
);
router.post(
  '/:id/request-info',
  authenticate,
  requireAdmin,
  validate(notesSchema),
  accessRequestController.requestAccessInfo
);
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  accessRequestController.deleteAccessRequest
);

export default router;
