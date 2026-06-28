import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as timelineController from '../controllers/timeline.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', timelineController.listTimelineEvents);

export default router;
