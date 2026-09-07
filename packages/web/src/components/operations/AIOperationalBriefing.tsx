import { Activity, ArrowRight, Bot, Clock3, Database, RefreshCcw, ShieldAlert, Sparkles } from 'lucide-react';
import type { DailyGMBriefing, DailyBriefingItem } from '@/services/aiBriefing';
import type { AIRecommendation } from '@/services/aiRecommendations';
import { openLafloAssistant } from '@/lib/assistantEvents';

type Props = {
  briefing?: DailyGMBriefing;
  recommendations: AIRecommendation[];
  contextSourceCount: number;
  contextGeneratedAt?: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
};

const severityRank: Record<NonNullable<DailyBriefingItem['severity']>, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

function topRisk(briefing?: DailyGMBriefing) {
  const risks = [
    ...(briefing?.operationalRisks || []),
    ...(briefing?.guestExperienceRisks || []),
    ...(briefing?.maintenanceConcerns || []),
    ...(briefing?.securityConcerns || []),
    ...(briefing?.smartBuildingConcerns || []),
  ];

  return risks.reduce<DailyBriefingItem | undefined>((current, item) => {
    if (!current) return item;
    return (severityRank[item.severity || 'LOW'] || 0) > (severityRank[current.severity || 'LOW'] || 0)
      ? item
      : current;
  }, undefined);
}

function formatGeneratedTime(value?: string | null) {
  if (!value) return 'Awaiting first briefing';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Generation time unavailable';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AIOperationalBriefing({
  briefing,
  recommendations,
  contextSourceCount,
  contextGeneratedAt,
  isLoading,
  isRefreshing,
  onRefresh,
}: Props) {
  const risk = topRisk(briefing);
  const priorityRecommendation = recommendations.find((item) => item.priority === 'CRITICAL' || item.priority === 'HIGH') || recommendations[0];
  const recommendedAction = briefing?.recommendedActions[0];
  const confidence = recommendations.length
    ? Math.round((recommendations.reduce((total, item) => total + item.confidence, 0) / recommendations.length) * 100)
    : null;
  const generatedAt = briefing?.generatedAt || contextGeneratedAt;
  const keyInsight = briefing?.executiveSummary
    || briefing?.todayPriorities[0]?.title
    || (recommendations.length ? `${recommendations.length} governed AI recommendation${recommendations.length === 1 ? '' : 's'} require review.` : 'No urgent AI-generated operational items are waiting for review.');
  const riskCopy = risk
    ? `${risk.title}${risk.detail ? ` — ${risk.detail}` : ''}`
    : 'No high-priority operational risk is currently identified from the available context.';
  const actionCopy = recommendedAction
    ? `${recommendedAction.title} — ${recommendedAction.rationale}`
    : priorityRecommendation?.description || priorityRecommendation?.title || 'Review the recommendation queue and assign owners to any overdue operational work.';

  const reviewRecommendations = () => {
    document.getElementById('ai-recommendation-governance')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (isLoading) {
    return (
      <section aria-label="AI Operational Briefing" className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="h-5 w-48 animate-pulse rounded bg-bg" />
        <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-bg" />
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-bg" />)}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="ai-operational-briefing-title" className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-gradient-to-r from-primary-50/80 via-card to-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="theme-kpi-icon grid h-11 w-11 shrink-0 place-items-center rounded-2xl"><Sparkles className="h-5 w-5" /></span>
            <div>
              <h2 id="ai-operational-briefing-title" className="text-lg font-semibold text-text-main">AI Operational Briefing</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-text-muted">Latest role-aware operational insight generated from available hotel context.</p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />{briefing?.source === 'AI' ? 'AI generated' : 'Rules assisted'}
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className="grid gap-3 lg:grid-cols-3">
          <BriefingItem icon={Sparkles} label="Today’s key AI insight" text={keyInsight} tone="insight" />
          <BriefingItem icon={ShieldAlert} label="Top operational risk" text={riskCopy} tone="risk" />
          <BriefingItem icon={Activity} label="Recommended next action" text={actionCopy} tone="action" />
        </div>

        <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-bg/40 p-3 sm:grid-cols-3">
          <BriefingMeta icon={Bot} label="Confidence score" value={confidence === null ? 'Not available' : `${confidence}%`} />
          <BriefingMeta icon={Database} label="Available context" value={`${contextSourceCount} source${contextSourceCount === 1 ? '' : 's'}`} />
          <BriefingMeta icon={Clock3} label="Last generated" value={formatGeneratedTime(generatedAt)} />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openLafloAssistant({
              mode: 'operations',
              prompt: 'Explain today’s AI operational briefing and the recommended next action.',
              context: {
                page: 'Operations Center',
                briefingGeneratedAt: generatedAt || null,
                contextSourceCount,
                recommendationCount: recommendations.length,
                confidence,
                topRisk: risk?.title || null,
                recommendedAction: recommendedAction?.title || priorityRecommendation?.title || null,
              },
            })}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-contrast shadow-sm hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
          >
            <Bot className="h-4 w-4" />Ask LaFlo for details
          </button>
          <button type="button" onClick={reviewRecommendations} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-text-main hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2">
            Review recommendations <ArrowRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={onRefresh} disabled={isRefreshing} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-text-main hover:bg-bg disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2">
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />{isRefreshing ? 'Refreshing…' : 'Refresh briefing'}
          </button>
        </div>
      </div>
    </section>
  );
}

function BriefingItem({ icon: Icon, label, text, tone }: { icon: typeof Sparkles; label: string; text: string; tone: 'insight' | 'risk' | 'action' }) {
  const toneClasses = {
    insight: 'border-sky-200 bg-sky-50/50 text-sky-700',
    risk: 'border-amber-200 bg-amber-50/50 text-amber-700',
    action: 'border-emerald-200 bg-emerald-50/50 text-emerald-700',
  };
  return <article className={`min-h-36 rounded-2xl border p-4 ${toneClasses[tone]}`}><div className="flex items-center gap-2"><Icon className="h-4 w-4" /><h3 className="text-xs font-semibold uppercase tracking-wide">{label}</h3></div><p className="mt-3 text-sm font-medium leading-6 text-text-main">{text}</p></article>;
}

function BriefingMeta({ icon: Icon, label, value }: { icon: typeof Bot; label: string; value: string }) {
  return <div className="flex min-w-0 items-center gap-3 rounded-xl bg-card p-3"><Icon className="h-4 w-4 shrink-0 text-primary-600" /><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{label}</p><p className="mt-1 truncate text-xs font-semibold text-text-main">{value}</p></div></div>;
}
