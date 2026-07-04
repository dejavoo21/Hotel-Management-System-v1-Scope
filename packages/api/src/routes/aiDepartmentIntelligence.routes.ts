import { Router } from 'express';
import { getDepartmentBriefing } from '../controllers/aiDepartmentIntelligence.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/department/:department/briefing', getDepartmentBriefing);

export default router;
