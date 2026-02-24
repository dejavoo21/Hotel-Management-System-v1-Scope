import api from './api';
import type { WeatherSignalDaily, WeatherSignalStatus } from '@/types';

export const weatherSignalsService = {
  async getStatus(hotelId: string): Promise<WeatherSignalStatus> {
    const response = await api.get('/signals/weather/status', { params: { hotelId } });
    return response.data.data;
  },

  async getLatest(hotelId: string): Promise<WeatherSignalDaily[]> {
    const response = await api.get('/signals/weather/latest', { params: { hotelId } });
    return response.data.data;
  },

  async sync(hotelId: string): Promise<{
    hotelId: string;
    city: string;
    country: string;
    timezone: string;
    lat: number;
    lon: number;
    daysStored: number;
    fetchedAtUtc: string;
  }> {
    const response = await api.post('/signals/weather/sync', null, { params: { hotelId } });
    return response.data.data;
  },
};

export default weatherSignalsService;

