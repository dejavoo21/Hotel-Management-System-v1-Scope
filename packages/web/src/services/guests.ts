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

export type GuestJourneyStageId =
  | 'RESERVATION_CREATED'
  | 'PAYMENT_CONFIRMED'
  | 'PRE_ARRIVAL'
  | 'CHECK_IN'
  | 'IN_STAY'
  | 'SERVICE_REQUESTS'
  | 'MAINTENANCE'
  | 'CHECKOUT'
  | 'INVOICE'
  | 'REVIEW'
  | 'LOYALTY';

export interface GuestJourneyEvent {
  id: string;
  stage: GuestJourneyStageId;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'BLOCKED';
  eventType: string;
  summary: string;
  sourceModule: string;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface GuestJourney {
  id: string;
  guestId: string;
  bookingId?: string | null;
  currentStage: GuestJourneyStageId;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'BLOCKED';
  startedAt: string;
  completedAt?: string | null;
  lastEventAt: string;
  booking?: {
    id: string;
    bookingRef: string;
    status: string;
    checkInDate: string;
    checkOutDate: string;
  } | null;
  events: GuestJourneyEvent[];
}

export interface GuestJourneyTimeline {
  stages: Array<{ id: GuestJourneyStageId; label: string }>;
  journeys: GuestJourney[];
}

export const guestService = {
  async getGuests(filters?: GuestFilters): Promise<PaginatedResponse<Guest>> {
    const response = await api.get('/guests', {
      params: {
        ...filters,
        _ts: Date.now(),
      },
    });
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

  async getGuestJourney(id: string, bookingId?: string): Promise<GuestJourneyTimeline> {
    const response = await api.get(`/guests/${id}/journey`, {
      params: bookingId ? { bookingId } : undefined,
    });
    return response.data.data;
  },

  async searchGuests(query: string): Promise<Guest[]> {
    const response = await api.get('/guests/search', { params: { q: query } });
    return response.data.data;
  },
};

export default guestService;
