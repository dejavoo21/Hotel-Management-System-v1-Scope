import api from './api';
import type { MessageThreadDetail, MessageThreadSummary } from '@/types';

export const messageService = {
  async listThreads(search?: string): Promise<MessageThreadSummary[]> {
    const response = await api.get('/messages', { params: { search } });
    return response.data.data;
  },

  async getThread(threadId: string): Promise<MessageThreadDetail> {
    const response = await api.get(`/messages/${threadId}`);
    return response.data.data;
  },
};

export default messageService;
