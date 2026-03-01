import { MessageSender } from '@prisma/client';
import { prisma } from '../config/database.js';

const formatTimestamp = (value: Date): string =>
  value.toISOString().replace('T', ' ').replace('Z', ' UTC');

const fullName = (firstName?: string | null, lastName?: string | null): string | null => {
  const name = [firstName ?? '', lastName ?? ''].join(' ').trim();
  return name || null;
};

type TranscriptMessage = {
  senderType: MessageSender;
  senderUser: { firstName: string; lastName: string } | null;
  guest: { firstName: string; lastName: string } | null;
};

const senderLabel = (message: TranscriptMessage): string => {
  if (message.senderType === MessageSender.SYSTEM) return 'System';

  if (message.senderType === MessageSender.GUEST) {
    return fullName(message.guest?.firstName, message.guest?.lastName) ?? 'Guest';
  }

  return fullName(message.senderUser?.firstName, message.senderUser?.lastName) ?? 'Staff';
};

export async function buildConversationTranscript(conversationId: string, hotelId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, hotelId },
    select: {
      id: true,
      subject: true,
      status: true,
      createdAt: true,
      bookingId: true,
      guestId: true,
    },
  });

  if (!conversation) {
    const error = new Error('Conversation not found') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      senderType: true,
      body: true,
      createdAt: true,
      senderUser: { select: { firstName: true, lastName: true } },
      guest: { select: { firstName: true, lastName: true } },
    },
  });

  const headerLines = [
    `Conversation: ${conversation.id}`,
    `Subject: ${conversation.subject || '(none)'}`,
    `Status: ${conversation.status}`,
    `Created: ${formatTimestamp(conversation.createdAt)}`,
    conversation.bookingId ? `Booking: ${conversation.bookingId}` : null,
    conversation.guestId ? `GuestId: ${conversation.guestId}` : null,
    '',
    '--- Transcript ---',
    '',
  ].filter(Boolean) as string[];

  const bodyLines = messages.map((message) => {
    const who = senderLabel(message);
    return `[${formatTimestamp(message.createdAt)}] ${who}: ${message.body}`;
  });

  const text = [...headerLines, ...bodyLines, '', '--- End ---', ''].join('\n');

  return {
    conversation,
    messages,
    text,
  };
}
