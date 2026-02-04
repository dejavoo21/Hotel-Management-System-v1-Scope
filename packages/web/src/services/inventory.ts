import api from './api';
import type { InventoryItem } from '@/types';

export const inventoryService = {
  async list(search?: string): Promise<InventoryItem[]> {
    const response = await api.get('/inventory', { params: { search } });
    return response.data.data;
  },

  async create(payload: Omit<InventoryItem, 'id' | 'isActive'>): Promise<InventoryItem> {
    const response = await api.post('/inventory', payload);
    return response.data.data;
  },

  async update(id: string, payload: Partial<InventoryItem>): Promise<InventoryItem> {
    const response = await api.patch(`/inventory/${id}`, payload);
    return response.data.data;
  },

  async deactivate(id: string): Promise<void> {
    await api.delete(`/inventory/${id}`);
  },
};

export default inventoryService;
