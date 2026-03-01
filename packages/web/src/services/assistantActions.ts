import api from './api';

export type AssistantActionDepartment =
  | 'FRONT_DESK'
  | 'HOUSEKEEPING'
  | 'MAINTENANCE'
  | 'CONCIERGE'
  | 'BILLING'
  | 'MANAGEMENT';

export type AssistantActionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export async function createTicketFromAssistant(payload: {
  title: string;
  reason?: string;
  department: AssistantActionDepartment;
  priority: AssistantActionPriority;
  source?: string;
  details?: Record<string, unknown>;
}) {
  const response = await api.post('/operations/assistant/create-ticket', payload);
  return response.data?.data as {
    ticketId: string;
    conversationId: string;
    ticketUrl: string;
    department: AssistantActionDepartment;
    priority: AssistantActionPriority;
    status: 'OPEN' | 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'BREACHED';
  };
}

