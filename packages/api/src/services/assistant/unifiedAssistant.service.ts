import { ConversationStatus, MessageSender, Role } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { runOpsAssistant } from '../ai/opsAssistant.service.js';
import { buildHotelContext, type AIContextSection } from '../../ai/context/index.js';
import { recordAuditEvent } from '../../platform/audit/auditEngine.service.js';
import {
  findPlatformInterface,
  findPlatformInterfaceByRoute,
  getPlatformInterfaceGuidance,
  getAuthorisedInterfaces,
} from './platformKnowledge.js';

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
  needsHumanSupport: boolean;
  supportReason: string | null;
  suggestedPrompts: string[];
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
  summary?: string;
  keyAreas?: Array<{ name: string; description: string }>;
  priorities?: string[];
  followUpPrompts?: string[];
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

function catalogueGuideFor(message: string, currentRoute?: string): PlatformGuide | null {
  const item = findPlatformInterface(message) || findPlatformInterfaceByRoute(currentRoute);
  if (!item) return null;
  const guidance = getPlatformInterfaceGuidance(item);
  return {
    id: item.id,
    title: item.name,
    permission: item.permission,
    route: item.route,
    steps: item.tasks,
    summary: guidance.summary,
    keyAreas: guidance.keyAreas,
    priorities: guidance.priorities,
    followUpPrompts: guidance.followUpPrompts,
  };
}

function isInterfaceExplanationRequest(message: string) {
  return /(explain|overview|what can i do|what is this|what.*page|how.*page.*work|guide me|walk me through|take me through|page tour|help me understand)/i.test(message);
}

function isDelegatedDeepDiveRequest(message: string) {
  return /(dive\s*(?:deep|deeper)|go\s*(?:deep|deeper)|pick\s+(?:something|one|an?\s+area)|choose\s+(?:something|one|an?\s+area)|analyse\s+(?:something|one)|analyze\s+(?:something|one))/i.test(message);
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function countItems(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function buildDashboardDeepDiveReply(
  message: string,
  hotelContext: Record<string, unknown> | null
): { reply: string; prompts: string[] } | null {
  if (!isDelegatedDeepDiveRequest(message) || !hotelContext) return null;

  const security = recordValue(hotelContext.security);
  const smartBuilding = recordValue(hotelContext.smartBuilding);
  const tasks = recordValue(hotelContext.tasks);
  const housekeeping = recordValue(hotelContext.housekeeping);
  const occupancy = recordValue(hotelContext.occupancy);
  const incidents = recordValue(hotelContext.incidents);

  const criticalIncidents = countItems(incidents.criticalIncidents);
  const activeSecurityAlerts = countItems(security.activeSecurityAlerts);
  const offlineCameras = countItems(smartBuilding.cameraOfflineEvents);
  const offlineDevices = countItems(smartBuilding.devicesOffline);
  const criticalSensors = countItems(smartBuilding.criticalSensors);
  const doorEvents = countItems(smartBuilding.doorForcedOpenEvents);
  const overdueTasks = countItems(tasks.overdueTasks);
  const highPriorityTasks = countItems(tasks.highPriority);
  const dirtyRooms = numberValue(housekeeping.dirtyRooms);
  const inspectionRooms = numberValue(housekeeping.inspectionRooms);
  const outOfServiceRooms = numberValue(housekeeping.outOfServiceRooms);
  const arrivalsToday = numberValue(occupancy.arrivalsToday);
  const roomsTotal = numberValue(occupancy.roomsTotal);
  const roomsAvailable = numberValue(occupancy.roomsAvailable);

  if (criticalIncidents + activeSecurityAlerts + offlineCameras + offlineDevices + criticalSensors + doorEvents > 0) {
    const signals = [
      criticalIncidents ? `${criticalIncidents} critical incident${criticalIncidents === 1 ? '' : 's'}` : null,
      activeSecurityAlerts ? `${activeSecurityAlerts} active security alert${activeSecurityAlerts === 1 ? '' : 's'}` : null,
      offlineCameras ? `${offlineCameras} offline camera${offlineCameras === 1 ? '' : 's'}` : null,
      offlineDevices ? `${offlineDevices} offline or warning device${offlineDevices === 1 ? '' : 's'}` : null,
      criticalSensors ? `${criticalSensors} critical sensor reading${criticalSensors === 1 ? '' : 's'}` : null,
      doorEvents ? `${doorEvents} recent forced/held-open door event${doorEvents === 1 ? '' : 's'}` : null,
    ].filter(Boolean);
    return {
      reply: [
        'I’ll choose Operational attention: Security and Smart Building.',
        '',
        `Why I chose it: the authorised live context currently shows ${signals.join(', ')}. These signals can affect guest safety, access control, and the hotel’s ability to detect an incident, so they outrank routine dashboard review.`,
        '',
        'What to investigate first:',
        '1. Open the highest-severity active alert and confirm its location, time, owner, and acknowledgement status.',
        '2. For an offline camera or device, check last-seen time and provider/integration health before treating it as a hardware failure.',
        '3. Correlate door or sensor events with CCTV and access logs for the same location and time.',
        '4. Assign an owner and escalation deadline; do not close the item until monitoring is restored or a documented control is in place.',
        '',
        'Operational meaning: an offline device is not automatically an incident, but it creates a monitoring gap. A monitoring gap combined with a door, sensor, or security alert should be handled as the higher priority.',
        '',
        'Would you like me to dive next into the camera/device outage, the security alerts, or the door events?',
      ].join('\n'),
      prompts: ['Analyse the camera and device outage', 'Break down the active security alerts', 'Explain the door events and next actions'],
    };
  }

  if (overdueTasks + highPriorityTasks > 0) {
    return {
      reply: [
        'I’ll choose Tasks and operational ownership.',
        '',
        `Why I chose it: there are ${overdueTasks} overdue and ${highPriorityTasks} high-priority task records in the authorised live context.`,
        '',
        'What to review:',
        '1. Start with overdue items that affect safety, arrivals, room availability, or guest commitments.',
        '2. Confirm every urgent item has an owner, due time, and visible next action.',
        '3. Escalate breached work rather than duplicating it, then verify completion evidence before closure.',
        '',
        'Would you like me to focus on overdue work or high-priority work?',
      ].join('\n'),
      prompts: ['Analyse the overdue tasks', 'Analyse the high-priority tasks', 'How should these tasks be escalated?'],
    };
  }

  return {
    reply: [
      'I’ll choose Room readiness because it directly controls whether Front Desk can allocate rooms safely and on time.',
      '',
      `Current authorised context: ${dirtyRooms} dirty, ${inspectionRooms} awaiting inspection, ${outOfServiceRooms} out of service, ${roomsAvailable} available out of ${roomsTotal || 'the configured'} rooms, with ${arrivalsToday} arrival${arrivalsToday === 1 ? '' : 's'} today.`,
      '',
      'How to interpret it:',
      '- Dirty rooms need cleaning before they can enter the inspection/ready workflow.',
      '- Inspection rooms may be close to ready but must not be allocated until the required check passes.',
      '- Out-of-service rooms reduce sellable capacity and should have a linked maintenance reason and owner.',
      '',
      'What to do next:',
      '1. Match today’s arrivals to rooms that are not ready.',
      '2. Prioritise those rooms by arrival time and guest requirement.',
      '3. Confirm housekeeping assignment, blocker, and expected completion time.',
      '4. Escalate maintenance or failed-inspection blockers before promising the room.',
      '',
      'Would you like me to focus on the dirty rooms, inspection queue, or out-of-service rooms?',
    ].join('\n'),
    prompts: ['Focus on the dirty rooms', 'Explain the inspection queue', 'Analyse the out-of-service rooms'],
  };
}

function buildVerifiedGuideReply(guide: PlatformGuide) {
  if (!guide.summary || !guide.keyAreas?.length) {
    return [
      `${guide.title}:`,
      ...guide.steps.map((step, index) => `${index + 1}. ${step}`),
      ...(guide.notes?.length ? ['', 'Important:', ...guide.notes.map((note) => `- ${note}`)] : []),
    ].join('\n');
  }

  return [
    `${guide.title}`,
    guide.summary,
    '',
    'What you’ll find here:',
    ...guide.keyAreas.map((area) => `- ${area.name}: ${area.description}`),
    '',
    'What to review first:',
    ...(guide.priorities || []).map((priority, index) => `${index + 1}. ${priority}`),
    '',
    'Common actions:',
    ...guide.steps.map((step) => `- ${step}`),
    '',
    'Your view is role-based, so you will only see records and actions your LaFlo permissions allow.',
  ].join('\n');
}

type AssistantWeatherSnapshot = {
  city?: string | null;
  country?: string | null;
  syncedAtUtc?: string | null;
  isFresh?: boolean;
  stale?: boolean;
  current?: {
    temperatureC?: number | null;
    feelsLikeC?: number | null;
    summary?: string | null;
    observedAtUtc?: string | null;
  } | null;
  next24h?: {
    summary?: string | null;
    highC?: number | null;
    lowC?: number | null;
    rainRisk?: string | null;
  } | null;
};

function isCurrentWeatherQuestion(message: string) {
  const text = message.toLowerCase();
  const asksForWeather = /(weather|temperature|forecast|condition|city|location)/.test(text);
  const asksForCurrentValue = /(current|now|today|what is|what's|tell me|show me)/.test(text);
  return asksForWeather && asksForCurrentValue;
}

export function buildDirectWeatherReply(
  message: string,
  hotelContext: {
    hotelProfile?: { city?: string; country?: string };
    weather?: Record<string, unknown>;
  } | null
): string | null {
  if (!isCurrentWeatherQuestion(message)) return null;

  const weatherSection = hotelContext?.weather as
    | { currentWeather?: AssistantWeatherSnapshot | null }
    | undefined;
  const weather = weatherSection?.currentWeather || null;
  const city = weather?.city?.trim() || hotelContext?.hotelProfile?.city?.trim() || '';
  const country = weather?.country?.trim() || hotelContext?.hotelProfile?.country?.trim() || '';
  const location = [city, country].filter(Boolean).join(', ');
  const forecast = weather?.next24h || null;
  const current = weather?.current || null;
  const currentTempC = typeof current?.temperatureC === 'number'
    ? Math.round(current.temperatureC)
    : null;
  const currentSummary = current?.summary?.trim() || '';
  const lowC = typeof forecast?.lowC === 'number' ? Math.round(forecast.lowC) : null;
  const highC = typeof forecast?.highC === 'number' ? Math.round(forecast.highC) : null;
  const summary = forecast?.summary?.trim() || '';
  const temperature = lowC != null && highC != null
    ? `${lowC}–${highC}°C`
    : highC != null
      ? `up to ${highC}°C`
      : lowC != null
        ? `from ${lowC}°C`
        : null;

  const lines: string[] = [];
  if (location && currentTempC != null) {
    lines.push(`The configured property location is ${location}. The current observed temperature is ${currentTempC}°C${currentSummary ? ` with ${currentSummary.toLowerCase()}` : ''}.`);
  } else if (location && temperature) {
    lines.push(`The configured property location is ${location}. The latest available forecast temperature is ${temperature}${summary ? ` with ${summary.toLowerCase()}` : ''}.`);
  } else if (location) {
    lines.push(`The configured property location is ${location}, but a current temperature is not available because weather data has not synced.`);
  } else if (temperature) {
    lines.push(`The latest available forecast temperature is ${temperature}${summary ? ` with ${summary.toLowerCase()}` : ''}, but the property city is not configured.`);
  } else {
    lines.push('The property city and current temperature are not available in the authorised weather context.');
  }

  if (weather?.stale || weather?.isFresh === false) {
    lines.push('The weather data needs refresh, so it should not be treated as a live point-in-time reading.');
  } else if (weather?.isFresh) {
    lines.push('This forecast is current in LaFlo.');
  }

  lines.push('Open Weather if you would like the detailed forecast and its operational impact.');
  return lines.join('\n\n');
}

const SUPPORT_OFFER =
  'I do not have enough verified LaFlo guidance to answer that confidently. Would you like me to pass this to the support team?';

function responseNeedsHumanSupport(reply: string, usedFallback: boolean, hasGuide: boolean) {
  if (usedFallback && !hasGuide) return true;
  const text = reply.toLowerCase();
  return [
    'do not have enough verified',
    'would you like me to pass this to the support team',
    'unable to answer confidently',
  ].some((phrase) => text.includes(phrase));
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
    return buildVerifiedGuideReply(platformGuide);
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
    `I could not match that question to verified guidance for ${currentPage} or another authorised LaFlo interface.`,
    '',
    SUPPORT_OFFER,
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
  const recentMessages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: { senderType: true, body: true, createdAt: true },
  });
  const structuredContext: Record<string, unknown> = {
    application: applicationContext,
    authorisedHotelContext: hotelContext,
    access: { role: user.role, allowedContextSections: sections },
    authorisedInterfaces: getAuthorisedInterfaces(user.role, user.modulePermissions || []),
    conversationHistory: recentMessages.reverse().map((item) => ({
      role: item.senderType === MessageSender.STAFF ? 'user' : 'assistant',
      text: item.body.slice(0, 2000),
      at: item.createdAt.toISOString(),
    })),
    mode,
  };
  const platformGuide = platformGuideFor(trimmed) || catalogueGuideFor(trimmed, applicationContext?.route);
  structuredContext.platformGuidance = platformGuide
    ? { ...platformGuide, accessible: hasModuleAccess(user.role, user.modulePermissions || [], platformGuide.permission) }
    : null;

  let usedFallback = false;
  let reply: string;
  let deepDivePrompts: string[] = [];
  const directWeatherReply = sections.includes('weather')
    ? buildDirectWeatherReply(trimmed, hotelContext)
    : null;
  const dashboardDeepDive = applicationContext?.route?.split('?')[0] === '/'
    ? buildDashboardDeepDiveReply(trimmed, hotelContext as unknown as Record<string, unknown> | null)
    : null;
  if (directWeatherReply) {
    reply = directWeatherReply;
  } else if (dashboardDeepDive) {
    reply = dashboardDeepDive.reply;
    deepDivePrompts = dashboardDeepDive.prompts;
  } else if (platformGuide && isInterfaceExplanationRequest(trimmed)) {
    if (!hasModuleAccess(user.role, user.modulePermissions || [], platformGuide.permission)) {
      reply = `Your current role does not include access to ${platformGuide.title}. Ask an administrator if this access is required.`;
    } else {
      reply = buildVerifiedGuideReply(platformGuide);
    }
  } else try {
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

  const needsHumanSupport = responseNeedsHumanSupport(reply, usedFallback, Boolean(platformGuide));
  if (needsHumanSupport && !reply.toLowerCase().includes('would you like me to pass this to the support team')) {
    reply = `${reply.trim()}\n\n${SUPPORT_OFFER}`;
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
      needsHumanSupport,
    },
  });

  return {
    reply,
    mode,
    conversationId,
    generatedAtUtc: new Date().toISOString(),
    needsHumanSupport,
    supportReason: needsHumanSupport ? 'No sufficiently verified authorised platform answer was available.' : null,
    suggestedPrompts: deepDivePrompts.length
      ? deepDivePrompts
      : platformGuide && hasModuleAccess(user.role, user.modulePermissions || [], platformGuide.permission)
      ? (platformGuide.followUpPrompts?.length
          ? platformGuide.followUpPrompts
          : [`Explain ${platformGuide.title}`, `What should I review first in ${platformGuide.title}?`]
        ).slice(0, 3)
      : [],
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
