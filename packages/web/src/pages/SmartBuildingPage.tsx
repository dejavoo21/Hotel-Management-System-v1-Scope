type BuildingMetric = {
  label: string;
  value: string;
  detail?: string;
  tone: 'emerald' | 'sky' | 'amber' | 'rose' | 'slate';
};

type BuildingSection = {
  title: string;
  description: string;
  items: { label: string; value: string; status: string; tone: BuildingMetric['tone'] }[];
};

const metrics: BuildingMetric[] = [
  { label: 'Active Cameras', value: '42 Online', detail: '2 Offline', tone: 'emerald' },
  { label: 'Doors', value: '315 Locked', detail: '4 Open', tone: 'sky' },
  { label: 'Access Events', value: '127 Today', tone: 'slate' },
  { label: 'Motion Alerts', value: '3 Active', tone: 'amber' },
  { label: 'Temperature Sensors', value: '48 Normal', detail: '2 Warning', tone: 'amber' },
  { label: 'Water Leak Sensors', value: '1 Alert', tone: 'rose' },
  { label: 'Panic Buttons', value: '0 Active', tone: 'emerald' },
];

const sections: BuildingSection[] = [
  {
    title: 'Doors',
    description: 'Lock state, forced-open activity, and high-traffic entries.',
    items: [
      { label: 'Guest Corridors', value: '184 locked', status: 'Normal', tone: 'emerald' },
      { label: 'Service Areas', value: '4 open', status: 'Review', tone: 'amber' },
      { label: 'Emergency Exits', value: '26 locked', status: 'Secure', tone: 'sky' },
    ],
  },
  {
    title: 'Sensors',
    description: 'Temperature, motion, leak detection, and panic button telemetry.',
    items: [
      { label: 'Temperature', value: '48 normal', status: '2 warning', tone: 'amber' },
      { label: 'Water Leak', value: '1 alert', status: 'Action needed', tone: 'rose' },
      { label: 'Panic Buttons', value: '0 active', status: 'Clear', tone: 'emerald' },
    ],
  },
  {
    title: 'Energy',
    description: 'Consumption, savings opportunities, and abnormal usage patterns.',
    items: [
      { label: 'Current Load', value: '72%', status: 'Stable', tone: 'sky' },
      { label: 'Peak Zones', value: '5 zones', status: 'Monitor', tone: 'amber' },
      { label: 'Savings Mode', value: '18 rooms', status: 'Active', tone: 'emerald' },
    ],
  },
  {
    title: 'HVAC',
    description: 'Climate control health across rooms, public areas, and plant systems.',
    items: [
      { label: 'Normal Units', value: '86', status: 'Healthy', tone: 'emerald' },
      { label: 'Warnings', value: '2', status: 'Inspect', tone: 'amber' },
      { label: 'Offline Units', value: '0', status: 'Clear', tone: 'sky' },
    ],
  },
  {
    title: 'Assets',
    description: 'Connected devices, inspection status, and maintenance readiness.',
    items: [
      { label: 'Online Assets', value: '412', status: 'Tracked', tone: 'emerald' },
      { label: 'Needs Inspection', value: '7', status: 'Due today', tone: 'amber' },
      { label: 'Critical Assets', value: '1', status: 'Open alert', tone: 'rose' },
    ],
  },
];

const toneClasses: Record<BuildingMetric['tone'], { card: string; pill: string; dot: string }> = {
  emerald: {
    card: 'border-emerald-100 bg-emerald-50/60',
    pill: 'bg-emerald-100 text-emerald-800',
    dot: 'bg-emerald-500',
  },
  sky: {
    card: 'border-sky-100 bg-sky-50/60',
    pill: 'bg-sky-100 text-sky-800',
    dot: 'bg-sky-500',
  },
  amber: {
    card: 'border-amber-100 bg-amber-50/70',
    pill: 'bg-amber-100 text-amber-800',
    dot: 'bg-amber-500',
  },
  rose: {
    card: 'border-rose-100 bg-rose-50/70',
    pill: 'bg-rose-100 text-rose-800',
    dot: 'bg-rose-500',
  },
  slate: {
    card: 'border-slate-100 bg-slate-50/80',
    pill: 'bg-slate-200 text-slate-800',
    dot: 'bg-slate-500',
  },
};

export default function SmartBuildingPage() {
  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operations / Smart Building</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Smart Building Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Monitor security, access control, environmental sensors, utilities, HVAC, and connected assets from one interface.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-100">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live systems online
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Smart building summary">
        {metrics.map((metric) => (
          <div key={metric.label} className={`rounded-2xl border p-4 shadow-sm ${toneClasses[metric.tone].card}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-700">{metric.label}</div>
              <span className={`h-2.5 w-2.5 rounded-full ${toneClasses[metric.tone].dot}`} />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{metric.value}</div>
            {metric.detail ? <div className="mt-1 text-sm font-semibold text-slate-500">{metric.detail}</div> : null}
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-5">
        {sections.map((section) => (
          <div key={section.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-base font-bold text-slate-900">{section.title}</div>
            <p className="mt-2 min-h-[56px] text-sm text-slate-600">{section.description}</p>
            <div className="mt-4 space-y-3">
              {section.items.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-500">{item.label}</div>
                      <div className="mt-1 text-sm font-bold text-slate-900">{item.value}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${toneClasses[item.tone].pill}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
