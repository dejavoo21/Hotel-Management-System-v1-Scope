import api from './api';

export type AssistantMode = 'general' | 'operations' | 'pricing' | 'weather' | 'tasks';

export type OpsChatArgs = {
  message: string;
  mode?: AssistantMode;
  context?: Record<string, unknown> | null;
  conversationId?: string | null;
};

export type OpsChatResponse = {
  reply: string;
  mode: string;
  generatedAtUtc: string;
  conversationId: string;
};

export type AssistantStatusResponse = {
  live: boolean;
  provider: string;
  hasKey: boolean;
  enabled: boolean;
  model: string;
};

export type AssistantHealthResponse = {
  enabled: boolean;
  provider: string;
  model: string;
  reason?: string | null;
};

export const assistantService = {
  async ops(message: string): Promise<string> {
    const response = await api.post('/assistant/ops', { message });
    return response.data?.data?.reply ?? '';
  },
  async chat(args: OpsChatArgs): Promise<OpsChatResponse> {
    const response = await api.post('/assistant/chat', args);
    return (
      response.data?.data ?? {
        reply: '',
        mode: args.mode ?? 'operations',
        conversationId: args.conversationId ?? '',
        generatedAtUtc: new Date().toISOString(),
      }
    );
  },
  async opsChat(args: OpsChatArgs): Promise<OpsChatResponse> {
    return this.chat(args);
  },
  async status(): Promise<AssistantStatusResponse> {
    const response = await api.get('/assistant/status');
    return (
      response.data?.data ?? {
        live: false,
        provider: 'unknown',
        hasKey: false,
        enabled: false,
        model: '',
      }
    );
  },
  async health(): Promise<AssistantHealthResponse> {
    const status = await this.status();
    return {
      enabled: status.live,
      provider: status.provider,
      model: status.model,
      reason: status.live
        ? null
        : !status.hasKey
          ? 'OPENAI_API_KEY missing'
          : !status.enabled
            ? 'ASSISTANT_PROVIDER=none'
            : 'OpenAI unavailable',
    };
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
  async emailTranscript(args: { conversationId: string; to: string; subject?: string }): Promise<{ sent: boolean }> {
    const id = String(args.conversationId ?? '').trim();
    const to = String(args.to ?? '').trim();
    if (!id) throw new Error('conversationId is required');
    if (!to) throw new Error('recipient email is required');

    const response = await api.post(`/operations/assistant/conversations/${encodeURIComponent(id)}/email`, {
      to,
      subject: args.subject,
    });
    return response.data?.data ?? { sent: true };
  },
};

export default assistantService;
