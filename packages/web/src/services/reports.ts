import api from './api';

export interface ReportRange {
  startDate: string;
  endDate: string;
}

export const reportService = {
  async exportReport(type: string, range: ReportRange, format: 'csv' | 'pdf') {
    const response = await api.get(`/reports/export/${type}`, {
      params: { ...range, format },
      responseType: 'blob',
    });
    return response.data as Blob;
  },

  async emailReport(payload: {
    type: string;
    startDate: string;
    endDate: string;
    recipientEmail: string;
    format?: 'csv' | 'pdf';
  }) {
    await api.post('/reports/email', payload);
  },
};

export default reportService;
