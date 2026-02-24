import api from './api';
import type { User } from '@/types';

export const hotelService = {
  async getMyHotel(): Promise<User['hotel']> {
    const response = await api.get('/hotels/me');
    return response.data.data;
  },

  async updateMyHotel(
    payload: Partial<User['hotel']> & {
      name?: string;
      address?: string;
      addressLine1?: string;
      city?: string;
      country?: string;
      phone?: string;
      email?: string;
      website?: string;
      timezone?: string;
      currency?: string;
      latitude?: number;
      longitude?: number;
    }
  ): Promise<User['hotel']> {
    const response = await api.patch('/hotels/me', payload);
    return response.data.data;
  },
};

export default hotelService;
