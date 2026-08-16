import { useEffect, useState } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import type { OperationsContext } from '@/services/operations';
import ContextPreview from './ContextPreview';
import { assistantService } from '@/services/assistant';
import { openLafloAssistant } from '@/lib/assistantEvents';

type Props = {
  context?: OperationsContext | null;
};

export default function AssistantDock({ context }: Props) {
  const [aiHealth, setAiHealth] = useState<{
    enabled: boolean;
    model?: string;
    reason?: string | null;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    assistantService
      .health()
      .then((data) => mounted && setAiHealth(data))
      .catch(() => mounted && setAiHealth({ enabled: false, reason: 'Assistant service unavailable' }));
    return () => { mounted = false; };
  }, []);

  const badge = aiHealth?.enabled
    ? { label: 'AI connected', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }
    : { label: 'Fallback', className: 'bg-amber-50 text-amber-700 ring-amber-200' };

  const openAssistant = () => openLafloAssistant({
    mode: 'operations',
    prompt: 'Review the current Operations Concierge context and explain the highest-priority next action.',
  });

  return (
    <aside className="sticky top-6 space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-emerald-700 ring-1 ring-slate-200">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Operations Concierge</h2>
              <p className="mt-1 text-xs text-slate-500">Operational context powered by Hotel Brain.</p>
            </div>
          </div>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Ask LaFlo is the single conversational assistant. It uses this page's authorised context, Hotel Brain evidence, and governance rules.
        </p>
        <button type="button" onClick={openAssistant} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-contrast hover:bg-primary-hover">
          <Bot className="h-4 w-4" />Open Ask LaFlo
        </button>
      </section>

      <ContextPreview context={context} />
    </aside>
  );
}
