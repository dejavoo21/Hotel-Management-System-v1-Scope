import api from './api';

export interface DetectedIntent {
  category: string;
  confidence: number;
  keywords: string[];
  subIntents?: string[];
}

export interface SuggestedReply {
  id: string;
  text: string;
  intent: string;
  confidence: number;
  requiresApproval: boolean;
}

export interface RecommendedAction {
  id: string;
  type: 'APPROVE_REQUEST' | 'ASSIGN_HOUSEKEEPING' | 'ESCALATE_TO_MANAGER' | 'CREATE_MAINTENANCE_TASK' | 'SCHEDULE_SERVICE' | 'UPDATE_BOOKING' | 'SEND_CONFIRMATION' | 'FLAG_FOR_REVIEW';
  label: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  estimatedImpact: string;
  requiresApproval: boolean;
  metadata?: Record<string, unknown>;
}

export interface WeatherOpsAction {
  title: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  category?: 'Front Desk' | 'Concierge' | 'Housekeeping' | 'F&B' | 'Maintenance';
}

export interface WeatherOpsActionsResult {
  actions: WeatherOpsAction[];
  generatedAtUtc: string;
}

export interface CreateWeatherActionTicketInput {
  title: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  department: 'FRONT_DESK' | 'HOUSEKEEPING' | 'CONCIERGE' | 'MAINTENANCE' | 'BILLING' | 'MANAGEMENT';
  weatherSyncedAtUtc?: string | null;
  aiGeneratedAtUtc?: string | null;
}

export interface CreateWeatherActionTicketResult {
  ticketId: string;
  status: 'OPEN' | 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'BREACHED';
  department: string;
  conversationId: string;
}

/**
 * Detect intent from a message
 */
export async function detectIntent(message: string): Promise<DetectedIntent> {
  const response = await api.post<{ success: boolean; data: DetectedIntent }>('/ai/intent', { message });
  return response.data.data;
}

/**
 * Get AI-suggested replies for a conversation
 */
export async function getSuggestedReplies(
  conversationId: string,
  intent?: DetectedIntent
): Promise<SuggestedReply[]> {
  const response = await api.post<{ success: boolean; data: SuggestedReply[] }>('/ai/suggestions', {
    conversationId,
    intent
  });
  return response.data.data;
}

/**
 * Get recommended actions for a conversation/ticket
 */
export async function getRecommendedActions(
  conversationId: string,
  ticketId?: string,
  intent?: DetectedIntent
): Promise<RecommendedAction[]> {
  const response = await api.post<{ success: boolean; data: RecommendedAction[] }>('/ai/actions', {
    conversationId,
    ticketId,
    intent
  });
  return response.data.data;
}

/**
 * Get weather-based operational actions for the current hotel.
 */
export async function getWeatherOpsActions(hotelId?: string): Promise<WeatherOpsActionsResult> {
  const response = await api.post<{ success: boolean; data: WeatherOpsActionsResult }>(
    '/ai/weather-actions',
    { hotelId }
  );
  return response.data.data;
}

export async function createWeatherActionTicket(
  payload: CreateWeatherActionTicketInput
): Promise<CreateWeatherActionTicketResult> {
  const response = await api.post<{ success: boolean; data: CreateWeatherActionTicketResult }>(
    '/ai/weather-actions/create-ticket',
    payload
  );
  return response.data.data;
}

/**
 * Map action type to friendly label and icon hint
 */
export function getActionDisplay(actionType: RecommendedAction['type']): { label: string; iconHint: string; color: string } {
  const displays: Record<RecommendedAction['type'], { label: string; iconHint: string; color: string }> = {
    APPROVE_REQUEST: { label: 'Approve', iconHint: 'check', color: 'green' },
    ASSIGN_HOUSEKEEPING: { label: 'Assign Housekeeping', iconHint: 'broom', color: 'blue' },
    ESCALATE_TO_MANAGER: { label: 'Escalate', iconHint: 'arrow-up', color: 'orange' },
    CREATE_MAINTENANCE_TASK: { label: 'Create Task', iconHint: 'wrench', color: 'purple' },
    SCHEDULE_SERVICE: { label: 'Schedule', iconHint: 'calendar', color: 'teal' },
    UPDATE_BOOKING: { label: 'Update Booking', iconHint: 'edit', color: 'indigo' },
    SEND_CONFIRMATION: { label: 'Send Confirmation', iconHint: 'mail', color: 'gray' },
    FLAG_FOR_REVIEW: { label: 'Flag for Review', iconHint: 'flag', color: 'red' }
  };
  return displays[actionType] || { label: actionType, iconHint: 'circle', color: 'gray' };
}
