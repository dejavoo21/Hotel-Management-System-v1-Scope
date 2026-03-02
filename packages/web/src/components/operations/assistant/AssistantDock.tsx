import { useEffect, useState } from 'react';
import type { OperationsContext } from '@/services/operations';
import AssistantChatPanel from './AssistantChatPanel';
import ContextPreview from './ContextPreview';
import { assistantService } from '@/services/assistant';

type Props = {
  context?: OperationsContext | null;
};

function IconSparkles({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z" />
      <path d="m5 17 .9 2.1L8 20l-2.1.9L5 23l-.9-2.1L2 20l2.1-.9L5 17Z" />
      <path d="m19 14 .6 1.4L21 16l-1.4.6L19 18l-.6-1.4L17 16l1.4-.6L19 14Z" />
    </svg>
  );
}

export default function AssistantDock({ context }: Props) {
  const [assistantConversationId, setAssistantConversationId] = useState<string | null>(null);
  const [aiHealth, setAiHealth] = useState<{
    enabled: boolean;
    model?: string;
    reason?: string | null;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    assistantService
      .health()
      .then((d) => mounted && setAiHealth(d))
      .catch(() =>
        mounted &&
        setAiHealth({
          enabled: false,
          reason: 'Unable to reach /assistant/health',
        })
      );
    return () => {
      mounted = false;
    };
  }, []);

  const badge = aiHealth?.enabled
    ? { label: 'AI connected', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }
    : { label: 'Fallback', className: 'bg-amber-50 text-amber-700 ring-amber-200' };

  return (
    <aside className="sticky top-6 space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
              <IconSparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Operations Concierge</div>
              <div className="mt-1 text-xs text-slate-500">
                {aiHealth?.enabled
                  ? 'Powered responses + tools.'
                  : `Using rules until AI is enabled. ${aiHealth?.reason ?? ''}`}
              </div>
            </div>
          </div>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        <AssistantChatPanel context={context ?? null} onConversationReady={setAssistantConversationId} />
        {assistantConversationId ? (
          <div className="mt-3 text-xs text-slate-500">Conversation: {assistantConversationId}</div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Context Preview</div>
          <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
            Read-only
          </span>
        </div>
        <ContextPreview context={context} />
      </div>
    </aside>
  );
}
