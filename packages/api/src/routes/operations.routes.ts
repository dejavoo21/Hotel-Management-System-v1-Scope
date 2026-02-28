import { Router, Response, NextFunction } from 'express';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { getOperationsContext } from '../services/operationsContext.service.js';

const router = Router();

router.use(authenticate);
router.use(requireModuleAccess('bookings'));

router.get('/context', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const context = await getOperationsContext(hotelId);

    res.json({
      success: true,
      data: context,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
