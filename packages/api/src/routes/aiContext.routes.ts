import { Router } from 'express';
import { getHotelContext } from '../controllers/aiContext.controller.js';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Operations Center currently uses bookings access. ADMIN bypasses this via requireModuleAccess.
router.get('/context/hotel', requireModuleAccess('bookings', 'settings'), getHotelContext);

export default router;
