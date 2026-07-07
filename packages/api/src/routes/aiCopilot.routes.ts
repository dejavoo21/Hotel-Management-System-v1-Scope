import { Router } from 'express';
import { askAICopilot } from '../controllers/aiCopilot.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/copilot/ask', askAICopilot);

export default router;
