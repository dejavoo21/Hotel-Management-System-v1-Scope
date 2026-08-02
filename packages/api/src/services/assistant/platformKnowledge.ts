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
    .map(({ id, name, route, purpose, tasks }) => ({ id, name, route, purpose, tasks }));
}
