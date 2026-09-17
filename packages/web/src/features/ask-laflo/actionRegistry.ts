import { canAccess, type AccessUser } from '@/lib/access';
import type { PermissionId } from '@/utils/userAccess';
import type { AskLafloActionDefinition, AskLafloActionResolution } from './types';

const action = (
  id: string,
  displayName: string,
  description: string,
  route: string,
  permission: string | undefined,
  execution: AskLafloActionDefinition['execution'],
  surface: AskLafloActionDefinition['surface'],
  aliases: string[],
  fallback: string,
  requiredParameters: string[] = [],
): AskLafloActionDefinition => ({ id, displayName, description, route, permission, execution, surface, aliases, fallback, requiredParameters });

export const askLafloActionRegistry: AskLafloActionDefinition[] = [
  action('guest.call', 'Call guest', 'Open Guest Calls with the selected authorised guest number ready.', '/calls', 'messages', 'open-surface', 'page', ['call this guest', 'call guest'], 'Open Guest Calls. A connected calling provider is required.', ['guestId']),
  action('guest.create', 'Create guest profile', 'Open the validated guest creation workflow.', '/guests?action=add', 'guests', 'open-surface', 'drawer', ['add guest', 'create guest'], 'Open Guest Directory and choose Add Guest.'),
  action('guest.edit', 'Edit guest profile', 'Open editing for an authorised guest profile.', '/guests', 'guests', 'guided-only', 'drawer', ['edit guest', 'update guest profile'], 'Open the guest profile and choose Edit guest.', ['guestId']),
  action('guest.addNote', 'Add guest note', 'Save a dated note on an authorised guest profile.', '/guests', 'guests', 'guided-only', 'modal', ['add guest note', 'guest follow-up note'], 'Open the guest profile and choose Add note.', ['guestId']),
  action('guest.createTask', 'Create guest follow-up task', 'Create a linked Front Desk follow-up task from a guest profile.', '/guests', 'bookings', 'guided-only', 'drawer', ['create task for guest', 'guest follow-up task'], 'Open the guest profile and choose Create task.', ['guestId']),
  action('guestExperience.reply', 'Reply to guest', 'Send a reply through a connected messaging service.', '/messages?tab=conversations', 'messages', 'guided-only', 'drawer', ['reply to guest', 'send guest message'], 'Open the selected conversation and use Reply. If messaging is disconnected, no reply is sent.', ['conversationId']),
  action('guestExperience.assign', 'Assign guest issue', 'Assign a conversation or ticket to an authorised owner.', '/messages?tab=conversations', 'messages', 'guided-only', 'modal', ['assign guest issue', 'assign conversation', 'assign ticket'], 'Choose Assign on the selected conversation or ticket. Management permission is required.', ['conversationId']),
  action('guestExperience.escalate', 'Escalate guest issue', 'Escalate a linked ticket for management attention.', '/messages?tab=escalations', 'messages', 'guided-only', 'modal', ['escalate guest issue', 'escalate ticket'], 'Open the linked ticket and confirm Escalate. The record changes only after the service succeeds.', ['ticketId']),
  action('guestExperience.createTask', 'Create guest follow-up task', 'Create a linked operational follow-up task from a guest issue.', '/messages?tab=conversations', 'bookings', 'guided-only', 'drawer', ['create guest task', 'task from guest request'], 'Open the guest issue, choose Create task, review the prefilled details, and confirm.', ['conversationId']),
  action('guestExperience.resolve', 'Resolve guest issue', 'Resolve or close a linked guest ticket.', '/messages?tab=tickets', 'messages', 'guided-only', 'modal', ['resolve guest issue', 'close guest ticket'], 'Open the linked ticket and confirm Resolve or Close. Management permission is required.', ['ticketId']),
  action('navigate.toOperationsCenter', 'Open Operations Center', 'Open the hotel operations overview.', '/operations-center', 'bookings', 'navigate', 'page', ['operations center', 'operations overview'], 'Open Operations Center from the Operations menu.'),
  action('navigate.toTasksAndAdvisories', 'Open Tasks & Advisories', 'Open tasks and operational advisories.', '/operations/tasks-advisories', 'bookings', 'navigate', 'page', ['tasks and advisories', 'tasks & advisories', 'open tasks'], 'Open Tasks & Advisories from the Operations menu.'),
  action('navigate.toOperationalIntelligence', 'Open Operational Intelligence', 'Open hotel posture, pressure, risks, and actions.', '/operational-intelligence', 'bookings', 'navigate', 'page', ['operational intelligence', 'department pressure'], 'Open Operational Intelligence from the Operations menu.'),
  action('navigate.toHotelInsights', 'Open Hotel Insights', 'Open hotel information, evidence, briefings, and saved prompts.', '/hotel-insights', 'bookings', 'navigate', 'page', ['hotel insights', 'today’s briefing', "today's briefing"], 'Open Hotel Insights from the Operations menu.'),
  action('navigate.toRecommendations', 'Open AI Recommendations', 'Open the recommendation review queue.', '/operations/ai-governance', 'bookings', 'navigate', 'page', ['recommendations', 'recommendation review'], 'Open AI Recommendations from the Operations menu.'),
  action('navigate.toSecurityCenter', 'Open Security Center', 'Open security activity and alerts.', '/security-center', 'security_center', 'navigate', 'page', ['security center', 'security alerts'], 'Ask a Security or Admin user to open Security Center.'),
  action('navigate.toIncidentCenter', 'Open Incident Center', 'Open active and resolved incidents.', '/incidents', 'incident_management', 'navigate', 'page', ['incident center', 'incidents'], 'Ask an Incident Management or Admin user to open Incident Center.'),
  action('navigate.toSmartBuilding', 'Open Smart Building', 'Open building health, devices, doors, and sensors.', '/operations/smart-building', 'smart_building', 'navigate', 'page', ['smart building', 'building devices'], 'Ask a Smart Building or Admin user to open Smart Building.'),
  action('navigate.toIntegrationManager', 'Open Integration Manager', 'Open the provider catalogue and connection tools.', '/settings?tab=integrations', 'settings', 'navigate', 'page', ['integration manager', 'manage integrations', 'connect cctv'], 'Open Settings, then choose Integrations.'),
  action('navigate.toRevenueGuidance', 'Open Revenue Guidance', 'Open demand and pricing guidance.', '/operations/operational-intelligence/revenue-guidance', 'financials', 'navigate', 'page', ['revenue guidance', 'pricing guidance'], 'Ask a Revenue, Finance, or Admin user to open Revenue Guidance.'),
  action('task.createFromAdvisory', 'Create task from advisory', 'Open a prefilled task flow from a selected advisory.', '/operations/tasks-advisories', 'bookings', 'open-surface', 'drawer', ['create a task', 'task from advisory'], 'Open Tasks & Advisories, select an advisory, and choose Create task.', ['advisoryId']),
  action('task.assignOwner', 'Assign advisory owner', 'Open assignment for a selected advisory when the service is connected.', '/operations/tasks-advisories', 'bookings', 'guided-only', 'modal', ['assign advisory', 'assign owner'], 'Open the advisory. If assignment is unavailable, LaFlo will say so without changing the record.', ['advisoryId']),
  action('task.dismissAdvisory', 'Dismiss advisory', 'Confirm dismissal of a selected advisory.', '/operations/tasks-advisories', 'bookings', 'guided-only', 'modal', ['dismiss advisory'], 'Open the advisory and use Dismiss; confirm before the state changes.', ['advisoryId']),
  action('recommendation.approve', 'Approve recommendation', 'Approve a selected recommendation after review.', '/operations/ai-governance?status=PENDING', 'bookings', 'guided-only', 'modal', ['approve recommendation'], 'Open AI Recommendations, review the evidence, and choose Approve.', ['recommendationId']),
  action('recommendation.reject', 'Reject recommendation', 'Reject a selected recommendation and record a reason.', '/operations/ai-governance?status=PENDING', 'bookings', 'guided-only', 'modal', ['reject recommendation'], 'Open AI Recommendations, choose Reject, and confirm the reason.', ['recommendationId']),
  action('recommendation.expire', 'Expire recommendation', 'Expire a selected recommendation after confirmation.', '/operations/ai-governance?status=PENDING', 'bookings', 'guided-only', 'modal', ['expire recommendation'], 'Open AI Recommendations, choose Expire, and confirm.'),
  action('recommendation.createTask', 'Create task from recommendation', 'Create a linked task from a supported recommendation.', '/operations/ai-governance?status=PENDING', 'bookings', 'guided-only', 'drawer', ['recommendation task', 'task from recommendation'], 'Open the recommendation details and choose Create task where available.', ['recommendationId']),
  action('alert.acknowledge', 'Acknowledge security alert', 'Acknowledge a selected live security alert.', '/security-center?tab=alerts', 'security_center', 'guided-only', 'modal', ['acknowledge alert', 'security alert'], 'Open Security Center → Alerts, select the alert, and choose Acknowledge.', ['alertId']),
  action('incident.assign', 'Assign incident', 'Assign a selected incident to an authorised owner.', '/incidents?tab=active', 'incident_management', 'guided-only', 'modal', ['assign incident'], 'Open the incident. If assignment is unavailable, no owner will be changed.', ['incidentId']),
  action('incident.resolve', 'Resolve incident', 'Resolve a selected incident after checking the outcome.', '/incidents?tab=active', 'incident_management', 'guided-only', 'modal', ['resolve incident', 'close active incident'], 'Open Incident Center, select the incident, and confirm Resolve.', ['incidentId']),
  action('incident.close', 'Close resolved incident', 'Close a selected resolved incident.', '/incidents?tab=resolved', 'incident_management', 'guided-only', 'modal', ['close incident'], 'Open Resolved incidents, select the record, and confirm Close.', ['incidentId']),
  action('integration.configureProvider', 'Configure provider', 'Open the provider setup wizard.', '/settings?tab=integrations', 'settings', 'guided-only', 'drawer', ['configure provider', 'connect provider', 'connect cctv'], 'Open Integration Manager, choose a provider, and enter only the requested connection details.', ['providerId']),
  action('integration.testConnection', 'Test integration connection', 'Run a real provider connection test.', '/settings?tab=integrations', 'settings', 'guided-only', 'modal', ['test connection', 'test integration'], 'Open the configured provider and choose Test connection. Future providers remain unavailable.', ['providerId']),
  action('integration.connectFutureProvider', 'Connect future provider', 'Future catalogue entries cannot be connected until their live service is available.', '/settings?tab=integrations', 'settings', 'unavailable', 'drawer', ['future provider', 'coming soon provider'], 'This provider is not available yet. No connection was created and no credentials were saved.'),
  action('weather.refreshForecast', 'Refresh weather forecast', 'Reload the connected weather forecast.', '/operations/operational-intelligence/weather-forecast', 'bookings', 'guided-only', 'page', ['refresh weather', 'refresh forecast'], 'Open Weather & Forecast and choose Refresh. LaFlo will show success, failure, or disconnected.'),
  action('revenue.createPricingTask', 'Create pricing task', 'Create a linked task from a supported pricing recommendation.', '/operations/operational-intelligence/revenue-guidance', 'financials', 'guided-only', 'drawer', ['create pricing task', 'pricing task'], 'Open Revenue Guidance, select a supported recommendation, and choose Create task.', ['nightDate']),
  action('search.runEnterpriseSearch', 'Run Enterprise Search', 'Open Enterprise Search ready for an authorised query.', '/operations/enterprise-search', 'bookings', 'navigate', 'page', ['enterprise search', 'search hotel records', 'run search'], 'Open Enterprise Search, enter a hotel question, and run Search.'),
  action('booking.create', 'Create booking', 'Open the booking creation workflow.', '/reservations', 'bookings', 'guided-only', 'drawer', ['create booking', 'new booking'], 'Open Reservations and choose New booking.'),
  action('room.manageTypes', 'Manage room types', 'Open room inventory where authorised room types can be added or edited.', '/rooms', 'rooms', 'guided-only', 'drawer', ['add room type', 'edit room type', 'manage room type'], 'Open Rooms, choose Room types, then Add room type.'),
];

const permissionAllowed = (user: AccessUser | null, permission?: string) => !permission || canAccess(user, permission as PermissionId);

export function resolveAskLafloAction(id: string, user: AccessUser | null): AskLafloActionResolution | null {
  const definition = askLafloActionRegistry.find((item) => item.id === id);
  if (!definition) return null;
  if (!permissionAllowed(user, definition.permission)) return { ...definition, status: 'restricted' };
  if (definition.execution === 'unavailable') return { ...definition, status: 'unavailable' };
  if (definition.execution === 'guided-only') return { ...definition, status: 'guided-only' };
  return { ...definition, status: 'ready' };
}

export function findAskLafloActions(text: string, user: AccessUser | null, limit = 3): AskLafloActionResolution[] {
  const normalized = text.toLowerCase();
  return askLafloActionRegistry
    .filter((item) => item.aliases.some((alias) => normalized.includes(alias)))
    .map((item) => resolveAskLafloAction(item.id, user))
    .filter((item): item is AskLafloActionResolution => Boolean(item))
    .slice(0, limit);
}
