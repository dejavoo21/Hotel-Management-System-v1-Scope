import api from './api';

export type CreateCallRequest = {
  to: string;
  source: 'dialpad' | 'quick_contact';
  metadata?: Record<string, unknown>;
};

export type CreateCallResponse = {
  callId: string;
  status: 'queued' | 'ringing' | 'connected' | 'failed';
};

const callsService = {
  async createCall(payload: CreateCallRequest): Promise<CreateCallResponse> {
    const response = await api.post('/calls', payload);
    return response.data.data;
  },
};

export default callsService;

