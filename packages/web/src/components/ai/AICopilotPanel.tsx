import { useMemo } from 'react';
import { ArrowRight, Bot, BrainCircuit, Database, ShieldCheck } from 'lucide-react';
import { openLafloAssistant } from '@/lib/assistantEvents';
import type { AICopilotContextSection } from '@/services/aiCopilot';

const prompts = [
  'What needs attention today?',
  'Which guests are at risk?',
  'What maintenance issues are urgent?',
  'Are there any security concerns?',
];

export default function AICopilotPanel({
  title = 'AI operational insight',
  contextScope,
  linkedEntityType,
  linkedEntityId,
  compact = false,
  workspace = false,
}: {
  title?: string;
  contextScope?: AICopilotContextSection[];
  linkedEntityType?: string;
  linkedEntityId?: string;
  compact?: boolean;
  workspace?: boolean;
}) {
  const scopeLabel = useMemo(
    () => contextScope?.length
      ? contextScope.map((item) => item.replace(/([A-Z])/g, ' $1').trim()).join(', ')
      : 'Role-aware hotel context',
    [contextScope],
  );

  const openWithContext = (question?: string) => {
    const entityContext = linkedEntityType || linkedEntityId
      ? ` Related record: ${linkedEntityType || 'record'} ${linkedEntityId || ''}.`
      : '';
    openLafloAssistant({
      mode: 'operations',
      prompt: `${question || 'Generate an operational insight for this page.'} Use only these authorised context sources: ${scopeLabel}.${entityContext}`,
      context: {
        page: title,
        contextScope: contextScope || [],
        linkedEntityType: linkedEntityType || null,
        linkedEntityId: linkedEntityId || null,
      },
    });
  };

  return (
    <section className={`rounded-2xl border shadow-sm ${workspace ? 'border-slate-700 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white' : 'border-border bg-card text-text-main'} ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${workspace ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/30' : 'bg-slate-900 text-white'}`}><BrainCircuit className="h-5 w-5" /></span>
          <div>
            <h2 className={`text-base font-semibold ${workspace ? 'text-white' : 'text-text-main'}`}>{title}</h2>
            <p className={`mt-1 text-sm ${workspace ? 'text-blue-100/80' : 'text-text-muted'}`}>Use Ask LaFlo for conversational analysis. Hotel Brain supplies the evidence and intelligence behind each answer.</p>
          </div>
        </div>
        <button type="button" onClick={() => openWithContext()} className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${workspace ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-primary-solid text-primary-contrast hover:bg-primary-hover'}`}><Bot className="h-4 w-4" />Open Ask LaFlo</button>
      </div>

      <div className={`mt-4 flex flex-wrap items-center gap-2 rounded-xl border p-3 ${workspace ? 'border-blue-300/20 bg-white/5 text-blue-100' : 'border-border bg-bg/50 text-text-muted'}`}>
        <Database className="h-4 w-4" /><span className="text-xs font-semibold">Available context:</span><span className="text-xs">{scopeLabel}</span><span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold"><ShieldCheck className="h-3.5 w-3.5" />Permission filtered</span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {prompts.map((prompt) => <button key={prompt} type="button" onClick={() => openWithContext(prompt)} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-xs font-medium ${workspace ? 'border-blue-300/20 bg-white/5 text-blue-100 hover:bg-white/10' : 'border-border bg-card text-text-muted hover:border-primary-300 hover:bg-bg'}`}><span>{prompt}</span><ArrowRight className="h-3.5 w-3.5 shrink-0" /></button>)}
      </div>
    </section>
  );
}
