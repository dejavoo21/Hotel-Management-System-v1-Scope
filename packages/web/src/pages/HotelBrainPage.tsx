import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Brain, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import enterpriseSearchService from '@/services/enterpriseSearch';
import EnterpriseSearchResultCard from '@/components/search/EnterpriseSearchResultCard';

const prompts = [
  "Which rooms are not ready for today's arrivals?",
  'Show open incidents affecting guest experience.',
  'Which devices are offline on the third floor?',
  'Are there any unresolved CCTV issues?',
  'What maintenance tasks are overdue?',
  'What happened overnight?',
];

export default function HotelBrainPage() {
  const [question, setQuestion] = useState('What should the GM pay attention to this morning?');
  const mutation = useMutation({
    mutationFn: enterpriseSearchService.askHotelBrain,
  });

  const ask = (value = question) => {
    const next = value.trim();
    if (!next) return;
    setQuestion(next);
    mutation.mutate(next);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-700 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">AI / Hotel Brain</p>
              <h1 className="mt-1 text-2xl font-semibold">Operational intelligence with evidence</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-200">
                Ask questions across authorised indexed hotel data, AI context, operational events, integrations, tasks, incidents, and recommendations.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-xs text-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Permission-filtered answers
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className="min-h-24 flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            placeholder="Ask Hotel Brain..."
          />
          <button
            type="button"
            onClick={() => ask()}
            disabled={mutation.isPending}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            Ask
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {prompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => ask(prompt)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              {prompt}
            </button>
          ))}
        </div>
      </section>

      {mutation.isPending ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Hotel Brain is gathering authorised evidence...</div>
      ) : mutation.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">Hotel Brain could not answer. Rebuild the Enterprise Search index and try again.</div>
      ) : mutation.data ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  Confidence {Math.round(mutation.data.confidence * 100)}%
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {mutation.data.supportingRecords.length} source records
                </span>
              </div>
              <p className="mt-4 text-base leading-7 text-slate-800">{mutation.data.answer}</p>
              {mutation.data.safetyWarnings.length ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {mutation.data.safetyWarnings.join(' ')}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-950">Recommended actions</h2>
              <div className="mt-3 space-y-3">
                {mutation.data.suggestedActions.map((action) => (
                  <div key={action.title} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-950">{action.title}</p>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">{action.priority}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{action.description}</p>
                    {action.requiresConfirmation ? (
                      <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-amber-700">
                        <CheckCircle2 className="h-4 w-4" />
                        Requires human confirmation before execution
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-950">Evidence records</h2>
            {mutation.data.supportingRecords.length ? (
              mutation.data.supportingRecords.map((record) => <EnterpriseSearchResultCard key={record.id} result={record} compact />)
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                No evidence records were available for this answer.
              </div>
            )}
          </aside>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <Brain className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 text-sm font-semibold text-slate-900">Ask an operational question</h2>
          <p className="mt-1 text-sm text-slate-500">Hotel Brain answers only with authorised indexed records and context it can cite.</p>
        </div>
      )}
    </div>
  );
}
