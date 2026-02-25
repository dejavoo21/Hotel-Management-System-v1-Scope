import { create } from 'zustand';
import type { PresenceStatus, EffectiveStatus, PresenceUpdate } from '@/types';

interface PresenceEntry {
  userId: string;
  email: string;
  isOnline: boolean;
  presenceStatus: PresenceStatus;
  effectiveStatus: EffectiveStatus;
  lastSeenAt: string | null;
}

interface PresenceState {
  // Connection state
  isConnected: boolean;
  
  // Map of userId -> presence data
  presenceMap: Map<string, PresenceEntry>;
  
  // Current user's presence status
  myPresenceStatus: PresenceStatus;
  
  // Actions
  setConnected: (connected: boolean) => void;
  setMyPresence: (status: PresenceStatus) => void;
  updatePresence: (update: PresenceUpdate) => void;
  setPresenceList: (list: PresenceUpdate[]) => void;
  getPresence: (userId: string) => PresenceEntry | null;
  getEffectiveStatus: (userId: string, isCurrentUser?: boolean) => EffectiveStatus;
  clear: () => void;
}

const DEFAULT_PRESENCE: PresenceStatus = 'AVAILABLE';

export const usePresenceStore = create<PresenceState>()((set, get) => ({
  isConnected: false,
  presenceMap: new Map(),
  myPresenceStatus: DEFAULT_PRESENCE,

  setConnected: (connected: boolean) => {
    set({ isConnected: connected });
  },

  setMyPresence: (status: PresenceStatus) => {
    set({ myPresenceStatus: status });
  },

  updatePresence: (update: PresenceUpdate) => {
    set((state) => {
      const newMap = new Map(state.presenceMap);
      newMap.set(update.userId, {
        userId: update.userId,
        email: update.email,
        isOnline: update.isOnline,
        presenceStatus: update.presenceStatus,
        effectiveStatus: update.effectiveStatus,
        lastSeenAt: update.lastSeenAt,
      });
      return { presenceMap: newMap };
    });
  },

  setPresenceList: (list: PresenceUpdate[]) => {
    set((state) => {
      const newMap = new Map(state.presenceMap);
      for (const update of list) {
        newMap.set(update.userId, {
          userId: update.userId,
          email: update.email,
          isOnline: update.isOnline,
          presenceStatus: update.presenceStatus,
          effectiveStatus: update.effectiveStatus,
          lastSeenAt: update.lastSeenAt,
        });
      }
      return { presenceMap: newMap };
    });
  },

  getPresence: (userId: string) => {
    return get().presenceMap.get(userId) ?? null;
  },

  getEffectiveStatus: (userId: string, isCurrentUser = false) => {
    const { isConnected, presenceMap, myPresenceStatus } = get();
    
    // For current user, if socket disconnected, show offline
    if (isCurrentUser && !isConnected) {
      return 'OFFLINE';
    }
    
    const presence = presenceMap.get(userId);
    if (!presence) {
      // Default: online users show AVAILABLE, unknown users show OFFLINE
      return isCurrentUser ? (isConnected ? myPresenceStatus : 'OFFLINE') : 'OFFLINE';
    }
    
    // If user is offline, always show OFFLINE regardless of override
    if (!presence.isOnline) {
      return 'OFFLINE';
    }
    
    return presence.effectiveStatus;
  },

  clear: () => {
    set({
      isConnected: false,
      presenceMap: new Map(),
      myPresenceStatus: DEFAULT_PRESENCE,
    });
  },
}));

// Helper to get presence dot color
export function getPresenceDotColor(status: EffectiveStatus): string {
  switch (status) {
    case 'AVAILABLE':
      return 'bg-green-500';
    case 'BUSY':
      return 'bg-amber-500';
    case 'AWAY':
      return 'bg-yellow-500';
    case 'DND':
      return 'bg-red-500';
    case 'OFFLINE':
    default:
      return 'bg-gray-400';
  }
}

// Helper to get presence label
export function getPresenceLabel(status: EffectiveStatus): string {
  switch (status) {
    case 'AVAILABLE':
      return 'Available';
    case 'BUSY':
      return 'Busy';
    case 'AWAY':
      return 'Away';
    case 'DND':
      return 'Do Not Disturb';
    case 'OFFLINE':
    default:
      return 'Offline';
  }
}
