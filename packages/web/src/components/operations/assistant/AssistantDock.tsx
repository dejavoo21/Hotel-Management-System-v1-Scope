import type { OperationsContext } from '@/services/operations';
import AssistantChatPanel from './AssistantChatPanel';
import ContextPreview from './ContextPreview';

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
              <div className="mt-1 text-xs text-slate-500">Ask questions using live operational context.</div>
            </div>
          </div>
          <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
            {context ? 'Context-ready' : 'No context'}
          </span>
        </div>
        <AssistantChatPanel context={context ?? null} />
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
