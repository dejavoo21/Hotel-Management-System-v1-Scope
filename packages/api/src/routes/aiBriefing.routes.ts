import { Router } from 'express';
import { getDailyGMBriefing } from '../controllers/aiBriefing.controller.js';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Operations Center currently uses bookings access. ADMIN bypasses this via requireModuleAccess.
router.get('/briefing/daily', requireModuleAccess('bookings', 'settings'), getDailyGMBriefing);

export default router;
