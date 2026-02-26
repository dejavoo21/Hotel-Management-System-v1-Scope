import api from './api';
import type { PresenceUpdate, PresenceStatus } from '@/types';

export interface PresenceSnapshot {
  onlineUserIds: string[];
  users: Array<{
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    isOnline: boolean;
    presenceStatus: PresenceStatus;
    effectiveStatus: string;
    lastSeenAt: string | null;
  }>;
}

const presenceService = {
  /**
   * Get snapshot of all user presence states in the hotel
   * Used for initial page load hydration
   */
  async getSnapshot(): Promise<PresenceSnapshot> {
    const { data } = await api.get<{ success: boolean; data: PresenceSnapshot }>('/presence/snapshot');
    return data.data;
  },

  /**
   * Get presence status for a specific user
   */
  async getUserPresence(userId: string): Promise<PresenceUpdate> {
    const { data } = await api.get<{ success: boolean; data: PresenceUpdate }>(`/presence/${userId}`);
    return data.data;
  },

  /**
   * Update current user's presence status (via REST)
   * This also broadcasts via socket
   */
  async updateMyPresence(presenceStatus: PresenceStatus): Promise<PresenceUpdate> {
    const { data } = await api.patch<{ success: boolean; data: PresenceUpdate }>('/auth/me/presence', {
      presenceStatus,
    });
    return data.data;
  },
};

export default presenceService;
