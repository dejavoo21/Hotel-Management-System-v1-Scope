import { Role } from '@prisma/client';

export type PlatformInterface = {
  id: string;
  name: string;
  route: string;
  permission: string;
  purpose: string;
  tasks: string[];
  keywords: string[];
};

export type PlatformKeyArea = {
  name: string;
  description: string;
};

export type PlatformInterfaceGuidance = {
  summary: string;
  keyAreas: PlatformKeyArea[];
  priorities: string[];
  followUpPrompts: string[];
};

export const PLATFORM_INTERFACES: PlatformInterface[] = [
  { id: 'dashboard', name: 'Dashboard', route: '/', permission: 'dashboard', purpose: 'Hotel-wide operational overview and priorities.', tasks: ['Review KPIs and room readiness', 'Open alerts, tasks, integrations, search, or Hotel Brain'], keywords: ['dashboard', 'kpi', 'overview', 'attention'] },
  { id: 'command-center', name: 'Enterprise Command Center', route: '/enterprise-command-center', permission: 'dashboard', purpose: 'Cross-property command view for enterprise operations.', tasks: ['Review property performance', 'Monitor enterprise operational exceptions'], keywords: ['command center', 'enterprise command', 'property performance'] },
  { id: 'bookings', name: 'Bookings', route: '/bookings', permission: 'bookings', purpose: 'Reservations, arrivals, departures, and stay management.', tasks: ['Find or create a booking', 'Assign rooms and complete check-in or check-out'], keywords: ['booking', 'reservation', 'arrival', 'departure', 'check-in', 'check out'] },
  { id: 'guests', name: 'Guests', route: '/guests', permission: 'guests', purpose: 'Guest profiles, preferences, history, and service context.', tasks: ['Find a guest profile', 'Review permitted guest history and preferences'], keywords: ['guest', 'profile', 'preference', 'guest history'] },
  { id: 'rooms', name: 'Rooms', route: '/rooms', permission: 'rooms', purpose: 'Room inventory, occupancy, availability, and readiness.', tasks: ['Filter rooms by status or floor', 'Review and update room readiness'], keywords: ['room', 'occupancy', 'availability', 'readiness'] },
  { id: 'housekeeping', name: 'Housekeeping', route: '/housekeeping', permission: 'housekeeping', purpose: 'Cleaning assignments, inspections, readiness, and room blockers.', tasks: ['Prioritise and assign cleaning work', 'Complete inspection and readiness updates'], keywords: ['housekeeping', 'cleaning', 'dirty room', 'inspection'] },
  { id: 'inventory', name: 'Inventory', route: '/inventory', permission: 'inventory', purpose: 'Operational stock levels, consumption, and replenishment.', tasks: ['Review low stock', 'Record stock movement or replenishment'], keywords: ['inventory', 'stock', 'supplies', 'replenishment'] },
  { id: 'calendar', name: 'Calendar', route: '/calendar', permission: 'calendar', purpose: 'Shared schedule for hotel operational events and work.', tasks: ['Review scheduled activity', 'Create or update an authorised event'], keywords: ['calendar', 'schedule', 'event'] },
  { id: 'financials', name: 'Financials', route: '/financials', permission: 'financials', purpose: 'Revenue, payments, financial KPIs, and performance.', tasks: ['Review revenue and payment status', 'Filter financial information by period or property'], keywords: ['financial', 'finance', 'revenue', 'payment', 'adr'] },
  { id: 'reports', name: 'Reports', route: '/reports', permission: 'financials', purpose: 'Operational and financial reporting.', tasks: ['Choose a report and reporting period', 'Review, export, or share an authorised report'], keywords: ['report', 'reporting', 'export'] },
  { id: 'invoices', name: 'Invoicing', route: '/invoices', permission: 'financials', purpose: 'Guest and business invoice management.', tasks: ['Find or review an invoice', 'Send or update an authorised invoice'], keywords: ['invoice', 'invoicing', 'bill'] },
  { id: 'expenses', name: 'Expenses', route: '/expenses', permission: 'financials', purpose: 'Hotel expense capture, categorisation, and review.', tasks: ['Record an expense', 'Review expense status and supporting details'], keywords: ['expense', 'cost', 'spend'] },
  { id: 'reviews', name: 'Reviews', route: '/reviews', permission: 'reviews', purpose: 'Guest sentiment, ratings, and review follow-up.', tasks: ['Review ratings and feedback', 'Track an authorised response or follow-up'], keywords: ['review', 'rating', 'sentiment', 'feedback'] },
  { id: 'concierge', name: 'Concierge', route: '/concierge', permission: 'concierge', purpose: 'Guest requests and service fulfilment.', tasks: ['Create or assign a guest request', 'Track priority and completion'], keywords: ['concierge', 'guest request', 'service request'] },
  { id: 'messages', name: 'Messages', route: '/messages', permission: 'messages', purpose: 'Guest, staff, and live-support conversations.', tasks: ['Open a conversation', 'Reply, assign, or join a support thread'], keywords: ['message', 'chat', 'conversation', 'support thread'] },
  { id: 'calls', name: 'Calls', route: '/calls', permission: 'messages', purpose: 'Voice/video calling and active communication sessions.', tasks: ['Start or join a permitted call', 'Use session controls during an active call'], keywords: ['call', 'phone', 'voice', 'video meeting'] },
  { id: 'operations', name: 'Operations Center', route: '/operations-center', permission: 'bookings', purpose: 'Operational intelligence, weather, tasks, revenue, and market views.', tasks: ['Choose an operations workspace', 'Review live priorities and available intelligence'], keywords: ['operations center', 'operations workspace'] },
  { id: 'search', name: 'Enterprise Search', route: '/operations-center/search', permission: 'bookings', purpose: 'Permission-aware search across hotel records.', tasks: ['Search by guest, booking, room, invoice, incident, device, or message', 'Open an authorised result'], keywords: ['enterprise search', 'global search', 'find record'] },
  { id: 'hotel-brain', name: 'Hotel Brain', route: '/ai/hotel-brain', permission: 'bookings', purpose: 'Role-aware operational questions and hotel insights.', tasks: ['Ask an operational question', 'Review supporting authorised context before acting'], keywords: ['hotel brain', 'operational insight', 'ai insight'] },
  { id: 'weather', name: 'Weather', route: '/operations-center/weather', permission: 'bookings', purpose: 'Weather context for hotel operations and guest planning.', tasks: ['Review forecast and operational impact', 'Use weather context when planning arrivals or activities'], keywords: ['weather', 'forecast', 'temperature'] },
  { id: 'tasks', name: 'Tasks', route: '/operations-center/tasks', permission: 'bookings', purpose: 'Cross-department operational task tracking.', tasks: ['Review assigned and overdue work', 'Open or update a permitted task'], keywords: ['task', 'to-do', 'assigned work'] },
  { id: 'market-intelligence', name: 'Market Intelligence', route: '/operations-center/market-intelligence', permission: 'bookings', purpose: 'Market context supporting hotel planning.', tasks: ['Review available market indicators', 'Compare context with current hotel demand'], keywords: ['market intelligence', 'market demand', 'competitor'] },
  { id: 'security', name: 'Security Center', route: '/security-center', permission: 'security_center', purpose: 'Physical security overview, CCTV, access, visitors, and alerts.', tasks: ['Review security health and alerts', 'Open CCTV, access logs, visitors, or alerts'], keywords: ['security center', 'security concern', 'physical security'] },
  { id: 'cctv', name: 'CCTV', route: '/security-center/cctv', permission: 'security_center', purpose: 'Camera stream and provider health monitoring.', tasks: ['Review camera status and last-seen time', 'Open integration setup for connection issues'], keywords: ['cctv', 'camera', 'nvr', 'onvif'] },
  { id: 'access-logs', name: 'Access Logs', route: '/security-center/access-logs', permission: 'security_center', purpose: 'Authorised physical-access event review.', tasks: ['Filter permitted access events', 'Review an event before escalation'], keywords: ['access log', 'door entry', 'access event'] },
  { id: 'visitors', name: 'Visitors', route: '/security-center/visitors', permission: 'security_center', purpose: 'Visitor registration and visit tracking.', tasks: ['Register or find a visitor', 'Review active and completed visits'], keywords: ['visitor', 'visitor log', 'visitor pass'] },
  { id: 'security-alerts', name: 'Security Alerts', route: '/security-center/alerts', permission: 'security_center', purpose: 'Security alert triage and follow-up.', tasks: ['Review severity and source', 'Assign or escalate according to procedure'], keywords: ['security alert', 'alarm'] },
  { id: 'incidents', name: 'Incident Center', route: '/incidents', permission: 'incident_management', purpose: 'Operational incident recording, assignment, and resolution.', tasks: ['Create or review an incident', 'Track ownership, severity, evidence, and resolution'], keywords: ['incident', 'critical incident', 'incident center'] },
  { id: 'smart-building', name: 'Smart Building', route: '/operations/smart-building', permission: 'smart_building', purpose: 'Doors, sensors, energy, HVAC, and connected building assets.', tasks: ['Review device and system health', 'Open the relevant device context before using controls'], keywords: ['smart building', 'sensor', 'hvac', 'energy', 'connected device'] },
  { id: 'maintenance', name: 'Maintenance Center', route: '/maintenance-center', permission: 'maintenance_center', purpose: 'Faults, repairs, work orders, preventive maintenance, and assets.', tasks: ['Create or find maintenance work', 'Assign, prioritise, and verify completion'], keywords: ['maintenance', 'repair', 'fault', 'work order', 'preventive maintenance'] },
  { id: 'users', name: 'User Management', route: '/users', permission: 'users', purpose: 'Staff accounts, access requests, roles, and module permissions.', tasks: ['Review or approve an access request', 'Update role, permissions, or account state'], keywords: ['user management', 'staff access', 'access request', 'permission', 'role'] },
  { id: 'settings', name: 'Settings', route: '/settings', permission: 'settings', purpose: 'Hotel, platform, security, notification, and integration configuration.', tasks: ['Open the relevant settings section', 'Review permissions before changing configuration'], keywords: ['settings', 'configuration', 'hotel setup'] },
  { id: 'integrations', name: 'Integration Manager', route: '/settings?tab=integrations', permission: 'settings', purpose: 'Provider, CCTV, smart-building, and hardware connections.', tasks: ['Choose a provider or hardware category', 'Configure, test, map, and monitor a connection'], keywords: ['integration', 'provider', 'hardware connection', 'integration manager'] },
];

const INTERFACE_GUIDANCE: Record<string, PlatformInterfaceGuidance> = {
  dashboard: {
    summary: 'The Dashboard is LaFlo’s hotel operations command centre. It combines today’s performance, service readiness, operational risks, and shortcuts into one role-aware view.',
    keyAreas: [
      { name: 'Intelligence and attention', description: 'Enterprise Search, Hotel Brain, operational attention, and integration health provide fast access to records, guidance, risks, and connected-system status.' },
      { name: 'Today’s operations', description: 'Bookings, arrivals, departures, posted revenue, occupancy, ADR, weather, city, and property-local time summarise the current operating day.' },
      { name: 'Department workspaces', description: 'Room readiness, guest experience, tasks, housekeeping, maintenance, security, Smart Building, recent activity, and booking performance show where action is required.' },
    ],
    priorities: ['Review Attention and Tasks for urgent or overdue work.', 'Check room readiness against arrivals, then review live operational and integration health.'],
    followUpPrompts: ['Show me today’s dashboard priorities', 'Explain the dashboard KPI cards', 'Take me through room readiness and attention'],
  },
  'command-center': {
    summary: 'Enterprise Command Center gives authorised leaders a cross-property view of performance, risk, service health, and exceptions that may need central intervention.',
    keyAreas: [
      { name: 'Property comparison', description: 'Compare operating signals and performance across hotels without opening each property separately.' },
      { name: 'Enterprise exceptions', description: 'Surface critical incidents, integration failures, security issues, and other cross-property risks.' },
      { name: 'Executive coordination', description: 'Use enterprise context to decide which property or department needs follow-up first.' },
    ],
    priorities: ['Start with critical exceptions and unavailable systems.', 'Confirm the affected property and owner before escalating.'],
    followUpPrompts: ['Explain the enterprise exceptions', 'Which property needs attention first?', 'How should I compare property performance?'],
  },
  bookings: {
    summary: 'Bookings manages the complete reservation journey, including new reservations, room assignment, arrivals, check-in, departures, check-out, and booking status.',
    keyAreas: [
      { name: 'Reservation list', description: 'Search and filter bookings by guest, reference, dates, source, status, or property.' },
      { name: 'Stay details', description: 'Review guest, room, dates, rate, payment, notes, and operational status before making changes.' },
      { name: 'Arrival and departure actions', description: 'Complete permitted check-in and check-out steps after validating room readiness and account details.' },
    ],
    priorities: ['Review today’s arrivals, unassigned rooms, and readiness blockers.', 'Check departures, balances, and late check-out risks.'],
    followUpPrompts: ['Show me how to check in a guest', 'How do I create a new booking?', 'Explain booking statuses and filters'],
  },
  guests: {
    summary: 'Guests is the authorised profile and service-history workspace for understanding who is staying, their preferences, and relevant hotel interactions.',
    keyAreas: [
      { name: 'Guest directory', description: 'Find a guest using permitted identifiers and open the correct profile.' },
      { name: 'Profile and preferences', description: 'Review contact details, preferences, notes, and service context your role is allowed to see.' },
      { name: 'Stay and service history', description: 'Use previous and current stay information to support consistent service without exposing restricted records.' },
    ],
    priorities: ['Confirm the correct guest before updating information.', 'Use preferences and active requests to prepare personalised service.'],
    followUpPrompts: ['How do I find a guest?', 'Explain the guest profile sections', 'How should I record a guest preference?'],
  },
  rooms: {
    summary: 'Rooms shows room inventory, occupancy, availability, readiness, and blockers so teams can prepare and allocate accommodation safely.',
    keyAreas: [
      { name: 'Room inventory', description: 'Filter by room number, floor, type, occupancy, and operational status.' },
      { name: 'Readiness', description: 'Distinguish clean, dirty, in-cleaning, pending inspection, ready, and out-of-service rooms.' },
      { name: 'Operational blockers', description: 'Review housekeeping, maintenance, or inspection issues before allocating a room.' },
    ],
    priorities: ['Prioritise arrival rooms that are not ready.', 'Do not mark a room ready until cleaning, inspection, and blocking faults are resolved.'],
    followUpPrompts: ['How do I update room readiness?', 'Explain the room status colours', 'Show me how to find blocked rooms'],
  },
  housekeeping: {
    summary: 'Housekeeping coordinates room-cleaning work, assignments, inspections, readiness, and exceptions that affect arrivals and room availability.',
    keyAreas: [
      { name: 'Work queue', description: 'See rooms requiring cleaning, current assignments, priority, and progress.' },
      { name: 'Room status updates', description: 'Move work through permitted cleaning and inspection states as tasks are completed.' },
      { name: 'Readiness blockers', description: 'Identify maintenance, inspection, supply, or access issues preventing completion.' },
    ],
    priorities: ['Complete high-priority arrival rooms first.', 'Escalate blocked, delayed, or failed-inspection rooms promptly.'],
    followUpPrompts: ['What should Housekeeping prioritise?', 'How do I assign a room?', 'Explain cleaning and inspection statuses'],
  },
  inventory: {
    summary: 'Inventory tracks operational supplies, stock locations, consumption, replenishment, and low-stock risks across the hotel.',
    keyAreas: [
      { name: 'Stock catalogue', description: 'Review each item, category, location, quantity, and reorder position.' },
      { name: 'Stock movements', description: 'Record authorised receipts, issues, transfers, adjustments, and usage.' },
      { name: 'Replenishment', description: 'Identify low-stock items and initiate the appropriate restocking workflow.' },
    ],
    priorities: ['Review critical and low-stock items used by active departments.', 'Confirm quantity, unit, and storage location before recording a movement.'],
    followUpPrompts: ['How do I record stock movement?', 'Show me how low-stock alerts work', 'How do I add or replenish an item?'],
  },
  calendar: {
    summary: 'Calendar provides a shared schedule for hotel events, operational work, guest activities, and authorised team commitments.',
    keyAreas: [
      { name: 'Schedule views', description: 'Review relevant events by date, category, department, or property.' },
      { name: 'Event details', description: 'Open an event to confirm timing, location, owner, attendees, and operational notes.' },
      { name: 'Coordination', description: 'Use shared visibility to avoid conflicts and prepare affected departments.' },
    ],
    priorities: ['Review today’s time-sensitive events and conflicts.', 'Confirm ownership, location, and affected teams when creating or updating an event.'],
    followUpPrompts: ['How do I create a calendar event?', 'Explain the calendar filters', 'What events need attention today?'],
  },
  financials: {
    summary: 'Financials presents authorised revenue, payments, balances, and performance indicators for the selected property and reporting period.',
    keyAreas: [
      { name: 'Financial KPIs', description: 'Review posted revenue, payment status, occupancy-linked measures, ADR, and other available indicators.' },
      { name: 'Transactions and balances', description: 'Trace figures to permitted payment, invoice, or booking records.' },
      { name: 'Period and property scope', description: 'Confirm filters before interpreting or sharing financial results.' },
    ],
    priorities: ['Check that property, currency, and reporting period are correct.', 'Investigate outstanding, failed, refunded, or unusual transactions before acting.'],
    followUpPrompts: ['Explain the financial KPIs', 'How do I investigate a payment?', 'Why might revenue or ADR be unavailable?'],
  },
  reports: {
    summary: 'Reports turns authorised operational and financial data into period-based views that can be reviewed, exported, or shared.',
    keyAreas: [
      { name: 'Report selection', description: 'Choose the report that matches the operational or financial question.' },
      { name: 'Scope and filters', description: 'Set the property, date range, status, and other available dimensions.' },
      { name: 'Output', description: 'Review completeness before exporting or distributing an authorised report.' },
    ],
    priorities: ['Validate filters and data freshness before relying on totals.', 'Do not distribute reports beyond the recipient’s authorised scope.'],
    followUpPrompts: ['Which report should I use?', 'How do I set the reporting period?', 'How do I export a report safely?'],
  },
  invoices: {
    summary: 'Invoicing manages guest and business invoices, line items, totals, payment state, and permitted delivery actions.',
    keyAreas: [
      { name: 'Invoice directory', description: 'Find invoices by reference, guest, booking, status, or date.' },
      { name: 'Charges and totals', description: 'Review line items, taxes, adjustments, payments, and outstanding balance.' },
      { name: 'Delivery and status', description: 'Send an authorised invoice and confirm its current state.' },
    ],
    priorities: ['Verify recipient and financial details before sending.', 'Resolve incorrect charges or status issues through the authorised workflow.'],
    followUpPrompts: ['How do I find an invoice?', 'Explain invoice statuses', 'How do I send an invoice?'],
  },
  expenses: {
    summary: 'Expenses records hotel spending with categories, supporting details, status, and review controls for authorised finance users.',
    keyAreas: [
      { name: 'Expense capture', description: 'Record amount, currency, category, supplier, date, and supporting context.' },
      { name: 'Review queue', description: 'Filter expenses by status, category, period, or property.' },
      { name: 'Supporting evidence', description: 'Use available notes and attachments to substantiate the entry.' },
    ],
    priorities: ['Confirm amount, category, property, and evidence before submission.', 'Review exceptions, duplicates, and pending items.'],
    followUpPrompts: ['How do I record an expense?', 'Explain expense statuses', 'How do I review pending expenses?'],
  },
  reviews: {
    summary: 'Reviews consolidates guest ratings and feedback so teams can understand sentiment, identify service issues, and track follow-up.',
    keyAreas: [
      { name: 'Ratings overview', description: 'Review overall and category-level ratings with the available sample size.' },
      { name: 'Guest feedback', description: 'Read comments and identify operational themes without overstating limited data.' },
      { name: 'Follow-up', description: 'Track permitted response or service-recovery actions.' },
    ],
    priorities: ['Prioritise unresolved low-rating or safety-related feedback.', 'Consider sample size and period before drawing conclusions.'],
    followUpPrompts: ['Explain the review score', 'Which feedback needs follow-up?', 'How should I use review categories?'],
  },
  concierge: {
    summary: 'Concierge manages guest service requests from creation and assignment through fulfilment and closure.',
    keyAreas: [
      { name: 'Request queue', description: 'Review pending, assigned, in-progress, and completed guest requests.' },
      { name: 'Request details', description: 'Confirm guest or room context, priority, due time, owner, and service instructions.' },
      { name: 'Fulfilment', description: 'Assign work, update progress, and record completion or escalation.' },
    ],
    priorities: ['Address urgent and time-bound guest requests first.', 'Confirm ownership and communicate delays before due times are missed.'],
    followUpPrompts: ['How do I create a guest request?', 'What concierge requests are urgent?', 'How do I assign and complete a request?'],
  },
  messages: {
    summary: 'Messages is the conversation workspace for authorised guest, staff, and live-support communication.',
    keyAreas: [
      { name: 'Conversation list', description: 'Find active, unread, assigned, and resolved conversations.' },
      { name: 'Thread context', description: 'Review participants, history, assignment, and related hotel context before replying.' },
      { name: 'Live support', description: 'Join or continue private helpdesk conversations created through the LaFlo Assistant.' },
    ],
    priorities: ['Respond to urgent and unassigned conversations first.', 'Verify the recipient and avoid sharing restricted records in messages.'],
    followUpPrompts: ['How do I find a conversation?', 'How does live support work?', 'How do I assign or resolve a thread?'],
  },
  calls: {
    summary: 'Calls supports permitted voice or video communication and displays session controls only during an active call.',
    keyAreas: [
      { name: 'Call directory', description: 'Find the permitted contact or session you need.' },
      { name: 'Active session', description: 'Use microphone, camera, participants, chat, and end controls within the call context.' },
      { name: 'Session history', description: 'Review available call records without exposing restricted conversation content.' },
    ],
    priorities: ['Confirm the recipient before starting a call.', 'Use session controls only in an active communication context.'],
    followUpPrompts: ['How do I start a call?', 'Explain the active call controls', 'Why is the call toolbar not visible?'],
  },
  operations: {
    summary: 'Operations Center combines weather, revenue, pricing, tasks, market context, and AI guidance into focused operational workspaces.',
    keyAreas: [
      { name: 'Operational workspaces', description: 'Choose the weather, revenue, tasks, pricing, market, or AI view relevant to your decision.' },
      { name: 'Live signals', description: 'Review data freshness and available operational context before acting.' },
      { name: 'Guided action', description: 'Use recommendations as decision support and confirm important changes through authorised workflows.' },
    ],
    priorities: ['Start with stale data, high-risk weather, urgent tasks, and material revenue exceptions.', 'Confirm the selected property and time window.'],
    followUpPrompts: ['Which Operations workspace should I use?', 'What operational risks need attention?', 'Explain how Operations recommendations work'],
  },
  search: {
    summary: 'Enterprise Search finds authorised records across LaFlo while respecting the user’s role and module permissions.',
    keyAreas: [
      { name: 'Search input', description: 'Search for guests, bookings, rooms, invoices, incidents, devices, messages, or other supported records.' },
      { name: 'Permission-aware results', description: 'Only records from modules the user may access should be returned.' },
      { name: 'Result navigation', description: 'Open the correct record and continue work in its owning module.' },
    ],
    priorities: ['Use a specific permitted identifier when possible.', 'Confirm the record and property before taking action.'],
    followUpPrompts: ['What can Enterprise Search find?', 'How do I narrow my search?', 'Why can’t I see a search result?'],
  },
  'hotel-brain': {
    summary: 'Hotel Brain provides role-aware operational answers and insights using only the hotel context the user is authorised to access.',
    keyAreas: [
      { name: 'Operational questions', description: 'Ask about priorities, service risks, occupancy, departments, or other authorised hotel activity.' },
      { name: 'Supporting context', description: 'Review the records, freshness, and limitations behind an answer.' },
      { name: 'Recommendations', description: 'Treat AI guidance as decision support and confirm important operational actions.' },
    ],
    priorities: ['Ask a specific question with the relevant property or time window.', 'Verify high-impact recommendations against source records.'],
    followUpPrompts: ['What can I ask Hotel Brain?', 'What needs attention today?', 'How does Hotel Brain respect permissions?'],
  },
  weather: {
    summary: 'Weather shows the forecast for the hotel location configured in Settings and connects conditions to operational planning.',
    keyAreas: [
      { name: 'Property context', description: 'City, local time, timezone, coordinates, and forecast all come from the configured hotel location.' },
      { name: 'Forecast', description: 'Review conditions, temperature range, precipitation risk, freshness, and available outlook.' },
      { name: 'Operational impact', description: 'Use weather context to plan arrivals, guest activities, staffing, transport, and contingency work.' },
    ],
    priorities: ['Refresh stale forecasts and verify the configured property location.', 'Prioritise high-risk conditions affecting arrivals, safety, or outdoor activity.'],
    followUpPrompts: ['Explain the weather forecast', 'How is the weather location selected?', 'What weather actions should we take today?'],
  },
  tasks: {
    summary: 'Tasks provides cross-department visibility of assigned, overdue, urgent, and completed operational work.',
    keyAreas: [
      { name: 'Task queue', description: 'Filter work by owner, department, status, priority, property, or due time.' },
      { name: 'Task details', description: 'Review description, context, assignment, deadline, and linked records.' },
      { name: 'Execution tracking', description: 'Update permitted status and confirm completion evidence where required.' },
    ],
    priorities: ['Start with overdue, critical, and unassigned work.', 'Confirm ownership and due time before changing status.'],
    followUpPrompts: ['What tasks need attention?', 'How do I assign a task?', 'Explain task priorities and statuses'],
  },
  'market-intelligence': {
    summary: 'Market Intelligence presents available demand and competitor context to support planning without replacing commercial judgement.',
    keyAreas: [
      { name: 'Market signals', description: 'Review available demand, competitor, and event indicators.' },
      { name: 'Hotel comparison', description: 'Compare external context with current occupancy, pace, and authorised performance data.' },
      { name: 'Coverage and confidence', description: 'Check source coverage and freshness before using a signal.' },
    ],
    priorities: ['Identify stale, sparse, or simulated market data.', 'Confirm commercial decisions with authorised revenue owners.'],
    followUpPrompts: ['Explain the market indicators', 'How reliable is the market data?', 'How should market context affect planning?'],
  },
  security: {
    summary: 'Security Center is the physical-security workspace for CCTV, access events, visitors, alerts, and related operational response.',
    keyAreas: [
      { name: 'Security overview', description: 'Review current camera, access, visitor, and alert health.' },
      { name: 'CCTV and access', description: 'Open permitted streams, device status, door events, and access logs in their specific context.' },
      { name: 'Alert response', description: 'Triage severity, location, source, ownership, and escalation status.' },
    ],
    priorities: ['Review critical active alerts and offline security equipment first.', 'Preserve evidence and follow hotel security procedures before resolving an event.'],
    followUpPrompts: ['What security issues need attention?', 'Explain the Security Center tabs', 'How do I investigate an alert?'],
  },
  cctv: {
    summary: 'CCTV monitors configured camera and recorder health within Security Center; configuration is managed centrally in Integration Manager.',
    keyAreas: [
      { name: 'Camera inventory', description: 'Review camera name, location, provider, status, and last-seen time.' },
      { name: 'Stream context', description: 'Open authorised video only within the CCTV workspace.' },
      { name: 'Connection health', description: 'Trace offline or degraded cameras to their provider, gateway, or integration configuration.' },
    ],
    priorities: ['Investigate offline cameras covering critical areas.', 'Never paste camera credentials or stream URLs into chat.'],
    followUpPrompts: ['How do I add a camera or NVR?', 'How do I investigate an offline camera?', 'Explain CCTV live versus simulation labels'],
  },
  'access-logs': {
    summary: 'Access Logs records authorised physical-access events so Security can investigate entries, denials, forced access, and door activity.',
    keyAreas: [
      { name: 'Event log', description: 'Filter by time, door, result, actor type, or other permitted criteria.' },
      { name: 'Event context', description: 'Review the door, actor, credential reference, outcome, and occurrence time.' },
      { name: 'Escalation', description: 'Link concerning events to security follow-up or incident handling.' },
    ],
    priorities: ['Review forced, denied, or unusual access events first.', 'Do not expose credential details outside authorised security workflows.'],
    followUpPrompts: ['How do I filter access events?', 'What access results need escalation?', 'How do I investigate a door event?'],
  },
  visitors: {
    summary: 'Visitors supports visitor registration, active-visit tracking, and checkout for authorised security and reception workflows.',
    keyAreas: [
      { name: 'Visitor register', description: 'Find expected, active, and completed visits.' },
      { name: 'Visit details', description: 'Review identity, host, purpose, timing, and permitted access context.' },
      { name: 'Visit lifecycle', description: 'Register arrival, maintain active status, and record checkout.' },
    ],
    priorities: ['Confirm identity and host before completing registration.', 'Review overdue active visits and unclosed records.'],
    followUpPrompts: ['How do I register a visitor?', 'How do I check out a visitor?', 'What visitor records need attention?'],
  },
  'security-alerts': {
    summary: 'Security Alerts is the triage queue for active physical-security events generated by cameras, doors, sensors, or staff workflows.',
    keyAreas: [
      { name: 'Alert queue', description: 'Review severity, status, source, location, and time.' },
      { name: 'Investigation context', description: 'Open related devices, access events, tasks, or incidents.' },
      { name: 'Response state', description: 'Acknowledge, assign, escalate, and resolve according to procedure.' },
    ],
    priorities: ['Handle critical and active alerts before acknowledged or low-risk items.', 'Verify the underlying condition before resolving an alert.'],
    followUpPrompts: ['Which alerts are most urgent?', 'How do I acknowledge an alert?', 'When should an alert become an incident?'],
  },
  incidents: {
    summary: 'Incident Center records significant operational events with severity, ownership, evidence, actions, and resolution history.',
    keyAreas: [
      { name: 'Incident queue', description: 'Filter incidents by severity, status, owner, department, property, or time.' },
      { name: 'Incident record', description: 'Maintain the description, timeline, evidence, linked records, and response activity.' },
      { name: 'Resolution', description: 'Track containment, corrective action, review, and authorised closure.' },
    ],
    priorities: ['Review critical, unassigned, and escalating incidents first.', 'Preserve an accurate audit trail and never remove material evidence.'],
    followUpPrompts: ['How do I create an incident?', 'Explain incident severity and status', 'What incidents need attention now?'],
  },
  'smart-building': {
    summary: 'Smart Building monitors connected doors, sensors, HVAC, energy, gateways, and building assets, including retrofit or manually inspected equipment where configured.',
    keyAreas: [
      { name: 'Device and gateway health', description: 'Review online, offline, warning, maintenance, and last-seen status.' },
      { name: 'Sensors and doors', description: 'Monitor temperature, humidity, leaks, motion, energy, HVAC, and door-state events.' },
      { name: 'Assets and alerts', description: 'Open the relevant device or asset context before acknowledging alerts or using controls.' },
    ],
    priorities: ['Investigate critical sensors, doors, and offline gateways first.', 'Distinguish live, simulated, retrofit-sensor, and manual-check data.'],
    followUpPrompts: ['Explain Smart Building health', 'How do non-IoT assets get monitored?', 'How do I investigate an offline device?'],
  },
  maintenance: {
    summary: 'Maintenance Center manages faults, repairs, work orders, preventive schedules, and asset inspections from report through verified completion.',
    keyAreas: [
      { name: 'Faults and work orders', description: 'Review location, asset, severity, status, assignment, and room impact.' },
      { name: 'Preventive maintenance', description: 'Track due, upcoming, completed, and overdue scheduled work.' },
      { name: 'Assets and repairs', description: 'Maintain inspection condition, repair history, and completion evidence.' },
    ],
    priorities: ['Address safety-critical, guest-impacting, and room-blocking faults first.', 'Verify repair and clear related blockers only after completion checks.'],
    followUpPrompts: ['How do I create a work order?', 'What maintenance issues are urgent?', 'Explain preventive maintenance and assets'],
  },
  users: {
    summary: 'User Management controls staff accounts, access requests, roles, module permissions, approval state, and account availability.',
    keyAreas: [
      { name: 'Access requests', description: 'Review applicant identity and requested role before approval, rejection, or requesting more information.' },
      { name: 'User accounts', description: 'Find users and review account, approval, activation, and password-setup state.' },
      { name: 'Roles and permissions', description: 'Grant only the modules required for the person’s hotel responsibilities.' },
    ],
    priorities: ['Review pending access and disabled or misconfigured accounts.', 'Apply least-privilege access and record administrative decisions.'],
    followUpPrompts: ['How do I approve an access request?', 'Explain roles and module permissions', 'How do I disable or update a user?'],
  },
  settings: {
    summary: 'Settings controls hotel identity, location and timezone, platform preferences, security, notifications, integrations, and other authorised configuration.',
    keyAreas: [
      { name: 'Hotel configuration', description: 'Maintain property name, address, city, country, coordinates, timezone, currency, and operating details.' },
      { name: 'Platform controls', description: 'Review authorised security, notification, and operational settings.' },
      { name: 'Integration Manager', description: 'Configure and monitor providers, CCTV, Smart Building, and hardware connections.' },
    ],
    priorities: ['Confirm property, timezone, currency, and location because they affect dashboard and weather context.', 'Review permissions and downstream impact before saving configuration.'],
    followUpPrompts: ['Explain the Settings sections', 'How do I update hotel location and timezone?', 'How do I open Integration Manager?'],
  },
  integrations: {
    summary: 'Integration Manager is the central configuration and health workspace for external providers, CCTV, Smart Building, gateways, and supported hardware.',
    keyAreas: [
      { name: 'Provider categories', description: 'Choose the appropriate service, CCTV, building, access, or hardware integration type.' },
      { name: 'Secure setup', description: 'Enter credentials only in protected forms, test the connection, and map imported devices or records.' },
      { name: 'Health and logs', description: 'Review connection state, last sync or test, errors, and live versus simulation labels.' },
    ],
    priorities: ['Resolve credential, connection, and mapping failures affecting operations.', 'Never paste provider secrets, API keys, passwords, or stream URLs into chat.'],
    followUpPrompts: ['How do I configure an integration?', 'How do I add CCTV or Smart Building hardware?', 'Explain integration health and simulation labels'],
  },
};

export function getPlatformInterfaceGuidance(item: PlatformInterface): PlatformInterfaceGuidance {
  return INTERFACE_GUIDANCE[item.id] || {
    summary: item.purpose,
    keyAreas: item.tasks.map((task) => ({ name: task, description: task })),
    priorities: item.tasks,
    followUpPrompts: [`Explain ${item.name}`, `What should I review first in ${item.name}?`],
  };
}

export function findPlatformInterfaceByRoute(route?: string | null): PlatformInterface | null {
  if (!route) return null;
  const [rawPathname, rawQuery = ''] = route.split('?');
  const pathname = rawPathname.replace(/\/$/, '') || '/';
  return PLATFORM_INTERFACES
    .filter((item) => {
      const [rawItemPath, itemQuery = ''] = item.route.split('?');
      if (itemQuery && itemQuery !== rawQuery) return false;
      const itemPath = rawItemPath.replace(/\/$/, '') || '/';
      return pathname === itemPath || (itemPath !== '/' && pathname.startsWith(`${itemPath}/`));
    })
    .sort((a, b) => b.route.length - a.route.length)[0] || null;
}

export function hasInterfaceAccess(role: Role, permissions: string[], item: PlatformInterface) {
  return role === Role.ADMIN || permissions.includes(item.permission);
}

export function findPlatformInterface(message: string): PlatformInterface | null {
  const text = message.toLowerCase();
  const matches = PLATFORM_INTERFACES
    .map((item) => ({
      item,
      score: item.keywords
        .filter((keyword) => text.includes(keyword))
        .reduce((total, keyword) => total + keyword.length, 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);
  return matches[0]?.item || null;
}

export function getAuthorisedInterfaces(role: Role, permissions: string[]) {
  return PLATFORM_INTERFACES.filter((item) => hasInterfaceAccess(role, permissions, item))
    .map((item) => ({
      id: item.id,
      name: item.name,
      route: item.route,
      purpose: item.purpose,
      tasks: item.tasks,
      ...getPlatformInterfaceGuidance(item),
    }));
}
