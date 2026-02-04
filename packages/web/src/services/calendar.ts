import api from './api';
import type { CalendarEvent } from '@/types';

export const calendarService = {
  async list(params?: { startDate?: string; endDate?: string }): Promise<CalendarEvent[]> {
    const response = await api.get('/calendar', { params });
    return response.data.data;
  },

  async create(payload: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
    const response = await api.post('/calendar', payload);
    return response.data.data;
  },

  async update(id: string, payload: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const response = await api.patch(`/calendar/${id}`, payload);
    return response.data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/calendar/${id}`);
  },
};

export default calendarService;
