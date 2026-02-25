import { prisma } from '../config/database';
import type { NotificationType, Prisma } from '@prisma/client';

/**
 * Notification Service
 * Handles creating and managing notifications for users
 */

export interface CreateNotificationData {
  userId: string;
  hotelId: string;
  type: NotificationType;
  title: string;
  body: string;
  ticketId?: string;
  conversationId?: string;
}

export interface NotificationFilters {
  isRead?: boolean;
  type?: NotificationType;
}

/**
 * Create a notification for a user
 */
export async function createNotification(data: CreateNotificationData) {
  return prisma.notification.create({
    data: {
      userId: data.userId,
      hotelId: data.hotelId,
      type: data.type,
      title: data.title,
      body: data.body,
      ticketId: data.ticketId,
      conversationId: data.conversationId,
    },
  });
}

/**
 * Create notifications for multiple users (e.g., all managers)
 */
export async function createNotificationsForUsers(
  userIds: string[],
  data: Omit<CreateNotificationData, 'userId'>
) {
  if (userIds.length === 0) return [];

  const notifications = userIds.map((userId) => ({
    userId,
    hotelId: data.hotelId,
    type: data.type,
    title: data.title,
    body: data.body,
    ticketId: data.ticketId,
    conversationId: data.conversationId,
  }));

  return prisma.notification.createMany({
    data: notifications,
  });
}

/**
 * Create notifications for users by role
 */
export async function createNotificationsForRoles(
  hotelId: string,
  roles: string[],
  data: Omit<CreateNotificationData, 'userId' | 'hotelId'>
) {
  // Find all active users with the specified roles
  const users = await prisma.user.findMany({
    where: {
      hotelId,
      role: { in: roles as any },
      isActive: true,
    },
    select: { id: true },
  });

  if (users.length === 0) return { count: 0 };

  return createNotificationsForUsers(
    users.map((u) => u.id),
    { hotelId, ...data }
  );
}

/**
 * Get notifications for a user
 */
export async function getNotifications(
  userId: string,
  hotelId: string,
  filters: NotificationFilters = {},
  pagination: { page?: number; limit?: number } = {}
) {
  const { page = 1, limit = 50 } = pagination;
  const skip = (page - 1) * limit;

  const where: Prisma.NotificationWhereInput = {
    userId,
    hotelId,
    ...(filters.isRead !== undefined && { isRead: filters.isRead }),
    ...(filters.type && { type: filters.type }),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { userId, hotelId, isRead: false },
    }),
  ]);

  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    unreadCount,
  };
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string, hotelId: string) {
  return prisma.notification.count({
    where: { userId, hotelId, isRead: false },
  });
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string, hotelId: string) {
  return prisma.notification.updateMany({
    where: {
      userId,
      hotelId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string, userId: string) {
  return prisma.notification.deleteMany({
    where: {
      id: notificationId,
      userId,
    },
  });
}

/**
 * Delete old notifications (cleanup job)
 */
export async function deleteOldNotifications(daysOld: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return prisma.notification.deleteMany({
    where: {
      isRead: true,
      createdAt: { lt: cutoffDate },
    },
  });
}

// =============================================
// Ticket-specific notification helpers
// =============================================

/**
 * Notify user of ticket assignment
 */
export async function notifyTicketAssigned(
  ticketId: string,
  conversationId: string,
  assignedToId: string,
  hotelId: string,
  ticketCategory: string
) {
  return createNotification({
    userId: assignedToId,
    hotelId,
    type: 'TICKET_ASSIGNED',
    title: 'Ticket Assigned',
    body: `You have been assigned a ${ticketCategory.toLowerCase()} ticket.`,
    ticketId,
    conversationId,
  });
}

/**
 * Notify managers when a ticket is escalated
 */
export async function notifyTicketEscalated(
  ticketId: string,
  conversationId: string,
  hotelId: string,
  escalatedLevel: number,
  ticketCategory: string,
  notifyRoles: string[] = ['MANAGER', 'ADMIN']
) {
  return createNotificationsForRoles(hotelId, notifyRoles, {
    type: 'TICKET_ESCALATED',
    title: `Ticket Escalated (Level ${escalatedLevel})`,
    body: `A ${ticketCategory.toLowerCase()} ticket has been escalated to level ${escalatedLevel}. Immediate attention required.`,
    ticketId,
    conversationId,
  });
}

/**
 * Notify when SLA is breached
 */
export async function notifySlaBreach(
  ticketId: string,
  conversationId: string,
  hotelId: string,
  breachType: 'response' | 'resolution',
  ticketCategory: string
) {
  return createNotificationsForRoles(hotelId, ['MANAGER', 'ADMIN'], {
    type: 'TICKET_BREACHED',
    title: 'SLA Breach',
    body: `${breachType === 'response' ? 'Response' : 'Resolution'} SLA breached for a ${ticketCategory.toLowerCase()} ticket.`,
    ticketId,
    conversationId,
  });
}
