import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, requireReceptionist, requireManager } from '../middleware/auth.js';
import * as invoiceController from '../controllers/invoice.controller.js';

const router = Router();

// Validation schemas
const querySchema = z.object({
  status: z.enum(['DRAFT', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'VOIDED']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID', 'VOIDED']),
});

const emailSchema = z.object({
  recipientEmail: z.string().email().optional(),
});

// All routes require authentication
router.use(authenticate);

// Routes
router.get('/', validate(querySchema, 'query'), invoiceController.getAllInvoices);
router.get('/:id', invoiceController.getInvoiceById);
router.get('/:id/pdf', invoiceController.generatePdf);
router.post('/booking/:bookingId', requireReceptionist, invoiceController.createInvoice);
router.patch('/:id/status', requireManager, validate(updateStatusSchema), invoiceController.updateInvoiceStatus);
router.post('/:id/send', requireReceptionist, validate(emailSchema), invoiceController.sendInvoiceEmail);

export default router;
