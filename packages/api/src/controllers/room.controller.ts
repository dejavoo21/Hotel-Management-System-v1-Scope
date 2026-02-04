import { Response, NextFunction } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import * as roomService from '../services/room.service.js';
import { emitToHotel } from '../socket/index.js';

/**
 * Get all rooms
 */
export async function getAllRooms(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const filters = {
      status: req.query.status as string | undefined,
      housekeepingStatus: req.query.housekeepingStatus as string | undefined,
      floor: req.query.floor ? parseInt(req.query.floor as string) : undefined,
      roomTypeId: req.query.roomTypeId as string | undefined,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
    };

    const rooms = await roomService.getAllRooms(hotelId, filters);

    res.json({
      success: true,
      data: rooms,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get room by ID
 */
export async function getRoomById(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const room = await roomService.getRoomById(hotelId, id);

    res.json({
      success: true,
      data: room,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get room availability for date range
 */
export async function getAvailability(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { startDate, endDate, roomTypeId } = req.query;

    const availability = await roomService.getAvailability(
      hotelId,
      startDate as string,
      endDate as string,
      roomTypeId as string | undefined
    );

    res.json({
      success: true,
      data: availability,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new room
 */
export async function createRoom(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;

    const room = await roomService.createRoom(hotelId, userId, req.body);

    res.status(201).json({
      success: true,
      data: room,
      message: 'Room created successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update a room
 */
export async function updateRoom(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const { id } = req.params;

    const room = await roomService.updateRoom(hotelId, id, userId, req.body);

    res.json({
      success: true,
      data: room,
      message: 'Room updated successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a room (soft delete)
 */
export async function deleteRoom(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const { id } = req.params;

    await roomService.deleteRoom(hotelId, id, userId);

    res.json({
      success: true,
      message: 'Room deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update room status
 */
export async function updateRoomStatus(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const { id } = req.params;
    const { status, notes } = req.body;

    const room = await roomService.updateRoomStatus(hotelId, id, userId, status, notes);

    // Emit real-time update
    const io = req.app.get('io') as SocketIOServer;
    emitToHotel(io, hotelId, 'room:statusUpdate', {
      roomId: id,
      status: room.status,
      housekeepingStatus: room.housekeepingStatus,
    });

    res.json({
      success: true,
      data: room,
      message: 'Room status updated',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update housekeeping status
 */
export async function updateHousekeepingStatus(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const { id } = req.params;
    const { housekeepingStatus, notes } = req.body;

    const room = await roomService.updateHousekeepingStatus(hotelId, id, userId, housekeepingStatus, notes);

    // Emit real-time update
    const io = req.app.get('io') as SocketIOServer;
    emitToHotel(io, hotelId, 'housekeeping:updated', {
      roomId: id,
      status: room.housekeepingStatus,
      roomNumber: room.number,
    });

    res.json({
      success: true,
      data: room,
      message: 'Housekeeping status updated',
    });
  } catch (error) {
    next(error);
  }
}
