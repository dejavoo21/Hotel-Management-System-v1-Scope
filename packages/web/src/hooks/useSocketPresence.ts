import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
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
type CallRingPayload = { callId?: string; room: string; fromUserId: string; fromEmail?: string };
type CallRoomPayload = { callId?: string; room: string };
type CallCreatedPayload = { callId: string; room: string };
type CallAcceptedPayload = { callId?: string; room?: string };
type CallDeclinedPayload = { callId?: string; room: string; by: string };
type WebRtcSignalPayload = { callId?: string; room?: string; data: unknown; fromUserId?: string };

const dispatchSocketEvent = (name: string, detail: unknown) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
};

interface PresenceSocketDto {
  userId: string;
  email: string;
  isOnline: boolean;
  effectiveStatus: EffectiveStatus;
  overrideStatus: PresenceStatus;
  lastSeenAt: string | Date | null;
}

function toPresenceUpdate(dto: PresenceSocketDto): PresenceUpdate {
  return {
    userId: dto.userId,
    email: dto.email,
    isOnline: dto.isOnline,
    presenceStatus: dto.overrideStatus,
    effectiveStatus: dto.effectiveStatus,
    lastSeenAt: dto.lastSeenAt ? String(dto.lastSeenAt) : null,
  };
}

const apiUrl = import.meta.env.VITE_API_URL;
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ?? (apiUrl ? new URL(apiUrl).origin : 'http://localhost:3001');

console.log('[Socket] URL configured:', SOCKET_URL);

interface PermissionsUpdateEvent {
  userId: string;
  modulePermissions: ModulePermission[];
}

let sharedSocket: Socket | null = null;
let sharedHandlersBound = false;
let sharedConsumerCount = 0;
let latestNavigate: ReturnType<typeof useNavigate> | null = null;
let latestQueryClient: QueryClient | null = null;
let latestLocation: { pathname: string; search: string } = { pathname: '/', search: '' };

const bindSharedHandlers = (socket: Socket) => {
  if (sharedHandlersBound) return;
  sharedHandlersBound = true;

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    usePresenceStore.getState().setConnected(true);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
    usePresenceStore.getState().setConnected(false);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message);
    usePresenceStore.getState().setConnected(false);
  });

  socket.on('presence:update', (dto: PresenceSocketDto) => {
    console.log('[Socket] Presence update (raw):', dto);
    const update = toPresenceUpdate(dto);
    const { updatePresence, setMyPresence } = usePresenceStore.getState();
    updatePresence(update);

    const currentUser = useAuthStore.getState().user;
    if (currentUser && update.userId === currentUser.id) {
      setMyPresence(update.presenceStatus);
    }
  });

  socket.on('presence:list', (dtos: PresenceSocketDto[]) => {
    console.log('[Socket] Presence list:', dtos.length, 'users');
    const list = dtos.map(toPresenceUpdate);
    usePresenceStore.getState().setPresenceList(list);
  });

  socket.on('permissions:update', async (data: PermissionsUpdateEvent) => {
    console.log('[Socket] Permissions update received:', data);
    const { user, setUser } = useAuthStore.getState();
    if (!user || data.userId !== user.id) return;

    try {
      const updatedUser = await authService.getCurrentUser();
      if (!updatedUser) return;

      console.log('[Socket] User permissions updated:', updatedUser.modulePermissions);
      setUser(updatedUser);
      latestQueryClient?.invalidateQueries({ queryKey: ['currentUser'] });

      if (latestNavigate && !canAccessRoute(updatedUser, latestLocation.pathname)) {
        latestNavigate(firstAllowedRoute(updatedUser), { replace: true });
      }
    } catch (error) {
      console.error('[Socket] Failed to refetch user after permissions update:', error);
    }
  });

  socket.on('error', (error: { message: string }) => {
    console.error('[Socket] Error:', error.message);
  });

  socket.on('dm:thread', (payload: DmThreadPayload) => {
    dispatchSocketEvent('hotelos:dm-thread', payload);
  });

  socket.on('dm:new', (payload: DmMessagePayload) => {
    dispatchSocketEvent('hotelos:dm-new', payload);
    if (!latestQueryClient) return;

    latestQueryClient.invalidateQueries({ queryKey: ['message-thread', payload.threadId] });
    latestQueryClient.invalidateQueries({ queryKey: ['message-threads'] });
    latestQueryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        (q.queryKey[0] === 'message-threads' || q.queryKey[0] === 'message-thread'),
    });
  });

  socket.on('call:ring', (payload: CallRingPayload) => {
    dispatchSocketEvent('hotelos:call-ring', payload);
    if (!latestNavigate) return;

    const currentParams = new URLSearchParams(latestLocation.search);
    const isSameIncomingScreen =
      latestLocation.pathname === '/calls' &&
      currentParams.get('incoming') === '1' &&
      currentParams.get('room') === payload.room &&
      (payload.callId ? currentParams.get('callId') === payload.callId : true);

    if (!isSameIncomingScreen) {
      const from = encodeURIComponent(payload.fromEmail || payload.fromUserId || '');
      const callIdParam = payload.callId ? `&callId=${encodeURIComponent(payload.callId)}` : '';
      latestNavigate(
        `/calls?incoming=1&room=${encodeURIComponent(payload.room)}${callIdParam}&from=${from}`
      );
    }
  });

  socket.on('call:created', (payload: CallCreatedPayload) => {
    dispatchSocketEvent('hotelos:call-created', payload);
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
};

const releaseSharedSocket = () => {
  if (sharedConsumerCount > 0) sharedConsumerCount -= 1;
  if (sharedConsumerCount > 0) return;
  if (sharedSocket) {
    sharedSocket.removeAllListeners();
    sharedSocket.disconnect();
  }
  sharedSocket = null;
  sharedHandlersBound = false;
  usePresenceStore.getState().setConnected(false);
  usePresenceStore.getState().clear();
};

export function useSocketPresence() {
  const socketRef = useRef<Socket | null>(sharedSocket);
  const registeredRef = useRef(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken, isAuthenticated } = useAuthStore();

  useEffect(() => {
    latestLocation = { pathname: location.pathname, search: location.search };
  }, [location.pathname, location.search]);

  useEffect(() => {
    latestQueryClient = queryClient;
    latestNavigate = navigate;
  }, [navigate, queryClient]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      if (registeredRef.current) {
        registeredRef.current = false;
        releaseSharedSocket();
      }
      return;
    }

    if (!registeredRef.current) {
      sharedConsumerCount += 1;
      registeredRef.current = true;
    }

    if (!sharedSocket) {
      sharedSocket = io(SOCKET_URL, {
        auth: { token: accessToken },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
    } else {
      sharedSocket.auth = { token: accessToken };
      if (!sharedSocket.connected) sharedSocket.connect();
    }

    socketRef.current = sharedSocket;
    bindSharedHandlers(sharedSocket);

    return () => {
      if (!registeredRef.current) return;
      registeredRef.current = false;
      releaseSharedSocket();
    };
  }, [isAuthenticated, accessToken]);

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
      socketRef.current.emit('call:create', { calleeUserIds: [payload.calleeUserId] });
    }
  }, []);

  const emitCallAccept = useCallback((room: string, callId?: string) => {
    if (socketRef.current?.connected && (room || callId)) {
      if (callId) socketRef.current.emit('call:join', { callId });
      else socketRef.current.emit('call:accept', { room });
    }
  }, []);

  const emitCallDecline = useCallback((room: string, callId?: string) => {
    if (socketRef.current?.connected && (room || callId)) {
      socketRef.current.emit('call:decline', { room, callId });
    }
  }, []);

  const emitCallInvite = useCallback((payload: { callId: string; userIds: string[] }) => {
    if (socketRef.current?.connected && payload.callId && payload.userIds.length) {
      socketRef.current.emit('call:invite', payload);
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
    emitCallInvite,
  };
}

export default useSocketPresence;
