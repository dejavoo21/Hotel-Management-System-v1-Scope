import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { usePresenceStore } from '@/stores/presenceStore';
import { authService } from '@/services/auth';
import { canAccessRoute, firstAllowedRoute } from '@/lib/access';
import type { PresenceUpdate, ModulePermission } from '@/types';

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

  return {
    socket: socketRef.current,
    emitPresenceSet,
  };
}

export default useSocketPresence;
