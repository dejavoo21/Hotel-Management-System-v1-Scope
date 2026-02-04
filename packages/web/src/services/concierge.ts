import api from './api';
import type { ConciergeRequest } from '@/types';

export const conciergeService = {
  async list(params?: { status?: string }): Promise<ConciergeRequest[]> {
    const response = await api.get('/concierge/requests', { params });
    return response.data.data;
  },

  async update(id: string, payload: Partial<ConciergeRequest>): Promise<ConciergeRequest> {
    const response = await api.patch(`/concierge/requests/${id}`, payload);
    return response.data.data;
  },
};

export default conciergeService;
