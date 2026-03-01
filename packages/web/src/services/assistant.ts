import api from './api';

export const assistantService = {
  async ops(message: string): Promise<string> {
    const response = await api.post('/assistant/ops', { message });
    return response.data?.data?.reply ?? '';
  },
  async opsChat(args: {
    message: string;
    mode?: 'general' | 'operations' | 'pricing' | 'weather';
    context?: Record<string, unknown> | null;
  }): Promise<{ reply: string; mode: string; generatedAtUtc: string }> {
    const response = await api.post('/operations/assistant/chat', args);
    return (
      response.data?.data ?? {
        reply: '',
        mode: args.mode ?? 'operations',
        generatedAtUtc: new Date().toISOString(),
      }
    );
  },
};

export default assistantService;
