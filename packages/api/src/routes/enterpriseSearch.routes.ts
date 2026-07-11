import { Router } from 'express';
import { askHotelBrain, rebuild, search } from '../controllers/enterpriseSearch.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', search);
router.post('/rebuild', rebuild);
router.post('/hotel-brain/ask', askHotelBrain);

export default router;
