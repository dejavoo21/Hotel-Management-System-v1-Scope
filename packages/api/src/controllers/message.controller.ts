import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { prisma } from '../config/database.js';
import { Role } from '@prisma/client';

const LIVE_SUPPORT_SUBJECT = 'Live Support';
const SUPPORT_HEARTBEAT_ACTION = 'SUPPORT_HEARTBEAT';
const ASSIGNMENT_PREFIX = '[SUPPORT_ASSIGNED]';
const BOT_HANDOFF_CONNECTING = 'I am now connecting you with one of our live Customer Support Agents for further assistance.';
const BOT_HANDOFF_WAITING = 'Hi, thank you for requesting to chat with an agent. Our agent will be with you shortly.';

const resolveThreadTitle = (guest?: { firstName: string; lastName: string }, bookingRef?: string) => {
  if (guest) {
    return `${guest.firstName} ${guest.lastName}`;
  }
  if (bookingRef) {
    return `Booking ${bookingRef}`;
  }
  return 'Guest Conversation';
};

function parseAssignedUser(body: string) {
  if (!body.startsWith(ASSIGNMENT_PREFIX)) return null;
  const jsonText = body.slice(ASSIGNMENT_PREFIX.length).trim();
  try {
    const parsed = JSON.parse(jsonText) as {
      userId: string;
      firstName: string;
      lastName: string;
      role: string;
      assignedAt: string;
      assignedById?: string;
    };
    return parsed;
  } catch {
    return null;
  }
}

const serializeThreadSummary = (
  conversation: {
    id: string;
    subject: string | null;
    status: string;
    createdAt: Date;
    lastMessageAt: Date | null;
    guest: { firstName: string; lastName: string; email: string | null } | null;
    booking: { bookingRef: string; checkInDate: Date; checkOutDate: Date } | null;
    messages: Array<{
      id: string;
      body: string;
      senderType: string;
      createdAt: Date;
      senderUser: { firstName: string; lastName: string; role: string } | null;
      guest: { firstName: string; lastName: string } | null;
    }>;
  }
) => {
  const visibleMessages = conversation.messages.filter(
    (msg) => !(msg.senderType === 'SYSTEM' && msg.body.startsWith(ASSIGNMENT_PREFIX))
  );
  const lastMessage = visibleMessages[0];
  const assignmentMessage = conversation.messages.find((msg) => msg.senderType === 'SYSTEM' && msg.body.startsWith(ASSIGNMENT_PREFIX));
  const assignedSupport = assignmentMessage ? parseAssignedUser(assignmentMessage.body) : null;
  return {
    id: conversation.id,
    subject: conversation.subject ?? resolveThreadTitle(conversation.guest ?? undefined, conversation.booking?.bookingRef),
    status: conversation.status,
    guest: conversation.guest ?? undefined,
    booking: conversation.booking ?? undefined,
    lastMessageAt: conversation.lastMessageAt ?? conversation.createdAt,
    lastMessage: lastMessage
      ? {
          id: lastMessage.id,
          body: lastMessage.body,
          senderType: lastMessage.senderType,
          createdAt: lastMessage.createdAt,
          senderUser: lastMessage.senderUser ?? undefined,
          guest: lastMessage.guest ?? undefined,
        }
      : null,
    assignedSupport: assignedSupport
      ? {
          userId: assignedSupport.userId,
          firstName: assignedSupport.firstName,
          lastName: assignedSupport.lastName,
          role: assignedSupport.role,
          assignedAt: assignedSupport.assignedAt,
          assignedById: assignedSupport.assignedById,
        }
      : undefined,
  };
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
          take: 10,
          include: {
            senderUser: { select: { firstName: true, lastName: true, role: true } },
            guest: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      take,
    });

    res.json({ success: true, data: conversations.map((conversation) => serializeThreadSummary(conversation)) });
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

    const assignmentMessage = conversation.messages
      .slice()
      .reverse()
      .find((message) => message.senderType === 'SYSTEM' && message.body.startsWith(ASSIGNMENT_PREFIX));
    const assignedSupport = assignmentMessage ? parseAssignedUser(assignmentMessage.body) : null;
    const visibleMessages = conversation.messages.filter(
      (message) => !(message.senderType === 'SYSTEM' && message.body.startsWith(ASSIGNMENT_PREFIX))
    );

    res.json({
      success: true,
      data: {
        id: conversation.id,
        subject: conversation.subject ?? resolveThreadTitle(conversation.guest, conversation.booking?.bookingRef),
        status: conversation.status,
        guest: conversation.guest,
        booking: conversation.booking,
        lastMessageAt: conversation.lastMessageAt ?? conversation.createdAt,
        assignedSupport: assignedSupport
          ? {
              userId: assignedSupport.userId,
              firstName: assignedSupport.firstName,
              lastName: assignedSupport.lastName,
              role: assignedSupport.role,
              assignedAt: assignedSupport.assignedAt,
              assignedById: assignedSupport.assignedById,
            }
          : undefined,
        messages: visibleMessages.map((message) => ({
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

export async function getOrCreateLiveSupportThread(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const userName = `${req.user!.firstName} ${req.user!.lastName}`.trim();
    const { initialMessage, handoffSummary } = req.body as { initialMessage?: string; handoffSummary?: string };

    let conversation = await prisma.conversation.findFirst({
      where: { hotelId, subject: LIVE_SUPPORT_SUBJECT, status: { in: ['OPEN', 'RESOLVED'] } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      include: {
        guest: { select: { firstName: true, lastName: true, email: true } },
        booking: { select: { bookingRef: true, checkInDate: true, checkOutDate: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            senderUser: { select: { firstName: true, lastName: true, role: true } },
            guest: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          hotelId,
          subject: LIVE_SUPPORT_SUBJECT,
          status: 'OPEN',
          lastMessageAt: new Date(),
          messages: {
            create: {
              senderType: 'SYSTEM',
              body: `${userName} opened live support chat.`,
            },
          },
        },
        include: {
          guest: { select: { firstName: true, lastName: true, email: true } },
          booking: { select: { bookingRef: true, checkInDate: true, checkOutDate: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: {
              senderUser: { select: { firstName: true, lastName: true, role: true } },
              guest: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });
    }

    const notes: string[] = [];
    if (handoffSummary?.trim()) {
      notes.push(handoffSummary.trim());
    }
    if (initialMessage?.trim()) {
      notes.push(initialMessage.trim());
    }
    if (notes.length > 0) {
      const created = await prisma.$transaction(async (tx) => {
        const createdMessages = await Promise.all([
          tx.message.create({
            data: {
              conversationId: conversation!.id,
              senderType: 'STAFF',
              senderUserId: userId,
              body: notes.join('\n'),
            },
            include: {
              senderUser: { select: { firstName: true, lastName: true, role: true } },
              guest: { select: { firstName: true, lastName: true } },
            },
          }),
          tx.message.create({
            data: {
              conversationId: conversation!.id,
              senderType: 'SYSTEM',
              body: BOT_HANDOFF_CONNECTING,
            },
            include: {
              senderUser: { select: { firstName: true, lastName: true, role: true } },
              guest: { select: { firstName: true, lastName: true } },
            },
          }),
          tx.message.create({
            data: {
              conversationId: conversation!.id,
              senderType: 'SYSTEM',
              body: BOT_HANDOFF_WAITING,
            },
            include: {
              senderUser: { select: { firstName: true, lastName: true, role: true } },
              guest: { select: { firstName: true, lastName: true } },
            },
          }),
        ]);
        const lastCreated = createdMessages[createdMessages.length - 1];
        await tx.conversation.update({
          where: { id: conversation!.id },
          data: { status: 'OPEN', lastMessageAt: lastCreated.createdAt },
        });
        return lastCreated;
      });

      conversation = { ...conversation, status: 'OPEN', lastMessageAt: created.createdAt };
    }

    res.json({ success: true, data: serializeThreadSummary(conversation) });
  } catch (error) {
    next(error);
  }
}

export async function heartbeatSupportPresence(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: SUPPORT_HEARTBEAT_ACTION,
        entity: 'support',
        entityId: req.user!.id,
      },
    });
    res.json({ success: true, data: { ok: true } });
  } catch (error) {
    next(error);
  }
}

export async function listSupportAgents(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const onlineSince = new Date(Date.now() - 2 * 60 * 1000);
    const recentLoginSince = new Date(Date.now() - 15 * 60 * 1000);
    const roles: Role[] = ['ADMIN', 'MANAGER', 'RECEPTIONIST'];

    const agents = await prisma.user.findMany({
      where: { hotelId, isActive: true, role: { in: roles } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        lastLoginAt: true,
      },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });

    const agentIds = agents.map((a) => a.id);
    const heartbeatLogs = agentIds.length
      ? await prisma.activityLog.findMany({
          where: {
            userId: { in: agentIds },
            action: SUPPORT_HEARTBEAT_ACTION,
            createdAt: { gte: onlineSince },
          },
          select: { userId: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const activeById = new Map<string, Date>();
    for (const log of heartbeatLogs) {
      if (!activeById.has(log.userId)) {
        activeById.set(log.userId, log.createdAt);
      }
    }

    res.json({
      success: true,
      data: agents.map((agent) => ({
        id: agent.id,
        firstName: agent.firstName,
        lastName: agent.lastName,
        role: agent.role,
        online:
          agent.id === req.user!.id ||
          activeById.has(agent.id) ||
          Boolean(agent.lastLoginAt && agent.lastLoginAt >= recentLoginSince),
        lastSeenAt: activeById.get(agent.id) || agent.lastLoginAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function assignSupportAgent(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;
    const payload = req.body as { userId?: string };
    const targetUserId = payload.userId || req.user!.id;

    const conversation = await prisma.conversation.findFirst({
      where: { id, hotelId },
      include: {
        guest: { select: { firstName: true, lastName: true, email: true } },
        booking: { select: { bookingRef: true, checkInDate: true, checkOutDate: true } },
      },
    });

    if (!conversation) {
      res.status(404).json({ success: false, error: 'Conversation not found' });
      return;
    }

    const agent = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        hotelId,
        isActive: true,
      },
      select: { id: true, firstName: true, lastName: true, role: true },
    });

    if (!agent) {
      res.status(404).json({ success: false, error: 'Support agent not found' });
      return;
    }

    const assignmentPayload = JSON.stringify({
      userId: agent.id,
      firstName: agent.firstName,
      lastName: agent.lastName,
      role: agent.role,
      assignedAt: new Date().toISOString(),
      assignedById: req.user!.id,
    });

    const assignmentMessage = await prisma.$transaction(async (tx) => {
      const assignment = await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderType: 'SYSTEM',
          body: `${ASSIGNMENT_PREFIX} ${assignmentPayload}`,
        },
        include: {
          senderUser: { select: { firstName: true, lastName: true, role: true } },
          guest: { select: { firstName: true, lastName: true } },
        },
      });

      await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderType: 'STAFF',
          senderUserId: agent.id,
          body: `Hi, thank you for contacting LaFlo. My name is ${agent.firstName}. How may I assist you?`,
        },
      });
      return assignment;
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: 'OPEN', lastMessageAt: assignmentMessage.createdAt },
    });

    const refreshed = await prisma.conversation.findUnique({
      where: { id: conversation.id },
      include: {
        guest: { select: { firstName: true, lastName: true, email: true } },
        booking: { select: { bookingRef: true, checkInDate: true, checkOutDate: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            senderUser: { select: { firstName: true, lastName: true, role: true } },
            guest: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    res.json({ success: true, data: refreshed ? serializeThreadSummary(refreshed) : null });
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
