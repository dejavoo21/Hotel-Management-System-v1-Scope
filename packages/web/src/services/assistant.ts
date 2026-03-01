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
  async downloadTranscript(conversationId: string): Promise<void> {
    const id = String(conversationId ?? '').trim();
    if (!id) throw new Error('conversationId is required');

    const response = await api.get(`/operations/assistant/conversations/${encodeURIComponent(id)}/transcript`, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `laflo-transcript-${id}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default assistantService;
