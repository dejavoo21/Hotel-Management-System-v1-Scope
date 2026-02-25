import { api } from './api';

// Types matching the backend
export type TicketStatus = 'OPEN' | 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'BREACHED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketCategory = 'COMPLAINT' | 'BILLING' | 'HOUSEKEEPING' | 'MAINTENANCE' | 'CONCIERGE' | 'ROOM_SERVICE' | 'CHECK_IN_OUT' | 'BOOKING' | 'OTHER';
export type Department = 'FRONT_DESK' | 'HOUSEKEEPING' | 'MAINTENANCE' | 'CONCIERGE' | 'BILLING' | 'MANAGEMENT';

export interface Ticket {
  id: string;
  hotelId: string;
  conversationId: string;
  type: 'BOOKING_RELATED' | 'GENERAL_INQUIRY';
  category: TicketCategory;
  department: Department;
  priority: TicketPriority;
  status: TicketStatus;
  assignedToId?: string;
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  responseDueAtUtc?: string;
  resolutionDueAtUtc?: string;
  firstResponseAtUtc?: string;
  resolvedAtUtc?: string;
  escalatedLevel: number;
  lastEscalationAtUtc?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  conversation?: {
    id: string;
    subject: string;
    guest?: {
      firstName: string;
      lastName: string;
    };
  };
}

export interface TicketFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  department?: Department;
  category?: TicketCategory;
  assignedToId?: string;
  page?: number;
  limit?: number;
}

export interface TicketListResponse {
  tickets: Ticket[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Get all tickets with optional filters
 */
async function getTickets(filters: TicketFilters = {}): Promise<TicketListResponse> {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.priority) params.append('priority', filters.priority);
  if (filters.department) params.append('department', filters.department);
  if (filters.category) params.append('category', filters.category);
  if (filters.assignedToId) params.append('assignedToId', filters.assignedToId);
  if (filters.page) params.append('page', String(filters.page));
  if (filters.limit) params.append('limit', String(filters.limit));

  const response = await api.get(`/tickets?${params.toString()}`);
  return response.data.data;
}

/**
 * Get a ticket by ID
 */
async function getTicket(id: string): Promise<Ticket> {
  const response = await api.get(`/tickets/${id}`);
  return response.data.data;
}

/**
 * Get a ticket by conversation ID
 */
async function getTicketByConversation(conversationId: string): Promise<Ticket | null> {
  try {
    const response = await api.get(`/tickets/conversation/${conversationId}`);
    return response.data.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Update a ticket
 */
async function updateTicket(id: string, data: Partial<Pick<Ticket, 'status' | 'priority' | 'department' | 'category'>>): Promise<Ticket> {
  const response = await api.patch(`/tickets/${id}`, data);
  return response.data.data;
}

/**
 * Assign a ticket to a user
 */
async function assignTicket(id: string, assignedToId: string): Promise<Ticket> {
  const response = await api.post(`/tickets/${id}/assign`, { assignedToId });
  return response.data.data;
}

/**
 * Mark a ticket as resolved
 */
async function resolveTicket(id: string): Promise<Ticket> {
  const response = await api.post(`/tickets/${id}/resolve`);
  return response.data.data;
}

/**
 * Mark a ticket as closed
 */
async function closeTicket(id: string): Promise<Ticket> {
  const response = await api.post(`/tickets/${id}/close`);
  return response.data.data;
}

// SLA Helper functions
export function isOverdue(ticket: Ticket): boolean {
  if (!ticket.responseDueAtUtc || ticket.firstResponseAtUtc) return false;
  return new Date() > new Date(ticket.responseDueAtUtc);
}

export function isEscalated(ticket: Ticket): boolean {
  return ticket.escalatedLevel > 0;
}

export function getTimeRemaining(ticket: Ticket): { display: string; isOverdue: boolean; minutes: number } | null {
  // Check if response is still pending
  if (ticket.firstResponseAtUtc || !ticket.responseDueAtUtc) {
    // Check resolution due time instead
    if (!ticket.resolutionDueAtUtc) return null;
  }
  
  const dueDate = !ticket.firstResponseAtUtc && ticket.responseDueAtUtc 
    ? ticket.responseDueAtUtc 
    : ticket.resolutionDueAtUtc;
  
  if (!dueDate) return null;
  
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const isOverdue = diffMs < 0;
  const absDiffMs = Math.abs(diffMs);
  
  const totalMinutes = Math.floor(absDiffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  let display = '';
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    display = `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    display = `${hours}h ${minutes}m`;
  } else {
    display = `${minutes}m`;
  }
  
  return { display, isOverdue, minutes: totalMinutes };
}

export function getEscalationBadge(ticket: Ticket): { label: string; className: string } | null {
  if (ticket.escalatedLevel === 0) return null;
  
  const levelColors: Record<number, string> = {
    1: 'bg-amber-100 text-amber-700',
    2: 'bg-orange-100 text-orange-700',
    3: 'bg-red-100 text-red-700',
  };
  
  return {
    label: `Escalated L${ticket.escalatedLevel}`,
    className: levelColors[ticket.escalatedLevel] || 'bg-red-100 text-red-700',
  };
}

export function getPriorityColor(priority: TicketPriority): string {
  switch (priority) {
    case 'URGENT': return 'text-red-600 bg-red-100';
    case 'HIGH': return 'text-orange-600 bg-orange-100';
    case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
    case 'LOW': return 'text-green-600 bg-green-100';
    default: return 'text-gray-600 bg-gray-100';
  }
}

export function getStatusColor(status: TicketStatus): string {
  switch (status) {
    case 'OPEN': return 'text-blue-600 bg-blue-100';
    case 'PENDING': return 'text-yellow-600 bg-yellow-100';
    case 'IN_PROGRESS': return 'text-purple-600 bg-purple-100';
    case 'RESOLVED': return 'text-green-600 bg-green-100';
    case 'CLOSED': return 'text-gray-600 bg-gray-100';
    case 'BREACHED': return 'text-red-600 bg-red-100';
    default: return 'text-gray-600 bg-gray-100';
  }
}

export default {
  getTickets,
  getTicket,
  getTicketByConversation,
  updateTicket,
  assignTicket,
  resolveTicket,
  closeTicket,
};
