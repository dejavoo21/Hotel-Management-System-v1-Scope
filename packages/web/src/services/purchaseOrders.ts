import api from './api';
import type { PurchaseOrder } from '@/types';

export interface PurchaseOrderItemInput {
  inventoryItemId?: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
}

export interface CreatePurchaseOrderData {
  vendorName: string;
  vendorEmail?: string;
  notes?: string;
  items: PurchaseOrderItemInput[];
}

export const purchaseOrderService = {
  async list(): Promise<PurchaseOrder[]> {
    const response = await api.get('/purchase-orders');
    return response.data.data;
  },

  async create(payload: CreatePurchaseOrderData): Promise<PurchaseOrder> {
    const response = await api.post('/purchase-orders', payload);
    return response.data.data;
  },

  async exportFile(id: string, format: 'csv' | 'pdf' = 'csv'): Promise<Blob> {
    const response = await api.get(`/purchase-orders/${id}/export`, {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  },

  async exportCsv(id: string): Promise<Blob> {
    return this.exportFile(id, 'csv');
  },

  async exportPdf(id: string): Promise<Blob> {
    return this.exportFile(id, 'pdf');
  },

  async email(id: string, recipientEmail?: string): Promise<void> {
    await api.post(`/purchase-orders/${id}/email`, { recipientEmail });
  },
};

export default purchaseOrderService;
