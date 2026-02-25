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

/**
 * Detect intent from a message
 */
export async function detectIntent(message: string): Promise<DetectedIntent> {
  const response = await api.post<{ success: boolean; data: DetectedIntent }>('/api/ai/intent', { message });
  return response.data.data;
}

/**
 * Get AI-suggested replies for a conversation
 */
export async function getSuggestedReplies(
  conversationId: string,
  intent?: DetectedIntent
): Promise<SuggestedReply[]> {
  const response = await api.post<{ success: boolean; data: SuggestedReply[] }>('/api/ai/suggestions', {
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
  const response = await api.post<{ success: boolean; data: RecommendedAction[] }>('/api/ai/actions', {
    conversationId,
    ticketId,
    intent
  });
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
