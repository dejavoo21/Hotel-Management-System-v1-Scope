import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/notifications - Get notifications for current user
router.get('/', notificationController.getNotifications);

// GET /api/notifications/unread-count - Get unread count
router.get('/unread-count', notificationController.getUnreadCount);

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/:id/read', notificationController.markAsRead);

// POST /api/notifications/mark-all-read - Mark all as read
router.post('/mark-all-read', notificationController.markAllAsRead);

// DELETE /api/notifications/:id - Delete notification
router.delete('/:id', notificationController.deleteNotification);

export default router;
