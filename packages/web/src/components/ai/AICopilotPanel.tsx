import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { BrainCircuit, CheckCircle2, Loader2, Save, Send, ShieldAlert } from 'lucide-react';
import { aiCopilotService, getApiError } from '@/services';
import type {
  AICopilotAskPayload,
  AICopilotContextSection,
  AICopilotResponse,
  AICopilotSuggestedAction,
} from '@/services/aiCopilot';

const prompts = [
  'What needs attention today?',
  'Which guests are at risk?',
  'What maintenance issues are urgent?',
  'Are there any security concerns?',
  'What should reception prepare for today?',
  'What should housekeeping prioritise?',
];

const priorityClass = (priority: string) => {
  if (priority === 'CRITICAL') return 'border-red-200 bg-red-50 text-red-700';
  if (priority === 'HIGH') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (priority === 'MEDIUM') return 'border-sky-200 bg-sky-50 text-sky-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

function ActionCard({ action }: { action: AICopilotSuggestedAction }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{action.title}</p>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityClass(action.priority)}`}>
          {action.priority}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">{action.description}</p>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">{action.department}</span>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
          Confidence {Math.round(action.confidence * 100)}%
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">Rationale: {action.rationale}</p>
    </div>
  );
}

export default function AICopilotPanel({
  title = 'AI Copilot',
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
  const [question, setQuestion] = useState('');
  const [lastPayload, setLastPayload] = useState<AICopilotAskPayload | null>(null);
  const [response, setResponse] = useState<AICopilotResponse | null>(null);

  const askMutation = useMutation({
    mutationFn: (payload: AICopilotAskPayload) => aiCopilotService.ask(payload),
    onSuccess: (data, payload) => {
      setResponse(data);
      setLastPayload({ ...payload, saveAsRecommendation: false });
    },
    onError: (error) => toast.error(getApiError(error).message),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: AICopilotAskPayload) => aiCopilotService.ask({ ...payload, saveAsRecommendation: true }),
    onSuccess: (data) => {
      setResponse(data);
      const count = data.createdRecommendationIds?.length || 0;
      toast.success(count ? `${count} recommendation${count === 1 ? '' : 's'} saved for governance` : 'No recommendations were saved');
    },
    onError: (error) => toast.error(getApiError(error).message),
  });

  const submitQuestion = (text = question) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const payload: AICopilotAskPayload = {
      question: trimmed,
      contextScope,
      linkedEntityType,
      linkedEntityId,
    };
    setQuestion(trimmed);
    askMutation.mutate(payload);
  };

  const hasActions = Boolean(response?.suggestedActions.length);
  const savedCount = response?.createdRecommendationIds?.length || 0;
  const scopeLabel = useMemo(
    () => (contextScope?.length ? contextScope.map((item) => item.replace(/([A-Z])/g, ' $1')).join(', ') : 'Role-aware hotel context'),
    [contextScope]
  );

  return (
    <section className={`rounded-2xl border shadow-sm ${workspace ? 'border-slate-700 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white' : 'border-border bg-card text-text-main'} ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${workspace ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/30' : 'bg-slate-900 text-white'}`}>
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <h2 className={`text-base font-semibold ${workspace ? 'text-white' : 'text-text-main'}`}>{title}</h2>
            <p className={`mt-1 text-sm ${workspace ? 'text-blue-100/80' : 'text-text-muted'}`}>
              Ask operational questions using only context this role can access.
            </p>
            <p className={`mt-1 text-xs ${workspace ? 'text-blue-200/60' : 'text-text-muted'}`}>{scopeLabel}</p>
          </div>
        </div>
        {response ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
            {Math.round(response.confidence * 100)}% confidence
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => submitQuestion(prompt)}
            disabled={askMutation.isPending}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${workspace ? 'border-blue-300/20 bg-white/5 text-blue-100 hover:bg-white/10' : 'border-border bg-card text-text-muted hover:bg-bg'}`}
          >
            {prompt}
          </button>
        ))}
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submitQuestion();
        }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className={`min-w-0 flex-1 rounded-xl border px-3 py-3 text-sm focus:border-primary-500 focus:ring-primary-500 ${workspace ? 'border-blue-300/30 bg-white/10 text-white placeholder:text-blue-100/50' : 'border-border bg-card text-text-main'}`}
          placeholder="Ask an operational question..."
        />
        <button
          type="submit"
          disabled={askMutation.isPending || !question.trim()}
          className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 ${workspace ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-900 hover:bg-slate-800'}`}
        >
          {askMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Ask
        </button>
      </form>

      <div className="mt-4">
        {askMutation.isPending ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Building role-aware hotel context...
          </div>
        ) : response ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm leading-6 text-slate-700">{response.answer}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                {response.citedContextSections.length ? (
                  response.citedContextSections.map((section) => (
                    <span key={section} className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                      {section}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">No cited sections</span>
                )}
              </div>
            </div>

            {response.safetyWarnings.length ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4" />
                  <div>
                    {response.safetyWarnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {hasActions ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">Suggested actions</h3>
                  <button
                    type="button"
                    onClick={() => {
                      if (lastPayload) saveMutation.mutate(lastPayload);
                    }}
                    disabled={!lastPayload || saveMutation.isPending || savedCount > 0}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {savedCount > 0 ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Save className="h-3.5 w-3.5" />}
                    {savedCount > 0 ? 'Saved for governance' : 'Save as recommendation'}
                  </button>
                </div>
                {response.suggestedActions.map((item) => (
                  <ActionCard key={`${item.title}-${item.department}`} action={item} />
                ))}
                <p className="text-xs text-slate-500">
                  Task creation follows AI Governance: save, approve, then create task from the recommendation queue.
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className={`rounded-xl border border-dashed p-4 text-sm ${workspace ? 'border-blue-300/20 bg-white/5 text-blue-100/70' : 'border-border bg-bg text-text-muted'}`}>
            Ask a question to generate a role-aware operational answer.
          </div>
        )}
      </div>
    </section>
  );
}
