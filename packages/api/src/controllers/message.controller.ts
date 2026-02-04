import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { prisma } from '../config/database.js';

const resolveThreadTitle = (guest?: { firstName: string; lastName: string }, bookingRef?: string) => {
  if (guest) {
    return `${guest.firstName} ${guest.lastName}`;
  }
  if (bookingRef) {
    return `Booking ${bookingRef}`;
  }
  return 'Guest Conversation';
};

export async function listThreads(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { search, limit } = req.query;
    const take = limit ? parseInt(limit as string, 10) : 50;
    const searchTerm = (search as string | undefined)?.trim();

    const existingCount = await prisma.conversation.count({ where: { hotelId } });
    if (existingCount === 0) {
      const recentBookings = await prisma.booking.findMany({
        where: { hotelId },
        include: { guest: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      });

      if (recentBookings.length > 0) {
        await prisma.$transaction(
          recentBookings.map((booking) =>
            prisma.conversation.create({
              data: {
                hotelId,
                guestId: booking.guestId,
                bookingId: booking.id,
                subject: `Reservation ${booking.bookingRef}`,
                status: 'OPEN',
                lastMessageAt: new Date(),
                messages: {
                  create: {
                    senderType: 'SYSTEM',
                    body: `Reservation created for ${booking.guest.firstName} ${booking.guest.lastName}.`,
                  },
                },
              },
            })
          )
        );
      }
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        hotelId,
        ...(searchTerm && {
          OR: [
            { subject: { contains: searchTerm, mode: 'insensitive' } },
            { guest: { firstName: { contains: searchTerm, mode: 'insensitive' } } },
            { guest: { lastName: { contains: searchTerm, mode: 'insensitive' } } },
            { guest: { email: { contains: searchTerm, mode: 'insensitive' } } },
            { booking: { bookingRef: { contains: searchTerm, mode: 'insensitive' } } },
          ],
        }),
      },
      include: {
        guest: { select: { firstName: true, lastName: true, email: true } },
        booking: { select: { bookingRef: true, checkInDate: true, checkOutDate: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            senderUser: { select: { firstName: true, lastName: true, role: true } },
            guest: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      take,
    });

    res.json({
      success: true,
      data: conversations.map((conversation) => {
        const lastMessage = conversation.messages[0];
        return {
          id: conversation.id,
          subject: conversation.subject ?? resolveThreadTitle(conversation.guest, conversation.booking?.bookingRef),
          status: conversation.status,
          guest: conversation.guest,
          booking: conversation.booking,
          lastMessageAt: conversation.lastMessageAt ?? conversation.createdAt,
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                body: lastMessage.body,
                senderType: lastMessage.senderType,
                createdAt: lastMessage.createdAt,
                senderUser: lastMessage.senderUser,
                guest: lastMessage.guest,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
}

export async function getThread(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const conversation = await prisma.conversation.findFirst({
      where: { id, hotelId },
      include: {
        guest: { select: { firstName: true, lastName: true, email: true } },
        booking: { select: { bookingRef: true, checkInDate: true, checkOutDate: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            senderUser: { select: { firstName: true, lastName: true, role: true } },
            guest: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!conversation) {
      res.status(404).json({ success: false, error: 'Conversation not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: conversation.id,
        subject: conversation.subject ?? resolveThreadTitle(conversation.guest, conversation.booking?.bookingRef),
        status: conversation.status,
        guest: conversation.guest,
        booking: conversation.booking,
        lastMessageAt: conversation.lastMessageAt ?? conversation.createdAt,
        messages: conversation.messages.map((message) => ({
          id: message.id,
          body: message.body,
          senderType: message.senderType,
          createdAt: message.createdAt,
          senderUser: message.senderUser,
          guest: message.guest,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createMessage(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;
    const { body } = req.body as { body?: string };

    if (!body || !body.trim()) {
      res.status(400).json({ success: false, error: 'Message body is required' });
      return;
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id, hotelId },
    });

    if (!conversation) {
      res.status(404).json({ success: false, error: 'Conversation not found' });
      return;
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'STAFF',
        senderUserId: req.user!.id,
        body: body.trim(),
      },
      include: {
        senderUser: { select: { firstName: true, lastName: true, role: true } },
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: message.createdAt },
    });

    res.status(201).json({
      success: true,
      data: {
        id: message.id,
        body: message.body,
        senderType: message.senderType,
        createdAt: message.createdAt,
        senderUser: message.senderUser,
      },
      message: 'Message sent',
    });
  } catch (error) {
    next(error);
  }
}
