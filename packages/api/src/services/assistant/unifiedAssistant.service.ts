import { ConversationStatus, MessageSender, Role } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { runOpsAssistant } from '../ai/opsAssistant.service.js';
import { buildHotelContext, type AIContextSection } from '../../ai/context/index.js';
import { recordAuditEvent } from '../../platform/audit/auditEngine.service.js';

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

const ALL_ASSISTANT_SECTIONS: AIContextSection[] = [
  'hotelProfile', 'occupancy', 'revenue', 'weather', 'bookings', 'guests',
  'housekeeping', 'maintenance', 'security', 'smartBuilding', 'incidents',
  'tasks', 'reviews', 'messages', 'financialSummary',
];

const SECTION_PERMISSIONS: Record<AIContextSection, string[]> = {
  hotelProfile: ['dashboard', 'settings'],
  occupancy: ['dashboard', 'bookings', 'rooms'],
  revenue: ['financials'],
  weather: ['dashboard', 'bookings'],
  bookings: ['bookings'],
  guests: ['guests', 'bookings'],
  housekeeping: ['housekeeping', 'rooms'],
  maintenance: ['maintenance_center'],
  security: ['security_center'],
  smartBuilding: ['smart_building'],
  incidents: ['incident_management', 'security_center', 'maintenance_center', 'smart_building'],
  tasks: ['dashboard', 'bookings', 'housekeeping', 'maintenance_center', 'security_center', 'smart_building', 'messages'],
  reviews: ['reviews'],
  messages: ['messages'],
  financialSummary: ['financials'],
  guest: ['guests'],
  room: ['rooms'],
  incident: ['incident_management'],
};

function allowedSections(role: Role, modulePermissions: string[]): AIContextSection[] {
  if (role === Role.ADMIN) return ALL_ASSISTANT_SECTIONS;
  return ALL_ASSISTANT_SECTIONS.filter((section) =>
    SECTION_PERMISSIONS[section].some((permission) => modulePermissions.includes(permission))
  );
}

function sanitizeApplicationContext(context: Record<string, unknown> | null) {
  if (!context) return null;
  const allowedKeys = ['route', 'pageTitle', 'module', 'recordId', 'locale', 'timezone'];
  return allowedKeys.reduce<Record<string, string>>((result, key) => {
    const value = context[key];
    if (typeof value === 'string' && value.trim()) result[key] = value.trim().slice(0, 180);
    return result;
  }, {});
}

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

  const user = await prisma.user.findFirst({
    where: { id: userId, hotelId, isActive: true },
    select: { role: true, modulePermissions: true },
  });
  if (!user) throw new Error('User not found or inactive');
  const sections = allowedSections(user.role, user.modulePermissions || []);

  let conversationId = incomingConversationId;
  if (conversationId) {
    const existing = await prisma.conversation.findFirst({
      where: { id: conversationId, hotelId },
      select: { id: true },
    });
    const userMessage = existing
      ? await prisma.message.findFirst({
          where: { conversationId, senderUserId: userId },
          select: { id: true },
        })
      : null;
    if (!existing || !userMessage) conversationId = null;
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

  const applicationContext = sanitizeApplicationContext(context);
  const hotelContext = sections.length
    ? await buildHotelContext(hotelId, { sections, limit: 12 })
    : null;
  const structuredContext: Record<string, unknown> = {
    application: applicationContext,
    authorisedHotelContext: hotelContext,
    access: { role: user.role, allowedContextSections: sections },
    mode,
  };

  const reply = await runOpsAssistant({
    hotelId,
    userId,
    message: trimmed,
    context: structuredContext,
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

  await recordAuditEvent({
    hotelId,
    actor: { userId },
    action: 'ASSISTANT_RESPONSE_GENERATED',
    entity: 'ASSISTANT_CONVERSATION',
    entityId: conversationId,
    source: 'laflo-assistant',
    details: {
      mode,
      route: applicationContext?.route,
      allowedContextSections: sections,
      questionLength: trimmed.length,
    },
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
