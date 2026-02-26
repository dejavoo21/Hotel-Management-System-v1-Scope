import { Router, raw } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, requireReceptionist, requireManager, requireModuleAccess } from '../middleware/auth.js';
import * as paymentController from '../controllers/payment.controller.js';

const router = Router();

// Validation schemas
const createPaymentIntentSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  amount: z.number().positive('Amount must be positive'),
});

const recordPaymentSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  amount: z.number().positive('Amount must be positive'),
  method: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'CHECK', 'OTHER']),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

const refundSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

const emailSchema = z.object({
  recipientEmail: z.string().email().optional(),
});

const querySchema = z.object({
  bookingId: z.string().optional(),
  method: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'STRIPE', 'CHECK', 'OTHER']).optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

// Stripe webhook (no auth required, verified by signature)
router.post(
  '/stripe/webhook',
  raw({ type: 'application/json' }),
  paymentController.handleStripeWebhook
);

// All other routes require authentication
router.use(authenticate);

// Require financials module access
router.use(requireModuleAccess('financials'));

// Routes
router.get('/', validate(querySchema, 'query'), paymentController.getAllPayments);
router.get('/:id', paymentController.getPaymentById);
router.get('/:id/receipt/pdf', paymentController.downloadReceiptPdf);
router.post('/record', requireReceptionist, validate(recordPaymentSchema), paymentController.recordPayment);
router.post('/:id/refund', requireManager, validate(refundSchema), paymentController.refundPayment);
router.post('/:id/receipt/email', requireReceptionist, validate(emailSchema), paymentController.emailReceipt);

// Stripe integration
router.post('/stripe/create-intent', requireReceptionist, validate(createPaymentIntentSchema), paymentController.createPaymentIntent);
router.post('/stripe/confirm/:paymentIntentId', requireReceptionist, paymentController.confirmPayment);

export default router;
