import api from './api';
import type { ConversationMessage, MessageThreadDetail, MessageThreadSummary } from '@/types';

export const messageService = {
  async listThreads(search?: string): Promise<MessageThreadSummary[]> {
    const response = await api.get('/messages', { params: { search } });
    return response.data.data;
  },

  async getThread(threadId: string): Promise<MessageThreadDetail> {
    const response = await api.get(`/messages/${threadId}`);
    return response.data.data;
  },

  async getOrCreateLiveSupportThread(initialMessage?: string): Promise<MessageThreadSummary> {
    const response = await api.post('/messages/live-support', {
      initialMessage,
    });
    return response.data.data;
  },

  async createMessage(threadId: string, body: string): Promise<ConversationMessage> {
    const response = await api.post(`/messages/${threadId}/messages`, { body });
    return response.data.data;
  },
};

export default messageService;
