import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireManager } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as weatherSignalController from '../controllers/weatherSignal.controller.js';

const router = Router();

const hotelIdQuerySchema = z.object({
  hotelId: z.string().min(1).optional(),
});

router.use(authenticate);

router.get('/status', requireManager, validate(hotelIdQuerySchema, 'query'), weatherSignalController.getWeatherStatus);
router.get('/latest', requireManager, validate(hotelIdQuerySchema, 'query'), weatherSignalController.getWeatherLatest);
router.post('/sync', requireManager, validate(hotelIdQuerySchema, 'query'), weatherSignalController.syncWeather);

export default router;

