import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import * as notificationService from '../services/notification.service';

/**
 * Get notifications for current user
 */
export async function getNotifications(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const hotelId = req.user?.hotelId;

    if (!userId || !hotelId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { isRead, type, page, limit } = req.query;

    const result = await notificationService.getNotifications(
      userId,
      hotelId,
      {
        isRead: isRead !== undefined ? isRead === 'true' : undefined,
        type: type as any,
      },
      {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      }
    );

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const hotelId = req.user?.hotelId;

    if (!userId || !hotelId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const count = await notificationService.getUnreadCount(userId, hotelId);

    return res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch unread count' });
  }
}

/**
 * Mark a notification as read
 */
export async function markAsRead(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    await notificationService.markAsRead(id, userId);

    return res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const hotelId = req.user?.hotelId;

    if (!userId || !hotelId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const result = await notificationService.markAllAsRead(userId, hotelId);

    return res.json({ 
      success: true, 
      message: `${result.count} notification(s) marked as read` 
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({ success: false, message: 'Failed to mark notifications as read' });
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    await notificationService.deleteNotification(id, userId);

    return res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete notification' });
  }
}
