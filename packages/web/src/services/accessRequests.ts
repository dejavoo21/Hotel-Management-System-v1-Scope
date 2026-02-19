import api from './api';
import type { AccessRequest, AccessRequestReply } from '@/types';

export interface AccessRequestInput {
  fullName: string;
  email: string;
  mobileNumber?: string;
  company?: string;
  role?: string;
  message?: string;
}

export const accessRequestService = {
  async create(payload: AccessRequestInput): Promise<AccessRequest> {
    const response = await api.post('/access-requests', payload);
    return response.data.data;
  },
  async list(): Promise<AccessRequest[]> {
    const response = await api.get('/access-requests');
    return response.data.data;
  },
  async getReplies(id: string): Promise<AccessRequestReply[]> {
    const response = await api.get(`/access-requests/${id}/replies`);
    return response.data.data;
  },
  async approve(id: string, role?: string): Promise<void> {
    await api.post(`/access-requests/${id}/approve`, role ? { role } : undefined);
  },
  async reject(id: string, notes: string): Promise<void> {
    await api.post(`/access-requests/${id}/reject`, { notes });
  },
  async requestInfo(id: string, notes: string): Promise<void> {
    await api.post(`/access-requests/${id}/request-info`, { notes });
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/access-requests/${id}`);
  },
  async simulateReply(id: string, message: string): Promise<void> {
    await api.post(`/access-requests/${id}/simulate-reply`, { message });
  },
  async downloadAttachment(
    requestId: string,
    replyId: string,
    index: number,
    inline?: boolean
  ): Promise<{ blob: Blob; filename: string; contentType: string }> {
    const response = await api.get(
      `/access-requests/${requestId}/replies/${replyId}/attachments/${index}${
        inline ? '?inline=true' : ''
      }`,
      { responseType: 'blob' }
    );
    const contentType = response.headers?.['content-type'] || 'application/octet-stream';
    const disposition = response.headers?.['content-disposition'] as string | undefined;
    const filenameMatch = disposition?.match(/filename\*?=(?:UTF-8''|\"?)([^\";]+)/i);
    const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : `attachment-${index + 1}`;
    return { blob: response.data, filename, contentType };
  },
};

export default accessRequestService;
