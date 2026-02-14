import api from './api';
import type { Invoice } from '@/types';

export type InvoiceListItem = Invoice & {
  booking?: {
    bookingRef?: string;
    guest?: { firstName: string; lastName: string } | null;
  } | null;
};

export type InvoiceListResponse = {
  data: InvoiceListItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
};

export const invoiceService = {
  async list(params?: {
    status?: Invoice['status'];
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<InvoiceListResponse> {
    const response = await api.get('/invoices', { params });
    return { data: response.data.data, pagination: response.data.pagination };
  },

  async createForBooking(bookingId: string): Promise<Invoice> {
    const response = await api.post(`/invoices/booking/${bookingId}`);
    return response.data.data;
  },

  async sendEmail(invoiceId: string, recipientEmail?: string): Promise<void> {
    await api.post(`/invoices/${invoiceId}/send`, { recipientEmail });
  },

  async downloadPdf(invoiceId: string): Promise<Blob> {
    const response = await api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
    return response.data;
  },
};

export default invoiceService;
