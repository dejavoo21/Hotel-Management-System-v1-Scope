import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as presenceService from '../services/presence.service.js';
import type { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/presence/snapshot
 * Returns snapshot of all online users in the hotel + their presence status
 * Used for initial page load hydration
 */
router.get('/snapshot', async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const hotelId = req.user.hotelId;

    // Get online users from in-memory store
    const onlineUsers = presenceService.getHotelOnlineUsers(hotelId);
    const onlineUserIds = onlineUsers.map(u => u.userId);

    // Also fetch all hotel users with their presence status from DB
    // This gives us offline users' last known status too
    const allUsers = await prisma.user.findMany({
      where: { hotelId, isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        presenceStatus: true,
        lastSeenAt: true,
      },
    });

    // Merge online status with DB data
    const users = allUsers.map(user => {
      const onlineEntry = onlineUsers.find(o => o.userId === user.id);
      const isOnline = Boolean(onlineEntry);
      const presenceStatus = user.presenceStatus || 'AVAILABLE';
      
      return {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isOnline,
        presenceStatus,
        effectiveStatus: isOnline ? presenceStatus : 'OFFLINE',
        lastSeenAt: user.lastSeenAt,
      };
    });

    res.json({
      success: true,
      data: {
        onlineUserIds,
        users,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/presence/:userId
 * Get presence status for a specific user
 */
router.get('/:userId', async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    const presence = await presenceService.getUserPresence(userId);

    if (!presence) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: presence });
  } catch (error) {
    next(error);
  }
});

export default router;
