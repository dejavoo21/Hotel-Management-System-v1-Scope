import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { usePresenceStore } from '@/stores/presenceStore';
import { authService } from '@/services/auth';
import { canAccessRoute, firstAllowedRoute } from '@/lib/access';
import type { PresenceUpdate, ModulePermission, PresenceStatus, EffectiveStatus } from '@/types';

type DmThreadPayload = { threadId: string; peerUserId: string };
type DmMessagePayload = {
  threadId: string;
  message: {
    id: string;
    threadId: string;
    senderId: string;
    text: string;
    clientMessageId?: string | null;
    createdAt: string;
  };
};
type CallRingPayload = { room: string; fromUserId: string; fromEmail?: string };
type CallRoomPayload = { room: string };
type CallAcceptedPayload = { room: string };
type CallDeclinedPayload = { room: string; by: string };
type WebRtcSignalPayload = { room: string; data: unknown; fromUserId?: string };

const dispatchSocketEvent = (name: string, detail: unknown) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
};

/**
 * Socket DTO from backend (uses overrideStatus)
 * Must map to frontend PresenceUpdate (uses presenceStatus)
 */
interface PresenceSocketDto {
  userId: string;
  email: string;
  isOnline: boolean;
  effectiveStatus: EffectiveStatus;
  overrideStatus: PresenceStatus;
  lastSeenAt: string | Date | null;
}

/**
 * Convert socket DTO to frontend PresenceUpdate type
 * Maps overrideStatus -> presenceStatus for store compatibility
 */
function toPresenceUpdate(dto: PresenceSocketDto): PresenceUpdate {
  return {
    userId: dto.userId,
    email: dto.email,
    isOnline: dto.isOnline,
    presenceStatus: dto.overrideStatus, // Map backend field to frontend field
    effectiveStatus: dto.effectiveStatus,
    lastSeenAt: dto.lastSeenAt ? String(dto.lastSeenAt) : null,
  };
}

// Derive socket URL: prefer VITE_SOCKET_URL, else strip /api from VITE_API_URL
const apiUrl = import.meta.env.VITE_API_URL;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 
  (apiUrl ? new URL(apiUrl).origin : 'http://localhost:3001');

console.log('[Socket] URL configured:', SOCKET_URL);

interface PermissionsUpdateEvent {
  userId: string;
  modulePermissions: ModulePermission[];
}

/**
 * Hook to manage Socket.IO connection and presence subscriptions
 * Connects when user is authenticated, disconnects on logout
 * Also handles permissions:update events to keep user permissions in sync
 * Server sends presence:list on connect (Teams-like behavior)
 */
export function useSocketPresence() {
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken, isAuthenticated, user, setUser } = useAuthStore();
  const { 
    setConnected, 
    updatePresence, 
    setPresenceList,
    setMyPresence,
    clear: clearPresence,
  } = usePresenceStore();

  // Connect to socket when authenticated
  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      // Cleanup if not authenticated
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnected(false);
      return;
    }

    // Already connected
    if (socketRef.current?.connected) {
      return;
    }

    // Create socket connection
    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setConnected(true);
      // Server will emit presence:list automatically (Teams-like behavior)
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      setConnected(false);
    });

    // Presence events - map backend DTO to frontend type
    socket.on('presence:update', (dto: PresenceSocketDto) => {
      console.log('[Socket] Presence update (raw):', dto);
      const update = toPresenceUpdate(dto);
      updatePresence(update);
      
      // If this is current user's update, also update myPresenceStatus
      if (user && update.userId === user.id) {
        setMyPresence(update.presenceStatus);
      }
    });

    socket.on('presence:list', (dtos: PresenceSocketDto[]) => {
      console.log('[Socket] Presence list:', dtos.length, 'users');
      const list = dtos.map(toPresenceUpdate);
      setPresenceList(list);
    });

    // Permissions update - refetch user data when admin changes permissions
    socket.on('permissions:update', async (data: PermissionsUpdateEvent) => {
      console.log('[Socket] Permissions update received:', data);
      if (user && data.userId === user.id) {
        // Refetch current user to get updated permissions
        try {
          const updatedUser = await authService.getCurrentUser();
          if (updatedUser) {
            console.log('[Socket] User permissions updated:', updatedUser.modulePermissions);
            setUser(updatedUser);
            // Invalidate any queries that depend on user permissions
            queryClient.invalidateQueries({ queryKey: ['currentUser'] });
            
            // Check if current route is still allowed
            const currentPath = location.pathname;
            if (!canAccessRoute(updatedUser, currentPath)) {
              const allowedRoute = firstAllowedRoute(updatedUser);
              console.log('[Socket] Current route no longer allowed, redirecting to:', allowedRoute);
              navigate(allowedRoute, { replace: true });
            }
          }
        } catch (error) {
          console.error('[Socket] Failed to refetch user after permissions update:', error);
        }
      }
    });

    // Error handler
    socket.on('error', (error: { message: string }) => {
      console.error('[Socket] Error:', error.message);
    });

    socket.on('dm:thread', (payload: DmThreadPayload) => {
      dispatchSocketEvent('hotelos:dm-thread', payload);
    });

    socket.on('dm:new', (payload: DmMessagePayload) => {
      dispatchSocketEvent('hotelos:dm-new', payload);
      queryClient.invalidateQueries({ queryKey: ['thread', payload.threadId] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
    });

    socket.on('call:ring', (payload: CallRingPayload) => {
      dispatchSocketEvent('hotelos:call-ring', payload);
    });

    socket.on('call:accepted', (payload: CallAcceptedPayload) => {
      dispatchSocketEvent('hotelos:call-accepted', payload);
    });

    socket.on('call:room', (payload: CallRoomPayload) => {
      dispatchSocketEvent('hotelos:call-room', payload);
    });

    socket.on('call:declined', (payload: CallDeclinedPayload) => {
      dispatchSocketEvent('hotelos:call-declined', payload);
    });

    socket.on('webrtc:signal', (payload: WebRtcSignalPayload) => {
      dispatchSocketEvent('hotelos:webrtc-signal', payload);
    });

    // Cleanup on unmount or auth change
    return () => {
      socket.disconnect();
      socketRef.current = null;
      clearPresence();
    };
  }, [isAuthenticated, accessToken, user?.id, location.pathname]);

  // Method to manually emit presence change via socket (optional, REST is primary)
  const emitPresenceSet = useCallback((status: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('presence:set', status);
    }
  }, []);

  const emitDmOpen = useCallback((peerUserId: string) => {
    if (socketRef.current?.connected && peerUserId) {
      socketRef.current.emit('dm:open', { peerUserId });
    }
  }, []);

  const emitDmSend = useCallback((payload: { threadId: string; text: string; clientMessageId?: string }) => {
    if (socketRef.current?.connected && payload.threadId && payload.text.trim()) {
      socketRef.current.emit('dm:send', payload);
    }
  }, []);

  const emitCallStart = useCallback((payload: { calleeUserId: string }) => {
    if (socketRef.current?.connected && payload.calleeUserId) {
      socketRef.current.emit('call:start', payload);
    }
  }, []);

  const emitCallAccept = useCallback((room: string) => {
    if (socketRef.current?.connected && room) {
      socketRef.current.emit('call:accept', { room });
    }
  }, []);

  const emitCallDecline = useCallback((room: string) => {
    if (socketRef.current?.connected && room) {
      socketRef.current.emit('call:decline', { room });
    }
  }, []);

  return {
    socket: socketRef.current,
    emitPresenceSet,
    emitDmOpen,
    emitDmSend,
    emitCallStart,
    emitCallAccept,
    emitCallDecline,
  };
}

export default useSocketPresence;
