import { Response, NextFunction } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import * as bookingService from '../services/booking.service.js';
import { emitToHotel } from '../socket/index.js';

export async function getAllBookings(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { status, startDate, endDate, guestId, roomId, search, page, limit } = req.query;

    const result = await bookingService.getAllBookings(hotelId, {
      status: status as string,
      startDate: startDate as string,
      endDate: endDate as string,
      guestId: guestId as string,
      roomId: roomId as string,
      search: search as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getBookingsCalendar(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { startDate, endDate } = req.query;

    const calendar = await bookingService.getBookingsCalendar(
      hotelId,
      startDate as string,
      endDate as string
    );

    res.json({ success: true, data: calendar });
  } catch (error) {
    next(error);
  }
}

export async function checkAvailability(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { checkInDate, checkOutDate, roomTypeId, guests } = req.query;

    const availability = await bookingService.checkAvailability(hotelId, {
      checkInDate: checkInDate as string,
      checkOutDate: checkOutDate as string,
      roomTypeId: roomTypeId as string,
      guests: guests ? parseInt(guests as string) : 1,
    });

    res.json({ success: true, data: availability });
  } catch (error) {
    next(error);
  }
}

export async function getBookingById(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const booking = await bookingService.getBookingById(hotelId, id);

    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
}

export async function createBooking(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;

    const booking = await bookingService.createBooking(hotelId, userId, req.body);

    const io = req.app.get('io') as SocketIOServer;
    emitToHotel(io, hotelId, 'booking:created', {
      bookingId: booking.id,
      guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
      checkInDate: booking.checkInDate,
    });

    res.status(201).json({ success: true, data: booking, message: 'Booking created' });
  } catch (error) {
    next(error);
  }
}

export async function updateBooking(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const { id } = req.params;

    const booking = await bookingService.updateBooking(hotelId, id, userId, req.body);

    const io = req.app.get('io') as SocketIOServer;
    emitToHotel(io, hotelId, 'booking:updated', { bookingId: id });

    res.json({ success: true, data: booking, message: 'Booking updated' });
  } catch (error) {
    next(error);
  }
}

export async function cancelBooking(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const { id } = req.params;

    await bookingService.cancelBooking(hotelId, id, userId);

    res.json({ success: true, message: 'Booking cancelled' });
  } catch (error) {
    next(error);
  }
}

export async function checkIn(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const { id } = req.params;
    const { roomId, notes } = req.body;

    const result = await bookingService.checkIn(hotelId, id, userId, roomId, notes);

    const io = req.app.get('io') as SocketIOServer;
    emitToHotel(io, hotelId, 'booking:checkedIn', {
      bookingId: id,
      roomId: result.room.id,
      roomNumber: result.room.number,
    });

    res.json({ success: true, data: result, message: 'Check-in successful' });
  } catch (error) {
    next(error);
  }
}

export async function checkOut(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const { id } = req.params;

    const result = await bookingService.checkOut(hotelId, id, userId, req.body);

    const io = req.app.get('io') as SocketIOServer;
    emitToHotel(io, hotelId, 'booking:checkedOut', {
      bookingId: id,
      roomId: result.room.id,
    });

    res.json({ success: true, data: result, message: 'Check-out successful' });
  } catch (error) {
    next(error);
  }
}

export async function getBookingCharges(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const charges = await bookingService.getBookingCharges(hotelId, id);

    res.json({ success: true, data: charges });
  } catch (error) {
    next(error);
  }
}

export async function addCharge(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const { id } = req.params;

    const charge = await bookingService.addCharge(hotelId, id, userId, req.body);

    res.status(201).json({ success: true, data: charge, message: 'Charge added' });
  } catch (error) {
    next(error);
  }
}

export async function voidCharge(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const { id, chargeId } = req.params;
    const { reason } = req.body;

    await bookingService.voidCharge(hotelId, id, chargeId, userId, reason);

    res.json({ success: true, message: 'Charge voided' });
  } catch (error) {
    next(error);
  }
}

export async function getBookingPayments(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const payments = await bookingService.getBookingPayments(hotelId, id);

    res.json({ success: true, data: payments });
  } catch (error) {
    next(error);
  }
}

export async function addPayment(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const { id } = req.params;

    const payment = await bookingService.addPayment(hotelId, id, userId, req.body);

    res.status(201).json({ success: true, data: payment, message: 'Payment recorded' });
  } catch (error) {
    next(error);
  }
}

export async function confirmPayment(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const { id } = req.params;
    const { paymentMethod } = req.body;

    const booking = await bookingService.confirmPayment(hotelId, id, userId, paymentMethod);

    res.json({ success: true, data: booking, message: 'Payment confirmed' });
  } catch (error) {
    next(error);
  }
}
