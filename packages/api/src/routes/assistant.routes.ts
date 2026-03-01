import { Router, Response, NextFunction } from 'express';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { runOpsAssistant } from '../services/ai/opsAssistant.service.js';

const router = Router();

router.use(authenticate);
router.use(requireModuleAccess('bookings'));

router.post('/ops', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const message = String(req.body?.message ?? '').trim();

    if (!message) {
      res.status(400).json({ success: false, error: 'message is required' });
      return;
    }

    const reply = await runOpsAssistant({ hotelId, userId, message });

    res.json({
      success: true,
      data: { reply },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

