import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { assistantService } from '@/services';
import { getApiError } from '@/services/api';
import type { OperationsContext } from '@/services/operations';

type ChatMode = 'operations' | 'pricing' | 'weather' | 'general';

type Msg = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ts: number;
};

type Props = {
  context: OperationsContext | null;
  onConversationReady?: (conversationId: string) => void;
};

function cx(...classes: Array<string | boolean | undefined | null>) {
  return classes.filter(Boolean).join(' ');
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
    </div>
  );
}

function modePrompts(mode: ChatMode) {
  if (mode === 'pricing') {
    return [
      'Give me pricing actions for the next 7 days.',
      'What is driving the demand signal right now?',
      'Which nights are most sensitive to discounting?',
    ];
  }
  if (mode === 'weather') {
    return [
      'Any weather risks in the next 24 hours?',
      'What preparation should Front Desk do today?',
      'Is forecast fresh or stale?',
    ];
  }
  if (mode === 'operations') {
    return [
      'What needs attention today?',
      'Summarize top advisories by department.',
      'What should I assign first?',
    ];
  }
  return [
    'How do I create a booking?',
    'Where do I manage room status?',
    'How do I generate an invoice?',
  ];
}

function compactOpsContext(ctx: OperationsContext | null): Record<string, unknown> | null {
  if (!ctx) return null;

  return {
    generatedAtUtc: ctx.generatedAtUtc,
    ops: ctx.ops,
    weather: ctx.weather
      ? {
          syncedAtUtc: ctx.weather.syncedAtUtc,
          isFresh: ctx.weather.isFresh,
          staleHours: ctx.weather.staleHours,
          next24h: ctx.weather.next24h,
          location: ctx.weather.location,
          daysAvailable: ctx.weather.daysAvailable,
        }
      : null,
    pricingSignal: ctx.pricingSignal || ctx.pricing,
    advisories: Array.isArray((ctx as any).advisories) ? (ctx as any).advisories.slice(0, 5) : [],
  };
}

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AssistantChatPanel({ context, onConversationReady }: Props) {
  const [mode, setMode] = useState<ChatMode>('operations');
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(
    () => localStorage.getItem('opsAssistantConversationId')
  );
  const [status, setStatus] = useState<{
    live: boolean;
    provider: string;
    hasKey: boolean;
    enabled: boolean;
    model: string;
  } | null>(null);

  const [messages, setMessages] = useState<Msg[]>([
    {
      id: makeId(),
      role: 'assistant',
      ts: Date.now(),
      text:
        "Hi - I'm your Operations Concierge. Ask me about operations, pricing, weather, or tasks. I'll use your live context when available.",
    },
  ]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const ctxPayload = useMemo(() => compactOpsContext(context), [context]);

  useEffect(() => {
    assistantService
      .status()
      .then(setStatus)
      .catch(() => setStatus({ live: false, provider: 'unknown', hasKey: false, enabled: false, model: '' }));
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isSending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: Msg = { id: makeId(), role: 'user', text: trimmed, ts: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const data = await assistantService.opsChat({
        message: trimmed,
        mode,
        context: ctxPayload,
        conversationId: conversationId ?? undefined,
      });

      if (data?.conversationId && data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
        localStorage.setItem('opsAssistantConversationId', data.conversationId);
        onConversationReady?.(data.conversationId);
      }

      const reply = data?.reply || 'No reply returned.';
      const assistantMsg: Msg = { id: makeId(), role: 'assistant', text: reply, ts: Date.now() };
      setMessages((m) => [...m, assistantMsg]);
    } catch (e) {
      const err = getApiError(e);
      toast.error(err.message);
      setMessages((m) => [
        ...m,
        {
          id: makeId(),
          role: 'assistant',
          ts: Date.now(),
          text: `I couldn't fetch a response (${err.message}).`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  const badge = status?.live
    ? { label: 'AI Active', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }
    : { label: 'Fallback', tone: 'bg-amber-50 text-amber-700 ring-amber-200' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <select
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          value={mode}
          onChange={(e) => setMode(e.target.value as ChatMode)}
        >
          <option value="operations">Operations mode</option>
          <option value="pricing">Pricing mode</option>
          <option value="weather">Weather mode</option>
          <option value="general">General mode</option>
        </select>

        <span className={cx('shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1', badge.tone)}>
          {badge.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {modePrompts(mode).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => send(p)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            disabled={isSending}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white">
        <div ref={listRef} className="max-h-[360px] space-y-3 overflow-auto p-4">
          {messages.map((m) => (
            <div key={m.id} className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cx(
                  'max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm ring-1',
                  m.role === 'user'
                    ? 'bg-slate-900 text-white ring-slate-900'
                    : 'bg-white text-slate-800 ring-slate-200'
                )}
              >
                {m.text}
              </div>
            </div>
          ))}

          {isSending ? (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
                <TypingDots />
                <span>Thinking...</span>
              </div>
            </div>
          ) : null}
        </div>

        <form
          className="flex items-center gap-2 border-t border-slate-200 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="Ask a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className={cx(
              'rounded-xl px-4 py-2 text-sm font-semibold text-white transition',
              isSending || !input.trim() ? 'bg-slate-300' : 'bg-slate-900 hover:bg-slate-800'
            )}
          >
            Send
          </button>
          <button
            type="button"
            disabled={!conversationId}
            onClick={() => conversationId && assistantService.downloadTranscript(conversationId)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Transcript
          </button>
          <button
            type="button"
            disabled={!conversationId}
            onClick={async () => {
              if (!conversationId) {
                toast.error('No transcript yet - send a message first.');
                return;
              }
              const to = window.prompt('Send transcript to email:');
              if (!to) return;
              try {
                await assistantService.emailTranscript({ conversationId, to });
                toast.success('Transcript sent.');
              } catch (e) {
                const err = getApiError(e);
                toast.error(err.message);
              }
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Email
          </button>
        </form>
      </div>

      <div className="text-xs text-slate-500">
        {status?.live
          ? `Live responses are enabled (${status.model}).`
          : 'Running in fallback mode - set OPENAI_API_KEY and ASSISTANT_PROVIDER to enable live responses.'}
      </div>
    </div>
  );
}
