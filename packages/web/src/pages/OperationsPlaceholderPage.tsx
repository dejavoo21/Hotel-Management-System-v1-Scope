type OperationsPlaceholderPageProps = {
  title: string;
  section: string;
};

export default function OperationsPlaceholderPage({ title, section }: OperationsPlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">{section}</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h1>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Coming soon
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
        <p className="text-sm font-medium text-slate-700">No data connected yet.</p>
        <p className="mt-1 text-sm text-slate-500">This workspace is ready for the next backend integration.</p>
      </div>
    </div>
  );
}
