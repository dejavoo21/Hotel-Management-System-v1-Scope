import { ConversationStatus, MessageSender } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { runOpsAssistant } from '../ai/opsAssistant.service.js';

export type UnifiedChatMode = 'general' | 'operations' | 'pricing' | 'weather' | 'tasks';

export type UnifiedChatArgs = {
  hotelId: string;
  userId: string;
  message: string;
  mode?: UnifiedChatMode;
  context?: Record<string, unknown> | null;
  conversationId?: string | null;
  subjectPrefix?: string;
};

export type UnifiedChatResult = {
  reply: string;
  mode: UnifiedChatMode;
  conversationId: string;
  generatedAtUtc: string;
};

export async function unifiedAssistantChat(args: UnifiedChatArgs): Promise<UnifiedChatResult> {
  const {
    hotelId,
    userId,
    message,
    mode = 'general',
    context = null,
    conversationId: incomingConversationId = null,
    subjectPrefix = 'Assistant',
  } = args;

  const trimmed = String(message ?? '').trim();
  if (!trimmed) {
    throw new Error('message is required');
  }

  let conversationId = incomingConversationId;
  if (conversationId) {
    const existing = await prisma.conversation.findFirst({
      where: { id: conversationId, hotelId },
      select: { id: true },
    });
    if (!existing) conversationId = null;
  }

  if (!conversationId) {
    const created = await prisma.conversation.create({
      data: {
        hotelId,
        status: ConversationStatus.OPEN,
        subject: `${subjectPrefix} (${mode})`,
        lastMessageAt: new Date(),
      },
      select: { id: true },
    });
    conversationId = created.id;
  }

  await prisma.message.create({
    data: {
      conversationId,
      senderType: MessageSender.STAFF,
      senderUserId: userId,
      body: trimmed,
    },
  });

  const contextBlock =
    context && typeof context === 'object'
      ? `\n\nMode: ${mode}\nContext:\n${JSON.stringify(context).slice(0, 6000)}`
      : `\n\nMode: ${mode}`;

  const reply = await runOpsAssistant({
    hotelId,
    userId,
    message: `${trimmed}${contextBlock}`,
  });

  await prisma.message.create({
    data: {
      conversationId,
      senderType: MessageSender.SYSTEM,
      body: reply,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  return {
    reply,
    mode,
    conversationId,
    generatedAtUtc: new Date().toISOString(),
  };
}

export function unifiedAssistantStatus() {
  const provider = String(process.env.ASSISTANT_PROVIDER || 'openai').toLowerCase();
  const hasKey = Boolean(process.env.OPENAI_API_KEY);

  return {
    provider,
    enabled: provider !== 'none',
    hasKey,
    live: provider !== 'none' && hasKey,
    model: process.env.OPENAI_MODEL || 'gpt-4.1-nano',
  };
}
