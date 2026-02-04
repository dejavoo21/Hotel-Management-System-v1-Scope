import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, requireReceptionist, requireManager } from '../middleware/auth.js';
import * as bookingController from '../controllers/booking.controller.js';

const router = Router();

// Validation schemas
const createBookingSchema = z.object({
  guestId: z.string().optional(), // Optional if creating new guest
  guest: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
  }).optional(),
  roomTypeId: z.string().optional(),
  roomId: z.string().optional(),
  checkInDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  checkOutDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  numberOfAdults: z.number().int().min(1).default(1),
  numberOfChildren: z.number().int().min(0).default(0),
  source: z.enum(['DIRECT', 'BOOKING_COM', 'EXPEDIA', 'AIRBNB', 'WALK_IN', 'PHONE', 'CORPORATE', 'WEBSITE']).default('DIRECT'),
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'STRIPE', 'CHECK', 'OTHER']).optional(),
  specialRequests: z.string().optional(),
  roomRate: z.number().positive().optional(),
}).refine(data => data.guestId || data.guest, {
  message: 'Either guestId or guest details must be provided',
});

const updateBookingSchema = z.object({
  roomId: z.string().nullable().optional(),
  checkInDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  checkOutDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  numberOfAdults: z.number().int().min(1).optional(),
  numberOfChildren: z.number().int().min(0).optional(),
  status: z.enum(['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW']).optional(),
  source: z.enum(['DIRECT', 'BOOKING_COM', 'EXPEDIA', 'AIRBNB', 'WALK_IN', 'PHONE', 'CORPORATE', 'WEBSITE']).optional(),
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'STRIPE', 'CHECK', 'OTHER']).optional(),
  specialRequests: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
  roomRate: z.number().positive().optional(),
});

const checkInSchema = z.object({
  roomId: z.string().min(1, 'Room must be assigned'),
  notes: z.string().optional(),
});

const checkOutSchema = z.object({
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'STRIPE', 'CHECK', 'OTHER']).optional(),
  paymentAmount: z.number().min(0).optional(),
  paymentReference: z.string().optional(),
  notes: z.string().optional(),
});

const addChargeSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  category: z.enum(['ROOM', 'EARLY_CHECKIN', 'LATE_CHECKOUT', 'EXTRA_BED', 'EXTRA_PERSON', 'MINIBAR', 'RESTAURANT', 'ROOM_SERVICE', 'SPA', 'LAUNDRY', 'PARKING', 'PHONE', 'DAMAGE', 'OTHER']),
  amount: z.number().positive('Amount must be positive'),
  quantity: z.number().int().min(1).default(1),
});

const confirmPaymentSchema = z.object({
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'STRIPE', 'CHECK', 'OTHER']).optional(),
});

const querySchema = z.object({
  status: z.enum(['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  guestId: z.string().optional(),
  roomId: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

// All routes require authentication
router.use(authenticate);

// Routes
router.get('/', validate(querySchema, 'query'), bookingController.getAllBookings);
router.get('/calendar', bookingController.getBookingsCalendar);
router.get('/availability', bookingController.checkAvailability);
router.get('/:id', bookingController.getBookingById);
router.post('/', requireReceptionist, validate(createBookingSchema), bookingController.createBooking);
router.patch('/:id', requireReceptionist, validate(updateBookingSchema), bookingController.updateBooking);
router.delete('/:id', requireManager, bookingController.cancelBooking);

// Check-in/Check-out
router.post('/:id/check-in', requireReceptionist, validate(checkInSchema), bookingController.checkIn);
router.post('/:id/check-out', requireReceptionist, validate(checkOutSchema), bookingController.checkOut);

// Charges
router.get('/:id/charges', bookingController.getBookingCharges);
router.post('/:id/charges', requireReceptionist, validate(addChargeSchema), bookingController.addCharge);
router.delete('/:id/charges/:chargeId', requireManager, bookingController.voidCharge);

// Payments
router.get('/:id/payments', bookingController.getBookingPayments);
router.post('/:id/payments', requireReceptionist, bookingController.addPayment);
router.post('/:id/payments/confirm', requireReceptionist, validate(confirmPaymentSchema), bookingController.confirmPayment);

export default router;
