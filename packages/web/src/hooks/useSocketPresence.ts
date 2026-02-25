import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/authStore';
import { usePresenceStore } from '@/stores/presenceStore';
import type { PresenceUpdate } from '@/types';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Hook to manage Socket.IO connection and presence subscriptions
 * Connects when user is authenticated, disconnects on logout
 */
export function useSocketPresence() {
  const socketRef = useRef<Socket | null>(null);
  const { accessToken, isAuthenticated, user } = useAuthStore();
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
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      setConnected(false);
    });

    // Presence events
    socket.on('presence:update', (data: PresenceUpdate) => {
      console.log('[Socket] Presence update:', data);
      updatePresence(data);
      
      // If this is current user's update, also update myPresenceStatus
      if (user && data.userId === user.id) {
        setMyPresence(data.presenceStatus);
      }
    });

    socket.on('presence:list', (list: PresenceUpdate[]) => {
      console.log('[Socket] Presence list:', list.length, 'users');
      setPresenceList(list);
    });

    // Error handler
    socket.on('error', (error: { message: string }) => {
      console.error('[Socket] Error:', error.message);
    });

    // Cleanup on unmount or auth change
    return () => {
      socket.disconnect();
      socketRef.current = null;
      clearPresence();
    };
  }, [isAuthenticated, accessToken, user?.id]);

  // Method to manually emit presence change via socket (optional, REST is primary)
  const emitPresenceSet = useCallback((status: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('presence:set', status);
    }
  }, []);

  return {
    socket: socketRef.current,
    emitPresenceSet,
  };
}

export default useSocketPresence;
