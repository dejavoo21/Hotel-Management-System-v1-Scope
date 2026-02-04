import api from './api';
import type { Invoice } from '@/types';

export const invoiceService = {
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
