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
    conversationId?: string | null;
  }): Promise<{ reply: string; mode?: string; conversationId?: string; generatedAtUtc: string }> {
    const response = await api.post('/operations/assistant/chat', args);
    return (
      response.data?.data ?? {
        reply: '',
        mode: args.mode ?? 'operations',
        conversationId: args.conversationId ?? undefined,
        generatedAtUtc: new Date().toISOString(),
      }
    );
  },
};

export default assistantService;
