import api from './api';
import type { Review } from '@/types';

export const reviewService = {
  async list(params?: { source?: string; rating?: number }): Promise<Review[]> {
    const response = await api.get('/reviews', { params });
    return response.data.data;
  },

  async respond(id: string, responseText: string): Promise<Review> {
    const response = await api.patch(`/reviews/${id}/response`, { response: responseText });
    return response.data.data;
  },
};

export default reviewService;
