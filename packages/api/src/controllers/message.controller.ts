import { Response, NextFunction, Request } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { prisma } from '../config/database.js';
import { config } from '../config/index.js';
import { Role } from '@prisma/client';
import twilio from 'twilio';
import { ensureTicketForConversation, recordFirstResponse } from '../services/ticket.service.js';

const LIVE_SUPPORT_SUBJECT = 'Live Support';
const SUPPORT_HEARTBEAT_ACTION = 'SUPPORT_HEARTBEAT';
const ASSIGNMENT_PREFIX = '[SUPPORT_ASSIGNED]';
const BOT_HANDOFF_CONNECTING = 'I am now connecting you with one of our live Customer Support Agents for further assistance.';
const BOT_HANDOFF_WAITING = 'Hi, thank you for requesting to chat with an agent. Our agent will be with you shortly.';
const VOICE_TOKEN_TTL_SECONDS = 60 * 60;

const sanitizePhone = (value?: string) => (value || '').replace(/[^\d+]/g, '');
const sanitizeVideoRoom = (value?: string) =>
  (value || '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
const isAssignmentMessage = (body: string) => body.includes(ASSIGNMENT_PREFIX);
const isVoiceConfigured = () =>
  Boolean(
    config.voice.twilioAccountSid &&
      config.voice.twilioApiKeySid &&
      config.voice.twilioApiKeySecret &&
      config.voice.twimlAppSid &&
      config.voice.fromPhone
  );
const isPhoneCallConfigured = () =>
  Boolean(
    config.voice.twilioAccountSid &&
      config.voice.twilioAuthToken &&
      config.voice.fromPhone
  );
const isVideoConfigured = () =>
  Boolean(
    config.voice.twilioAccountSid &&
      config.voice.twilioApiKeySid &&
      config.voice.twilioApiKeySecret
  );

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
  const start = body.indexOf(ASSIGNMENT_PREFIX);
  if (start < 0) return null;
  const jsonText = body.slice(start + ASSIGNMENT_PREFIX.length).trim();
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
  const visibleMessages = conversation.messages.filter((msg) => !isAssignmentMessage(msg.body));
  const lastMessage = visibleMessages[0];
  const assignmentMessage = conversation.messages.find((msg) => isAssignmentMessage(msg.body));
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
        guest: { select: { firstName: true, lastName: true, email: true, phone: true } },
        booking: { select: { bookingRef: true, checkInDate: true, checkOutDate: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            senderUser: { select: { id: true, firstName: true, lastName: true, role: true } },
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
        guest: { select: { firstName: true, lastName: true, email: true, phone: true } },
        booking: { select: { bookingRef: true, checkInDate: true, checkOutDate: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            senderUser: { select: { id: true, firstName: true, lastName: true, role: true } },
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
      .find((message) => isAssignmentMessage(message.body));
    const assignedSupport = assignmentMessage ? parseAssignedUser(assignmentMessage.body) : null;
    const visibleMessages = conversation.messages.filter((message) => !isAssignmentMessage(message.body));

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
        guest: { select: { firstName: true, lastName: true, email: true, phone: true } },
        booking: { select: { bookingRef: true, checkInDate: true, checkOutDate: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            senderUser: { select: { id: true, firstName: true, lastName: true, role: true } },
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
          guest: { select: { firstName: true, lastName: true, email: true, phone: true } },
          booking: { select: { bookingRef: true, checkInDate: true, checkOutDate: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: {
              senderUser: { select: { id: true, firstName: true, lastName: true, role: true } },
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
              senderUser: { select: { id: true, firstName: true, lastName: true, role: true } },
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
              senderUser: { select: { id: true, firstName: true, lastName: true, role: true } },
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
              senderUser: { select: { id: true, firstName: true, lastName: true, role: true } },
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

export async function getSupportVoiceToken(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    if (!isVoiceConfigured()) {
      res.status(503).json({ success: false, error: 'In-app voice calling is not configured yet' });
      return;
    }

    const identity = `support:${req.user!.hotelId}:${req.user!.id}`;
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(
      config.voice.twilioAccountSid,
      config.voice.twilioApiKeySid,
      config.voice.twilioApiKeySecret,
      {
        identity,
        ttl: VOICE_TOKEN_TTL_SECONDS,
      }
    );

    token.addGrant(
      new VoiceGrant({
        outgoingApplicationSid: config.voice.twimlAppSid,
        incomingAllow: false,
      })
    );

    res.json({
      success: true,
      data: {
        token: token.toJwt(),
        identity,
        fromPhone: config.voice.fromPhone,
        enabled: true,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getSupportVideoToken(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    if (!isVideoConfigured()) {
      res.status(503).json({ success: false, error: 'In-app video calling is not configured yet' });
      return;
    }

    const requestedRoom =
      (req.query?.room as string | undefined) ||
      (req.body?.room as string | undefined) ||
      '';
    const room = sanitizeVideoRoom(requestedRoom) || `laflo-support-${req.user!.hotelId}`;
    const identity = `support-video:${req.user!.hotelId}:${req.user!.id}`;

    const AccessToken = twilio.jwt.AccessToken;
    const VideoGrant = AccessToken.VideoGrant;
    const token = new AccessToken(
      config.voice.twilioAccountSid,
      config.voice.twilioApiKeySid,
      config.voice.twilioApiKeySecret,
      {
        identity,
        ttl: VOICE_TOKEN_TTL_SECONDS,
      }
    );

    token.addGrant(new VideoGrant({ room }));

    res.json({
      success: true,
      data: {
        token: token.toJwt(),
        identity,
        room,
        enabled: true,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function supportVoiceTwiml(
  req: Request,
  res: Response
): Promise<void> {
  const response = new twilio.twiml.VoiceResponse();
  const to = sanitizePhone((req.body?.To as string | undefined) || (req.query?.To as string | undefined));
  const callerId = sanitizePhone(config.voice.fromPhone);

  if (!isVoiceConfigured() || !callerId) {
    response.say('Voice calling is not configured.');
    response.hangup();
    res.type('text/xml').send(response.toString());
    return;
  }

  if (!to) {
    response.say('No phone number was provided.');
    response.hangup();
    res.type('text/xml').send(response.toString());
    return;
  }

  const dial = response.dial({
    callerId,
    answerOnBridge: true,
    timeout: 20,
  });
  dial.number(to);
  res.type('text/xml').send(response.toString());
}

export async function startSupportPhoneCall(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    if (!isPhoneCallConfigured()) {
      res.status(503).json({
        success: false,
        error: 'Twilio phone calling is not configured yet',
      });
      return;
    }

    const to = sanitizePhone((req.body?.to as string | undefined) || '');
    const threadId = (req.body?.threadId as string | undefined) || undefined;
    const callerId = sanitizePhone(config.voice.fromPhone);

    if (!to || !/^\+?\d{7,15}$/.test(to)) {
      res.status(400).json({ success: false, error: 'Valid destination phone is required' });
      return;
    }

    const twilioClient = twilio(config.voice.twilioAccountSid, config.voice.twilioAuthToken);
    const call = await twilioClient.calls.create({
      to,
      from: callerId,
      twiml:
        '<Response><Say voice="alice">This is a test call from LaFlo support. Your support team initiated this call via Twilio.</Say></Response>',
    });

    res.json({
      success: true,
      data: {
        sid: call.sid,
        status: call.status,
        to,
        from: callerId,
        threadId,
      },
      message: 'Twilio test call started',
    });
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
    const recentMessageSince = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const recentActivitySince = new Date(Date.now() - 12 * 60 * 60 * 1000);
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
            createdAt: { gte: recentActivitySince },
          },
          select: { userId: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    const recentActivityLogs = agentIds.length
      ? await prisma.activityLog.findMany({
          where: {
            userId: { in: agentIds },
            createdAt: { gte: recentActivitySince },
          },
          select: { userId: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    const recentStaffMessages = agentIds.length
      ? await prisma.message.findMany({
          where: {
            senderUserId: { in: agentIds },
            createdAt: { gte: recentMessageSince },
          },
          select: { senderUserId: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    const latestHeartbeatById = new Map<string, Date>();
    const onlineHeartbeatById = new Set<string>();
    for (const log of heartbeatLogs) {
      if (!latestHeartbeatById.has(log.userId)) {
        latestHeartbeatById.set(log.userId, log.createdAt);
      }
      if (log.createdAt >= onlineSince) {
        onlineHeartbeatById.add(log.userId);
      }
    }
    const latestActivityById = new Map<string, Date>();
    for (const log of recentActivityLogs) {
      if (!latestActivityById.has(log.userId)) {
        latestActivityById.set(log.userId, log.createdAt);
      }
    }
    const latestStaffMessageById = new Map<string, Date>();
    for (const row of recentStaffMessages) {
      if (row.senderUserId && !latestStaffMessageById.has(row.senderUserId)) {
        latestStaffMessageById.set(row.senderUserId, row.createdAt);
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
          onlineHeartbeatById.has(agent.id),
        lastSeenAt:
          latestHeartbeatById.get(agent.id) ||
          latestStaffMessageById.get(agent.id) ||
          latestActivityById.get(agent.id) ||
          agent.lastLoginAt,
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
          guest: { select: { firstName: true, lastName: true, email: true, phone: true } },
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
          senderUser: { select: { id: true, firstName: true, lastName: true, role: true } },
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
        guest: { select: { firstName: true, lastName: true, email: true, phone: true } },
        booking: { select: { bookingRef: true, checkInDate: true, checkOutDate: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            senderUser: { select: { id: true, firstName: true, lastName: true, role: true } },
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
        senderUser: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: message.createdAt },
    });

    // Ensure ticket exists and record first response (staff replying means response)
    try {
      const ticket = await ensureTicketForConversation(conversation.id, req.user!.id);
      await recordFirstResponse(ticket.id, req.user!.id);
    } catch (ticketError) {
      // Log but don't fail the message send
      console.error('Ticket creation/response error:', ticketError);
    }

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
