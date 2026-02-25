import { api } from './api';

// Types matching the backend
export type NotificationType = 
  | 'TICKET_ASSIGNED'
  | 'TICKET_ESCALATED'
  | 'TICKET_BREACHED'
  | 'TICKET_UPDATED'
  | 'TICKET_RESOLVED'
  | 'MESSAGE_RECEIVED'
  | 'SYSTEM';

export interface Notification {
  id: string;
  userId: string;
  hotelId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  readAt?: string;
  ticketId?: string;
  conversationId?: string;
  createdAt: string;
}

export interface NotificationFilters {
  isRead?: boolean;
  type?: NotificationType;
  page?: number;
  limit?: number;
}

export interface NotificationListResponse {
  notifications: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  unreadCount: number;
}

/**
 * Get notifications for current user
 */
async function getNotifications(filters: NotificationFilters = {}): Promise<NotificationListResponse> {
  const params = new URLSearchParams();
  if (filters.isRead !== undefined) params.append('isRead', String(filters.isRead));
  if (filters.type) params.append('type', filters.type);
  if (filters.page) params.append('page', String(filters.page));
  if (filters.limit) params.append('limit', String(filters.limit));

  const response = await api.get(`/notifications?${params.toString()}`);
  return response.data.data;
}

/**
 * Get unread notification count
 */
async function getUnreadCount(): Promise<number> {
  const response = await api.get('/notifications/unread-count');
  return response.data.data.count;
}

/**
 * Mark a notification as read
 */
async function markAsRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

/**
 * Mark all notifications as read
 */
async function markAllAsRead(): Promise<void> {
  await api.post('/notifications/mark-all-read');
}

/**
 * Delete a notification
 */
async function deleteNotification(id: string): Promise<void> {
  await api.delete(`/notifications/${id}`);
}

// Helper functions
export function getNotificationIcon(type: NotificationType): string {
  switch (type) {
    case 'TICKET_ASSIGNED': return '📋';
    case 'TICKET_ESCALATED': return '⚠️';
    case 'TICKET_BREACHED': return '🚨';
    case 'TICKET_UPDATED': return '📝';
    case 'TICKET_RESOLVED': return '✅';
    case 'MESSAGE_RECEIVED': return '💬';
    case 'SYSTEM': return 'ℹ️';
    default: return '🔔';
  }
}

export function getNotificationColor(type: NotificationType): string {
  switch (type) {
    case 'TICKET_BREACHED': return 'bg-red-50 border-red-200';
    case 'TICKET_ESCALATED': return 'bg-orange-50 border-orange-200';
    case 'TICKET_ASSIGNED': return 'bg-blue-50 border-blue-200';
    case 'TICKET_RESOLVED': return 'bg-green-50 border-green-200';
    case 'MESSAGE_RECEIVED': return 'bg-purple-50 border-purple-200';
    default: return 'bg-gray-50 border-gray-200';
  }
}

export function formatNotificationTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
