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

type PlatformGuide = {
  id: string;
  title: string;
  permission: string;
  route: string;
  steps: string[];
  notes?: string[];
};

function platformGuideFor(message: string): PlatformGuide | null {
  const text = message.toLowerCase();
  const cameraTopic = /(camera|cctv|nvr|onvif|video surveillance)/.test(text);
  const setupIntent = /(add|install|connect|configure|configuration|set up|setup|integrate|onboard|discover|import)/.test(text);

  if (cameraTopic && setupIntent) {
    return {
      id: 'cctv-setup',
      title: 'Add a CCTV camera or NVR',
      permission: 'settings',
      route: '/settings?tab=integrations',
      steps: [
        'Open Settings, then Integrations.',
        'In Integration Manager, select the CCTV category and open Setup Flow.',
        'Select Add Camera / NVR.',
        'Choose Discover IP Cameras, Connect NVR, Add Manual Camera, or a supported Cloud Provider.',
        'Enter the connection details in the secure setup form, then run the connection test.',
        'Import or save the camera channels and map each one to the correct hotel area.',
        'Return to Security Center > CCTV to confirm stream health and operational status.',
      ],
      notes: [
        'Local Camera / Staff Device Camera is only for calls and staff support; it is not saved as CCTV.',
        'IP discovery requires the ONVIF discovery worker and secure media gateway. Cloud options marked coming soon are not production connections.',
        'Never paste camera passwords, RTSP URLs, API keys, or device secrets into chat.',
      ],
    };
  }

  if (cameraTopic) {
    return {
      id: 'cctv-monitoring',
      title: 'Review CCTV cameras',
      permission: 'security_center',
      route: '/security-center/cctv',
      steps: [
        'Open Security Center and select CCTV.',
        'Review each camera status, location, and last-seen time.',
        'For an offline camera, review its provider and connection health in Settings > Integrations.',
      ],
    };
  }

  if (/(check.?in|arriving guest)/.test(text) && /(how|process|complete|do i|steps)/.test(text)) {
    return {
      id: 'guest-check-in',
      title: 'Check in a guest',
      permission: 'bookings',
      route: '/bookings',
      steps: [
        'Open Bookings and find the arriving reservation.',
        'Open the booking and verify guest, stay, room, and payment details.',
        'Confirm the assigned room is ready.',
        'Use the available check-in action and confirm the updated booking status.',
      ],
    };
  }

  if (/(room readiness|room status)/.test(text) && /(update|change|set|how)/.test(text)) {
    return {
      id: 'room-readiness',
      title: 'Update room readiness',
      permission: 'rooms',
      route: '/rooms',
      steps: [
        'Open Rooms and find the room by number, floor, or status.',
        'Open the room record and review housekeeping or maintenance blockers.',
        'Apply the permitted readiness status only after the operational checks are complete.',
      ],
    };
  }

  if (/(user|staff|employee)/.test(text) && /(add|invite|access|permission|approve)/.test(text)) {
    return {
      id: 'user-access',
      title: 'Manage staff access',
      permission: 'users',
      route: '/users',
      steps: [
        'Open User Management.',
        'Review the access request or select the relevant user.',
        'Assign only the required role and module permissions.',
        'Approve, reject, disable, or update access using the available action.',
      ],
    };
  }

  if (/(integration|provider|hardware|device)/.test(text) && setupIntent) {
    return {
      id: 'integration-setup',
      title: 'Configure an integration',
      permission: 'settings',
      route: '/settings?tab=integrations',
      steps: [
        'Open Settings, then Integrations.',
        'Select the relevant Integration Manager category.',
        'Open Setup Flow and follow the provider or hardware requirements.',
        'Test the connection, map imported devices, and review Logs for failures.',
      ],
      notes: ['Credentials and device secrets must be entered only in the secure integration form.'],
    };
  }

  if (/(maintenance|repair|fault|work order)/.test(text) && /(create|add|report|log|raise|how)/.test(text)) {
    return {
      id: 'maintenance-work-order',
      title: 'Create or review maintenance work',
      permission: 'maintenance_center',
      route: '/maintenance-center',
      steps: [
        'Open Maintenance Center.',
        'Choose the relevant fault, repair, or work-order view.',
        'Record the location, asset, priority, details, and permitted assignment.',
        'Track the item through completion and verify any room blocker is cleared.',
      ],
    };
  }

  return null;
}

function hasModuleAccess(role: Role, permissions: string[], permission: string) {
  return role === Role.ADMIN || permissions.includes(permission);
}

function buildFallbackReply(
  message: string,
  sections: AIContextSection[],
  applicationContext: Record<string, string> | null,
  role: Role,
  modulePermissions: string[],
  platformGuide: PlatformGuide | null
): string {
  const normalized = message.toLowerCase();
  const currentPage = applicationContext?.pageTitle || 'your current page';
  if (platformGuide) {
    if (!hasModuleAccess(role, modulePermissions, platformGuide.permission)) {
      return `Your current role does not include access to ${platformGuide.title}. Ask an administrator if this access is required.`;
    }
    return [
      `${platformGuide.title}:`,
      ...platformGuide.steps.map((step, index) => `${index + 1}. ${step}`),
      ...(platformGuide.notes?.length
        ? ['', 'Important:', ...platformGuide.notes.map((note) => `- ${note}`)]
        : []),
      '',
      'I am using verified LaFlo platform guidance while live operational insights reconnect.',
    ].join('\n');
  }
  const guidance: Array<{
    keywords: string[];
    section: AIContextSection;
    module: string;
    steps: string[];
  }> = [
    {
      keywords: ['cctv', 'camera', 'security'],
      section: 'security',
      module: 'Security Center',
      steps: ['Open Security Center from the sidebar.', 'Select CCTV or the relevant camera.', 'Review stream health, alerts, and provider status.'],
    },
    {
      keywords: ['booking', 'reservation', 'check-in', 'check out', 'check-out'],
      section: 'bookings',
      module: 'Bookings',
      steps: ['Open Bookings from the sidebar.', 'Use search or filters to find the reservation.', 'Open the record to review or update its permitted details.'],
    },
    {
      keywords: ['room', 'occupancy', 'readiness'],
      section: 'occupancy',
      module: 'Rooms',
      steps: ['Open Rooms from the sidebar.', 'Filter by floor, status, or readiness.', 'Open a room to review its permitted operational details.'],
    },
    {
      keywords: ['housekeeping', 'clean', 'dirty room'],
      section: 'housekeeping',
      module: 'Housekeeping',
      steps: ['Open Housekeeping from the sidebar.', 'Filter by readiness or assignment.', 'Open the task or room before updating its status.'],
    },
    {
      keywords: ['maintenance', 'repair', 'fault'],
      section: 'maintenance',
      module: 'Maintenance Center',
      steps: ['Open Maintenance Center from the sidebar.', 'Search for the asset, room, or work order.', 'Review priority and assignment before taking action.'],
    },
    {
      keywords: ['guest'],
      section: 'guests',
      module: 'Guests',
      steps: ['Open Guests from the sidebar.', 'Search for the guest using an authorised identifier.', 'Open the profile to review permitted details and activity.'],
    },
    {
      keywords: ['invoice', 'revenue', 'financial', 'payment'],
      section: 'financialSummary',
      module: 'Financials',
      steps: ['Open Financials from the sidebar.', 'Choose the correct property and reporting period.', 'Review the permitted transaction, invoice, or KPI detail.'],
    },
    {
      keywords: ['message', 'chat', 'support'],
      section: 'messages',
      module: 'Messages',
      steps: ['Open Messages from the sidebar.', 'Select the relevant conversation or support thread.', 'Use live helpdesk below if staff assistance is required.'],
    },
  ];

  const match = guidance.find((item) => item.keywords.some((keyword) => normalized.includes(keyword)));
  if (match && !sections.includes(match.section)) {
    return `Your current role does not include access to ${match.module}. Ask an administrator if this access is required.`;
  }
  if (match) {
    return [
      `For ${match.module}:`,
      ...match.steps.map((step) => `- ${step}`),
      '',
      'I am using built-in LaFlo guidance while live operational insights reconnect.',
    ].join('\n');
  }

  return [
    `You can continue from ${currentPage}.`,
    '- Tell me the module or task you need help with, such as bookings, rooms, housekeeping, CCTV, maintenance, guests, or financials.',
    '- I can guide you to the correct authorised page and next action.',
    '',
    'I am using built-in LaFlo guidance while live operational insights reconnect.',
  ].join('\n');
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
  const platformGuide = platformGuideFor(trimmed);
  structuredContext.platformGuidance = platformGuide
    ? { ...platformGuide, accessible: hasModuleAccess(user.role, user.modulePermissions || [], platformGuide.permission) }
    : null;

  let usedFallback = false;
  let reply: string;
  try {
    reply = await runOpsAssistant({
      hotelId,
      userId,
      message: trimmed,
      context: structuredContext,
    });
  } catch (error) {
    usedFallback = true;
    reply = buildFallbackReply(
      trimmed,
      sections,
      applicationContext,
      user.role,
      user.modulePermissions || [],
      platformGuide
    );
    console.warn('Assistant provider unavailable; built-in guidance returned.', {
      hotelId,
      userId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }

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
      usedFallback,
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
