import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as reviewController from '../controllers/review.controller.js';

const router = Router();

const createSchema = z.object({
  guestId: z.string().optional(),
  bookingId: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  source: z.enum(['DIRECT', 'BOOKING_COM', 'EXPEDIA', 'AIRBNB', 'GOOGLE', 'TRIPADVISOR', 'OTHER']),
  comment: z.string().optional(),
});

const responseSchema = z.object({
  response: z.string().min(1),
});

router.use(authenticate);

router.get('/', reviewController.listReviews);
router.post('/', validate(createSchema), reviewController.createReview);
router.patch('/:id/response', validate(responseSchema), reviewController.respondToReview);

export default router;
