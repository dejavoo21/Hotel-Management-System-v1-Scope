import api from './api';
import type { ConciergeRequest } from '@/types';

export interface ConciergeCreateInput {
  guestId?: string;
  roomId?: string;
  bookingId?: string;
  assignedToId?: string;
  title: string;
  details?: string;
  source?: 'CHATBOT' | 'APP' | 'MANUAL';
  notifySupport?: boolean;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueAt?: string;
}

export const conciergeService = {
  async list(params?: { status?: string }): Promise<ConciergeRequest[]> {
    const response = await api.get('/concierge/requests', { params });
    return response.data.data;
  },

  async create(payload: ConciergeCreateInput): Promise<ConciergeRequest> {
    const response = await api.post('/concierge/requests', payload);
    return response.data.data;
  },

  async update(id: string, payload: Partial<ConciergeRequest>): Promise<ConciergeRequest> {
    const response = await api.patch(`/concierge/requests/${id}`, payload);
    return response.data.data;
  },
};

export default conciergeService;
