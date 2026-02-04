import api from './api';
import type { Guest, PaginatedResponse } from '@/types';

export interface GuestFilters {
  search?: string;
  vipStatus?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateGuestData {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  idType?: string;
  idNumber?: string;
  nationality?: string;
  vipStatus?: boolean;
  notes?: string;
  manualStays?: number;
  preferredRoomTypeId?: string;
}

export interface UpdateGuestData extends Partial<CreateGuestData> {}

export const guestService = {
  async getGuests(filters?: GuestFilters): Promise<PaginatedResponse<Guest>> {
    const response = await api.get('/guests', { params: filters });
    return response.data;
  },

  async getGuest(id: string): Promise<Guest> {
    const response = await api.get(`/guests/${id}`);
    return response.data.data;
  },

  async createGuest(data: CreateGuestData): Promise<Guest> {
    const response = await api.post('/guests', data);
    return response.data.data;
  },

  async updateGuest(id: string, data: UpdateGuestData): Promise<Guest> {
    const response = await api.patch(`/guests/${id}`, data);
    return response.data.data;
  },

  async deleteGuest(id: string): Promise<void> {
    await api.delete(`/guests/${id}`);
  },

  async getGuestBookings(id: string): Promise<any[]> {
    const response = await api.get(`/guests/${id}/bookings`);
    return response.data.data;
  },

  async searchGuests(query: string): Promise<Guest[]> {
    const response = await api.get('/guests/search', { params: { q: query } });
    return response.data.data;
  },
};

export default guestService;
