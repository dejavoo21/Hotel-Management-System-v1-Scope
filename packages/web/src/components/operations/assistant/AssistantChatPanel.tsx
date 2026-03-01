import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { assistantService } from '@/services';
import { getApiError } from '@/services/api';
import type { OperationsContext } from '@/services/operations';
import { createTicketFromAssistant } from '@/services/assistantActions';
import AssistantHeader, { type ChatMode } from './AssistantHeader';

type Props = {
  context: OperationsContext | null;
  onConversationReady?: (conversationId: string) => void;
};

type ChatMsg = { role: 'user' | 'assistant'; text: string };

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

export default function AssistantChatPanel({ context, onConversationReady }: Props) {
  const [mode, setMode] = useState<ChatMode>('operations');
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'assistant', text: 'Hi - tell me what you want to check (operations, pricing, weather, or tasks).' },
  ]);

  const ctxPayload = useMemo(() => compactOpsContext(context), [context]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((m) => [...m, { role: 'user', text: trimmed }]);
    setInput('');
    setIsSending(true);

    try {
      const data = await assistantService.opsChat({
        message: trimmed,
        mode,
        context: ctxPayload,
        conversationId: conversationId ?? undefined,
      });
      const reply = data?.reply || 'No reply returned.';
      const nextConversationId = data?.conversationId ?? null;
      if (nextConversationId && nextConversationId !== conversationId) {
        setConversationId(nextConversationId);
        onConversationReady?.(nextConversationId);
      }
      setMessages((m) => [...m, { role: 'assistant', text: reply }]);
    } catch (e) {
      const err = getApiError(e);
      toast.error(err.message);
      setMessages((m) => [...m, { role: 'assistant', text: `I couldn't fetch a response (${err.message}).` }]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <AssistantHeader mode={mode} setMode={setMode} conversationId={conversationId ?? undefined} />

      <div className="max-h-[280px] space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
        {messages.map((m, idx) => (
          <div
            key={`${m.role}-${idx}`}
            className={`rounded-2xl px-3 py-2 text-sm ${
              m.role === 'user' ? 'ml-8 bg-white text-slate-900' : 'mr-8 bg-slate-900 text-white'
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={() => send('What needs attention today?')}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
          disabled={isSending}
        >
          What needs attention today?
        </button>
        <button
          type="button"
          onClick={() => send('Give me pricing guidance for the next 7 nights.')}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
          disabled={isSending}
        >
          Give me pricing guidance for the next 7 nights.
        </button>
        <button
          type="button"
          onClick={() => send('Any weather risks in the next 24 hours?')}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
          disabled={isSending}
        >
          Any weather risks in the next 24 hours?
        </button>
      </div>

      <button
        type="button"
        disabled={isSending}
        onClick={async () => {
          try {
            const created = await createTicketFromAssistant({
              title: 'Assistant follow-up task',
              reason: messages[messages.length - 1]?.text || 'Created from assistant panel',
              department: 'MANAGEMENT',
              priority: 'MEDIUM',
              source: 'OPS_ASSISTANT',
              details: { mode },
            });
            setConversationId(created.conversationId);
            onConversationReady?.(created.conversationId);
            toast.success(`Ticket created (${created.ticketId})`);
          } catch (error) {
            const err = getApiError(error);
            toast.error(err.message);
          }
        }}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
      >
        Create ticket from latest response
      </button>

      <div className="flex gap-2">
        <input
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          placeholder={context ? 'Ask a question...' : 'Load Operations Center context first...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isSending}
        />
        <button
          type="button"
          onClick={() => send(input)}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          disabled={isSending || !input.trim()}
        >
          {isSending ? '...' : 'Send'}
        </button>
      </div>

      {conversationId ? <div className="text-xs text-slate-500">Session: {conversationId}</div> : null}
    </div>
  );
}
