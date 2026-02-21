import api from './api';
import type {
  ConversationMessage,
  MessageThreadDetail,
  MessageThreadSummary,
  SupportVoiceToken,
  SupportAgent,
} from '@/types';

export const messageService = {
  async listThreads(search?: string): Promise<MessageThreadSummary[]> {
    const response = await api.get('/messages', { params: { search } });
    return response.data.data;
  },

  async getThread(threadId: string): Promise<MessageThreadDetail> {
    const response = await api.get(`/messages/${threadId}`);
    return response.data.data;
  },

  async getOrCreateLiveSupportThread(initialMessage?: string, handoffSummary?: string): Promise<MessageThreadSummary> {
    const response = await api.post('/messages/live-support', {
      initialMessage,
      handoffSummary,
    });
    return response.data.data;
  },

  async createMessage(threadId: string, body: string): Promise<ConversationMessage> {
    const response = await api.post(`/messages/${threadId}/messages`, { body });
    return response.data.data;
  },

  async heartbeatSupportPresence(): Promise<void> {
    await api.post('/messages/support/presence');
  },

  async listSupportAgents(): Promise<SupportAgent[]> {
    const response = await api.get('/messages/support/agents');
    return response.data.data;
  },

  async assignSupportAgent(threadId: string, userId?: string): Promise<MessageThreadSummary> {
    const response = await api.post(`/messages/${threadId}/assign`, userId ? { userId } : undefined);
    return response.data.data;
  },

  async getSupportVoiceToken(): Promise<SupportVoiceToken> {
    const response = await api.get('/messages/support/voice/token');
    return response.data.data;
  },

  async startSupportPhoneCall(payload: { to: string; threadId?: string }): Promise<{ sid: string; status: string }> {
    const response = await api.post('/messages/support/voice/call-phone', payload);
    return response.data.data;
  },
};

export default messageService;
