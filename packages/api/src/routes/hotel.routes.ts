import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, requireManager } from '../middleware/auth.js';
import * as hotelController from '../controllers/hotel.controller.js';

const router = Router();

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  timezone: z.string().min(1).optional(),
  currency: z.string().min(1).optional(),
});

router.use(authenticate);

router.get('/me', hotelController.getMyHotel);
router.patch('/me', requireManager, validate(updateSchema), hotelController.updateMyHotel);

export default router;
