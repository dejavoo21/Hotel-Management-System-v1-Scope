import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { TokenPayload } from '../types/index.js';

interface AuthenticatedSocket extends Socket {
  user?: {
    userId: string;
    email: string;
    role: string;
    hotelId: string;
  };
}

/**
 * Setup Socket.IO event handlers
 */
export function setupSocketHandlers(io: SocketIOServer): void {
  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;
      socket.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        hotelId: decoded.hotelId,
      };
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.user;
    if (!user) return;

    logger.info(`Socket connected: ${socket.id} (User: ${user.email})`);

    // Join hotel-specific room for targeted broadcasts
    socket.join(`hotel:${user.hotelId}`);

    // Join role-specific room
    socket.join(`role:${user.role}`);

    // Handle room subscription
    socket.on('subscribe:room', (roomId: string) => {
      socket.join(`room:${roomId}`);
      logger.debug(`Socket ${socket.id} subscribed to room:${roomId}`);
    });

    socket.on('unsubscribe:room', (roomId: string) => {
      socket.leave(`room:${roomId}`);
      logger.debug(`Socket ${socket.id} unsubscribed from room:${roomId}`);
    });

    // Handle booking subscription
    socket.on('subscribe:booking', (bookingId: string) => {
      socket.join(`booking:${bookingId}`);
      logger.debug(`Socket ${socket.id} subscribed to booking:${bookingId}`);
    });

    socket.on('unsubscribe:booking', (bookingId: string) => {
      socket.leave(`booking:${bookingId}`);
      logger.debug(`Socket ${socket.id} unsubscribed from booking:${bookingId}`);
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (Reason: ${reason})`);
    });

    socket.on('error', (error) => {
      logger.error(`Socket error: ${socket.id}`, error);
    });
  });
}

/**
 * Emit event to all clients in a hotel
 */
export function emitToHotel(io: SocketIOServer, hotelId: string, event: string, data: unknown): void {
  io.to(`hotel:${hotelId}`).emit(event, data);
}

/**
 * Emit event to specific room subscribers
 */
export function emitToRoom(io: SocketIOServer, roomId: string, event: string, data: unknown): void {
  io.to(`room:${roomId}`).emit(event, data);
}

/**
 * Emit event to specific booking subscribers
 */
export function emitToBooking(io: SocketIOServer, bookingId: string, event: string, data: unknown): void {
  io.to(`booking:${bookingId}`).emit(event, data);
}

/**
 * Emit event to users with specific role in a hotel
 */
export function emitToRole(io: SocketIOServer, hotelId: string, role: string, event: string, data: unknown): void {
  // Get all sockets in hotel room and filter by role
  const hotelRoom = io.sockets.adapter.rooms.get(`hotel:${hotelId}`);
  if (!hotelRoom) return;

  const roleRoom = io.sockets.adapter.rooms.get(`role:${role}`);
  if (!roleRoom) return;

  // Find intersection and emit
  hotelRoom.forEach((socketId) => {
    if (roleRoom.has(socketId)) {
      io.to(socketId).emit(event, data);
    }
  });
}

// Socket event types for type safety
export interface ServerToClientEvents {
  // Room events
  'room:statusUpdate': (data: { roomId: string; status: string; housekeepingStatus: string }) => void;
  'room:assigned': (data: { roomId: string; bookingId: string }) => void;

  // Booking events
  'booking:created': (data: { bookingId: string; guestName: string; checkInDate: string }) => void;
  'booking:updated': (data: { bookingId: string }) => void;
  'booking:checkedIn': (data: { bookingId: string; roomId: string; roomNumber: string }) => void;
  'booking:checkedOut': (data: { bookingId: string; roomId: string }) => void;

  // Housekeeping events
  'housekeeping:updated': (data: { roomId: string; status: string; roomNumber: string }) => void;

  // Dashboard events
  'dashboard:updated': (data: { type: string }) => void;

  // Notification events
  'notification': (data: { type: 'info' | 'success' | 'warning' | 'error'; title: string; message: string }) => void;
}

export interface ClientToServerEvents {
  'subscribe:room': (roomId: string) => void;
  'unsubscribe:room': (roomId: string) => void;
  'subscribe:booking': (bookingId: string) => void;
  'unsubscribe:booking': (bookingId: string) => void;
}
