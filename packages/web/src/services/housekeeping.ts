import api from './api';
import type { Room } from '@/types';

export interface HousekeepingFilters {
  status?: string;
  floor?: number;
  priority?: boolean;
}

export interface HousekeepingUpdate {
  housekeepingStatus: 'CLEAN' | 'DIRTY' | 'INSPECTION' | 'OUT_OF_SERVICE';
  notes?: string;
}

export interface HousekeepingLog {
  id: string;
  roomId: string;
  roomNumber: string;
  userId: string;
  userName: string;
  status: string;
  notes?: string;
  createdAt: string;
}

export const housekeepingService = {
  async getRooms(filters?: HousekeepingFilters): Promise<Room[]> {
    const response = await api.get('/housekeeping/rooms', { params: filters });
    return response.data.data;
  },

  async updateRoomStatus(roomId: string, data: HousekeepingUpdate): Promise<Room> {
    const response = await api.patch(`/housekeeping/rooms/${roomId}`, data);
    return response.data.data;
  },

  async getHistory(roomId?: string, limit?: number): Promise<HousekeepingLog[]> {
    const response = await api.get('/housekeeping/history', {
      params: { roomId, limit },
    });
    return response.data.data;
  },

  async getPriorityRooms(): Promise<Room[]> {
    const response = await api.get('/housekeeping/priority');
    return response.data.data;
  },

  async markClean(roomId: string, notes?: string): Promise<Room> {
    return this.updateRoomStatus(roomId, { housekeepingStatus: 'CLEAN', notes });
  },

  async markDirty(roomId: string, notes?: string): Promise<Room> {
    return this.updateRoomStatus(roomId, { housekeepingStatus: 'DIRTY', notes });
  },

  async markInspection(roomId: string, notes?: string): Promise<Room> {
    return this.updateRoomStatus(roomId, { housekeepingStatus: 'INSPECTION', notes });
  },

  async markOutOfService(roomId: string, notes?: string): Promise<Room> {
    return this.updateRoomStatus(roomId, { housekeepingStatus: 'OUT_OF_SERVICE', notes });
  },
};

export default housekeepingService;
