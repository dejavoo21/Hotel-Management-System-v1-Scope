import axios from 'axios';
import api from './api';
import type { Room, RoomType, PaginatedResponse, Floor } from '@/types';

export interface RoomFilters {
  status?: string;
  housekeepingStatus?: string;
  roomTypeId?: string;
  floor?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateRoomData {
  number: string;
  floor: number;
  roomTypeId: string;
  notes?: string;
}

export interface UpdateRoomData {
  number?: string;
  floor?: number;
  roomTypeId?: string;
  status?: 'AVAILABLE' | 'OCCUPIED' | 'OUT_OF_SERVICE';
  housekeepingStatus?: 'CLEAN' | 'DIRTY' | 'INSPECTION' | 'OUT_OF_SERVICE';
  notes?: string;
}

export interface CreateFloorData {
  number: number;
  name?: string;
}

export const roomService = {
  async getRooms(filters?: RoomFilters): Promise<PaginatedResponse<Room>> {
    const response = await api.get('/rooms', { params: filters });
    return response.data;
  },

  async getRoom(id: string): Promise<Room> {
    const response = await api.get(`/rooms/${id}`);
    return response.data.data;
  },

  async createRoom(data: CreateRoomData): Promise<Room> {
    const response = await api.post('/rooms', data);
    return response.data.data;
  },

  async updateRoom(id: string, data: UpdateRoomData): Promise<Room> {
    const response = await api.patch(`/rooms/${id}`, data);
    return response.data.data;
  },

  async deleteRoom(id: string): Promise<void> {
    await api.delete(`/rooms/${id}`);
  },

  async updateRoomStatus(
    id: string,
    status: 'AVAILABLE' | 'OCCUPIED' | 'OUT_OF_SERVICE'
  ): Promise<Room> {
    const response = await api.patch(`/rooms/${id}/status`, { status });
    return response.data.data;
  },

  async updateHousekeepingStatus(
    id: string,
    housekeepingStatus: 'CLEAN' | 'DIRTY' | 'INSPECTION' | 'OUT_OF_SERVICE'
  ): Promise<Room> {
    const response = await api.patch(`/rooms/${id}/housekeeping`, { housekeepingStatus });
    return response.data.data;
  },

  // Room Types
  async getRoomTypes(): Promise<RoomType[]> {
    const response = await api.get('/room-types');
    return response.data.data;
  },

  async getRoomType(id: string): Promise<RoomType> {
    const response = await api.get(`/room-types/${id}`);
    return response.data.data;
  },

  async createRoomType(data: Partial<RoomType>): Promise<RoomType> {
    const response = await api.post('/room-types', data);
    return response.data.data;
  },

  async updateRoomType(id: string, data: Partial<RoomType>): Promise<RoomType> {
    const response = await api.patch(`/room-types/${id}`, data);
    return response.data.data;
  },

  async deleteRoomType(id: string): Promise<void> {
    await api.delete(`/room-types/${id}`);
  },

  async getFloors(): Promise<Floor[]> {
    try {
      const response = await api.get('/floors');
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  },

  async createFloor(data: CreateFloorData): Promise<Floor> {
    const response = await api.post('/floors', data);
    return response.data.data;
  },
  async deleteFloor(id: string): Promise<void> {
    await api.delete(`/floors/${id}`);
  },
};

export default roomService;
