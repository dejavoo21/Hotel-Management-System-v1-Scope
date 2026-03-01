import api from '@/services/api';

export const marketService = {
  listCompetitors: async () => (await api.get('/market/competitors')).data.data,
  addCompetitor: async (payload: any) => (await api.post('/market/competitors', payload)).data.data,
  addRate: async (payload: any) => (await api.post('/market/rates', payload)).data.data,
  bulkRates: async (payload: any) => (await api.post('/market/rates/bulk', payload)).data.data,
};

export default marketService;

