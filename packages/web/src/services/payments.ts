import api from './api';

export const paymentService = {
  async emailReceipt(paymentId: string, recipientEmail?: string): Promise<void> {
    await api.post(`/payments/${paymentId}/receipt/email`, { recipientEmail });
  },

  async downloadReceipt(paymentId: string): Promise<Blob> {
    const response = await api.get(`/payments/${paymentId}/receipt/pdf`, { responseType: 'blob' });
    return response.data;
  },
};

export default paymentService;
