import api from './api';
import type {
  DashboardSummary,
  DashboardArrival,
  DashboardDeparture,
  HousekeepingSummary,
  PriorityAlert,
} from '@/types';

export const dashboardService = {
  async getSummary(): Promise<DashboardSummary> {
    const response = await api.get('/dashboard/summary');
    return response.data.data;
  },

  async getArrivals(): Promise<DashboardArrival[]> {
    const response = await api.get('/dashboard/arrivals');
    return response.data.data;
  },

  async getDepartures(): Promise<DashboardDeparture[]> {
    const response = await api.get('/dashboard/departures');
    return response.data.data;
  },

  async getHousekeepingSummary(): Promise<HousekeepingSummary> {
    const response = await api.get('/dashboard/housekeeping-summary');
    return response.data.data;
  },

  async getAlerts(): Promise<PriorityAlert[]> {
    const response = await api.get('/dashboard/alerts');
    return response.data.data;
  },
};

export default dashboardService;
