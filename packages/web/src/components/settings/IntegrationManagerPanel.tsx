import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  Building2,
  Cable,
  Cctv,
  CheckCircle2,
  CloudSun,
  ClipboardList,
  CreditCard,
  Database,
  FileText,
  FilterX,
  Layers,
  Link2,
  LockKeyhole,
  Mail,
  Plus,
  PlugZap,
  RadioTower,
  RefreshCcw,
  Router,
  Search,
  ShieldCheck,
  Thermometer,
  X,
  Zap,
} from 'lucide-react';
import HardwareIntegrationPanel from '@/components/hardware/HardwareIntegrationPanel';
import { getApiError, integrationManagerService } from '@/services';
import type {
  IntegrationCategoryCard,
  IntegrationManagerCategory,
  IntegrationManagerDevice,
  IntegrationManagerLog,
  IntegrationManagerProvider,
} from '@/services/integrationManager';
import { useAuthStore } from '@/stores/authStore';
import { appendAuditLog } from '@/utils/auditLog';

const categoryLabels: Record<IntegrationManagerCategory, string> = {
  CCTV: 'CCTV',
  SMART_LOCKS: 'Smart Locks',
  SENSORS: 'Sensors',
  HVAC: 'HVAC',
  ENERGY_METERS: 'Energy Meters',
  WEATHER: 'Weather',
  PAYMENTS: 'Payments',
  BOOKING_CHANNELS: 'Booking Channels',
  MICROSOFT_365: 'Microsoft 365',
  AI_PROVIDERS: 'OpenAI / AI Providers',
  OTHER_PROVIDERS: 'Other Providers',
};

const statusClass = (status: string) => {
  if (status === 'Connected' || status === 'HEALTHY' || status === 'AVAILABLE') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Requires Attention' || status === 'WARNING') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'Sync Failed' || status === 'Credentials Expired' || status === 'CRITICAL') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (status === 'Coming Soon' || status === 'FUTURE') return 'border-violet-200 bg-violet-50 text-violet-700';
  if (status === 'Demo / Simulation') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString() : 'Never';
const labelize = (value: string) => value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const providerIconClasses: Record<IntegrationManagerCategory, string> = {
  CCTV: 'bg-slate-100 text-slate-700',
  SMART_LOCKS: 'bg-blue-50 text-blue-700',
  SENSORS: 'bg-teal-50 text-teal-700',
  HVAC: 'bg-violet-50 text-violet-700',
  ENERGY_METERS: 'bg-emerald-50 text-emerald-700',
  WEATHER: 'bg-sky-50 text-sky-700',
  PAYMENTS: 'bg-indigo-50 text-indigo-700',
  BOOKING_CHANNELS: 'bg-blue-50 text-blue-700',
  MICROSOFT_365: 'bg-cyan-50 text-cyan-700',
  AI_PROVIDERS: 'bg-slate-100 text-slate-800',
  OTHER_PROVIDERS: 'bg-rose-50 text-rose-700',
};

const categoryIcons: Record<IntegrationManagerCategory, typeof Cable> = {
  CCTV: Cctv,
  SMART_LOCKS: LockKeyhole,
  SENSORS: RadioTower,
  HVAC: Thermometer,
  ENERGY_METERS: Zap,
  WEATHER: CloudSun,
  PAYMENTS: CreditCard,
  BOOKING_CHANNELS: Building2,
  MICROSOFT_365: Mail,
  AI_PROVIDERS: BrainCircuit,
  OTHER_PROVIDERS: PlugZap,
};

const providerBrandAssets = [
  { match: 'microsoft', src: '/assets/integration-providers/microsoft-365.ico' },
  { match: 'openweather', src: '/assets/integration-providers/openweather.svg' },
  { match: 'booking.com', src: '/assets/integration-providers/booking-com.svg' },
  { match: 'hikvision', src: '/assets/integration-providers/hikvision.ico' },
  { match: 'ttlock', src: '/assets/integration-providers/ttlock.png' },
  { match: 'twilio', src: '/assets/integration-providers/twilio.png' },
  { match: 'stripe', src: '/assets/integration-providers/stripe.svg' },
  { match: 'openai', src: '/assets/integration-providers/openai.svg' },
] as const;

function ProviderIcon({ providerName, category, connected = false, size = 'md' }: { providerName: string; category: IntegrationManagerCategory; connected?: boolean; size?: 'sm' | 'md' }) {
  const normalized = providerName.toLowerCase();
  const brandAsset = providerBrandAssets.find(({ match }) => normalized.includes(match));
  const FallbackIcon = categoryIcons[category];
  const dimensions = size === 'sm' ? 'h-9 w-9 rounded-xl' : 'h-11 w-11 rounded-2xl';
  return (
    <span role="img" aria-label={`${providerName} integration icon`} className={`relative grid shrink-0 place-items-center ${dimensions} ${brandAsset ? 'bg-white' : providerIconClasses[category]} ${connected ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-card' : 'ring-1 ring-border'}`}>
      {brandAsset ? (
        <img src={brandAsset.src} alt="" className={size === 'sm' ? 'h-5 w-5 object-contain' : 'h-6 w-6 object-contain'} aria-hidden="true" />
      ) : <FallbackIcon className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} aria-hidden="true" />}
      {connected ? <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-card"><CheckCircle2 className="h-3 w-3" aria-hidden="true" /></span> : null}
    </span>
  );
}

function CategoryCard({
  card,
  onPrimary,
  onSecondary,
  canManage,
  provider,
}: {
  card: IntegrationCategoryCard;
  onPrimary: () => void;
  onSecondary: () => void;
  canManage: boolean;
  provider?: IntegrationManagerProvider;
}) {
  const connected = card.connectionStatus === 'Connected';
  const needsAttention = ['Requires Attention', 'Sync Failed', 'Credentials Expired'].includes(card.connectionStatus);
  const comingSoon = provider?.status === 'FUTURE';
  const demo = /demo|simulation/i.test(provider?.providerType || '');
  const primaryLabel = comingSoon ? 'View details' : demo ? 'View demo' : connected ? 'Manage' : needsAttention ? 'Review issue' : 'Configure';
  const secondaryLabel = connected || needsAttention ? 'View logs' : 'View providers';
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ProviderIcon providerName={card.providerName} category={card.category} connected={connected} />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-text-main">{card.label}</div>
            <div className="mt-1 truncate text-xs text-text-muted">{card.providerName}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1"><span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(card.connectionStatus)}`}>{card.connectionStatus}</span>{comingSoon || demo ? <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(comingSoon ? 'Coming Soon' : 'Demo / Simulation')}`}>{comingSoon ? 'Coming Soon' : 'Demo / Simulation'}</span> : null}</div>
      </div>
      <div className="mt-3 grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-bg/40 text-xs">
        <div className="px-3 py-2">
          <span className="block text-text-muted">Connected</span>
          <span className="mt-1 block font-semibold text-text-main">{card.connectedCount}</span>
        </div>
        <div className="px-3 py-2">
          <span className="block text-text-muted">Errors</span>
          <span className={card.errorCount > 0 ? 'mt-1 block font-semibold text-rose-700' : 'mt-1 block font-semibold text-text-main'}>{card.errorCount}</span>
        </div>
        <div className="px-3 py-2"><span className="block text-text-muted">Health</span><span className="mt-1 block truncate font-semibold text-text-main">{labelize(card.healthStatus)}</span></div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-text-muted"><span>Last sync</span><span className="truncate font-medium text-text-main">{formatDate(card.lastSyncAt)}</span></div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
        <button type="button" className={canManage && !comingSoon ? 'btn-primary h-9 px-3 text-xs' : 'btn-outline h-9 px-3 text-xs'} onClick={onPrimary}>{canManage ? primaryLabel : 'View details'}</button>
        {!comingSoon ? <button type="button" className="btn-outline h-9 px-3 text-xs" onClick={onSecondary}>{secondaryLabel}</button> : null}
      </div>
    </article>
  );
}

function ProviderRegistry({
  providers,
  category,
}: {
  providers: IntegrationManagerProvider[];
  category: IntegrationManagerCategory;
}) {
  const visible = providers.filter((provider) => provider.category === category);
  if (!visible.length) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">No providers registered for this category yet.</div>;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {visible.map((provider) => (
        <div key={provider.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <ProviderIcon providerName={provider.name} category={provider.category} size="sm" />
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-950">{provider.name}</div>
                <div className="mt-1 truncate text-xs text-slate-500">{provider.connectionMethods.join(' / ')}</div>
              </div>
            </div>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(provider.status)}`}>
              {labelize(provider.status)}
            </span>
          </div>
          <div className="mt-3 space-y-1">
            {provider.credentialFields.length ? provider.credentialFields.map((field) => (
              <div key={field.key} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                <span className="font-medium text-slate-700">{field.label}</span>
                <span className={field.secret ? 'text-amber-700' : 'text-slate-500'}>{field.secret ? 'Masked' : field.required ? 'Required' : 'Optional'}</span>
              </div>
            )) : (
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">No credentials required.</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function LogsDrawer({ logs }: { logs: IntegrationManagerLog[] }) {
  if (!logs.length) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">No integration logs yet.</div>;
  }
  return (
    <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
      {logs.map((log) => (
        <div key={log.id} className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              log.level === 'ERROR' ? 'bg-rose-100 text-rose-700' : log.level === 'WARN' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {log.level}
            </span>
            <span className="text-xs text-slate-400">{formatDate(log.createdAt)}</span>
          </div>
          <p className="mt-2 text-sm text-slate-700">{log.message}</p>
          <p className="mt-1 text-xs text-slate-400">{categoryLabels[log.category]}</p>
        </div>
      ))}
    </div>
  );
}

function DeviceMappingTable({ devices }: { devices: IntegrationManagerDevice[] }) {
  if (!devices.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
        <Router className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-3 text-sm font-semibold text-slate-800">No imported devices for this category.</p>
        <p className="mt-1 text-sm text-slate-500">Test or save an integration, then import and map devices to hotel areas.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {devices.map((device) => (
        <div key={device.id} className="grid gap-3 border-b border-slate-100 p-4 last:border-b-0 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="text-sm font-bold text-slate-900">{device.name}</div>
            <div className="mt-1 text-xs text-slate-500">{device.provider} / {device.protocol}</div>
          </div>
          <div className="text-sm text-slate-600">{[device.location, device.roomArea, device.floor != null ? `Floor ${device.floor}` : null].filter(Boolean).join(' / ') || 'Unmapped'}</div>
          <div>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(device.status)}`}>{device.status}</span>
          </div>
          <div className="text-xs text-slate-500">
            <div>Credential: {device.credentialMasked || 'Reference only'}</div>
            <div className="truncate">{device.credentialReference}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function IntegrationManagerPanel() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const canManage = user?.role === 'ADMIN';
  const [activeCategory, setActiveCategory] = useState<IntegrationManagerCategory>('CCTV');
  const [activeView, setActiveView] = useState<'dashboard' | 'setup' | 'logs' | 'devices'>('dashboard');
  const [tab, setTab] = useState<'ALL' | 'CONNECTED' | 'ATTENTION' | 'HARDWARE' | 'CLOUD' | 'COMING_SOON'>('ALL');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [providerFilter, setProviderFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [detailOpen, setDetailOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupStep, setSetupStep] = useState(1);

  const overviewQuery = useQuery({
    queryKey: ['integration-manager', 'overview'],
    queryFn: integrationManagerService.overview,
    staleTime: 30_000,
  });
  const devicesQuery = useQuery({
    queryKey: ['integration-manager', 'devices', activeCategory],
    queryFn: () => integrationManagerService.devices(activeCategory),
    staleTime: 30_000,
  });
  const publishMutation = useMutation({
    mutationFn: () => integrationManagerService.publishEvent('integration.device.imported', activeCategory, { category: activeCategory }),
    onSuccess: async () => {
      toast.success('Integration event published');
      await queryClient.invalidateQueries({ queryKey: ['integration-manager'] });
    },
    onError: (error) => toast.error(getApiError(error).message),
  });
  const actionMutation = useMutation({
    mutationFn: (eventType: string) => integrationManagerService.publishEvent(eventType, activeCategory, { category: activeCategory }),
    onSuccess: async (_result, eventType) => {
      toast.success(eventType === 'integration.connection.tested' ? 'Connection test requested' : 'Integration action requested');
      await queryClient.invalidateQueries({ queryKey: ['integration-manager'] });
    },
    onError: (error) => toast.error(getApiError(error).message),
  });

  const overview = overviewQuery.data;
  const selectedCard = overview?.categories.find((card) => card.category === activeCategory);
  const providers = overview?.registry || [];
  const logs = useMemo(() => (overview?.recentLogs || []).filter((log) => log.category === activeCategory), [activeCategory, overview?.recentLogs]);
  const devices = devicesQuery.data || [];
  const hardwareMode = activeCategory === 'CCTV' ? 'cctv' : 'smart-building';
  const supportsHardwareSetup = ['CCTV', 'SMART_LOCKS', 'SENSORS', 'HVAC', 'ENERGY_METERS', 'OTHER_PROVIDERS'].includes(activeCategory);
  const hardwareCategories: IntegrationManagerCategory[] = ['CCTV', 'SMART_LOCKS', 'SENSORS', 'HVAC', 'ENERGY_METERS'];
  const latestSync = useMemo(() => (overview?.categories || [])
    .map((card) => card.lastSyncAt).filter(Boolean).sort().at(-1) || null, [overview?.categories]);
  const providerNames = useMemo(() => Array.from(new Set(providers.map((provider) => provider.name))).sort(), [providers]);
  const visibleCards = useMemo(() => (overview?.categories || []).filter((card) => {
    const provider = providers.find((item) => item.category === card.category);
    const haystack = `${card.label} ${card.providerName}`.toLowerCase();
    const attention = ['Requires Attention', 'Sync Failed', 'Credentials Expired'].includes(card.connectionStatus);
    const tabMatch = tab === 'ALL'
      || (tab === 'CONNECTED' && card.connectionStatus === 'Connected')
      || (tab === 'ATTENTION' && attention)
      || (tab === 'HARDWARE' && hardwareCategories.includes(card.category))
      || (tab === 'CLOUD' && !hardwareCategories.includes(card.category))
      || (tab === 'COMING_SOON' && provider?.status === 'FUTURE');
    return tabMatch
      && (!search.trim() || haystack.includes(search.trim().toLowerCase()))
      && (categoryFilter === 'ALL' || card.category === categoryFilter)
      && (statusFilter === 'ALL' || card.connectionStatus === statusFilter)
      && (providerFilter === 'ALL' || card.providerName === providerFilter)
      && (typeFilter === 'ALL' || (provider?.providerType || '') === typeFilter);
  }), [categoryFilter, overview?.categories, providerFilter, providers, search, statusFilter, tab, typeFilter]);
  const hasFilters = Boolean(search || categoryFilter !== 'ALL' || statusFilter !== 'ALL' || providerFilter !== 'ALL' || typeFilter !== 'ALL');
  const recordAction = (action: string, card: IntegrationCategoryCard) => appendAuditLog({
    action,
    actorId: user?.id,
    actorName: user?.email || 'Integration administrator',
    targetId: card.category,
    targetLabel: `${card.label} / ${card.providerName}`,
    details: { category: card.category, provider: card.providerName, status: card.connectionStatus },
  });
  const selectCard = (card: IntegrationCategoryCard, view: typeof activeView) => {
    setActiveCategory(card.category);
    setActiveView(view);
  };

  if (overviewQuery.isLoading) {
    return (
      <div className="card">
        <div className="h-5 w-64 animate-pulse rounded bg-slate-100" />
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      </div>
    );
  }

  if (overviewQuery.isError) {
    return (
      <div className="card border-rose-200 bg-rose-50 text-rose-700">
        Integration Manager could not be loaded.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
              <Link2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-text-main">Integration Manager</h2>
              <p className="mt-1 max-w-4xl text-sm text-text-muted">
                Centrally configure external systems, hardware, providers, credentials, sync status, and platform integration events.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => overviewQuery.refetch()} className="btn-outline"><RefreshCcw className={`h-4 w-4 ${overviewQuery.isFetching ? 'animate-spin' : ''}`} />Refresh</button>
            {canManage ? <button type="button" onClick={() => { setSetupOpen(true); setSetupStep(1); }} className="btn-primary"><Plus className="h-4 w-4" />Add integration</button> : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <Database className="h-5 w-5 text-slate-500" />
            <p className="mt-2 text-xs font-semibold text-text-muted">Categories</p><p className="mt-1 text-xl font-bold text-text-main">{overview?.categories.length || 0}</p><p className="text-xs text-text-muted">Integration groups available</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="mt-2 text-xs font-semibold text-text-muted">Connected</p><p className="mt-1 text-xl font-bold text-text-main">{overview?.categories.filter((card) => card.connectionStatus === 'Connected').length || 0}</p><p className="text-xs text-text-muted">Active provider connections</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <p className="mt-2 text-xs font-semibold text-text-muted">Needs Attention</p><p className="mt-1 text-xl font-bold text-text-main">{overview?.categories.filter((card) => ['Requires Attention', 'Sync Failed', 'Credentials Expired'].includes(card.connectionStatus)).length || 0}</p><p className="text-xs text-text-muted">Issues requiring action</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <Layers className="h-5 w-5 text-slate-500" />
            <p className="mt-2 text-xs font-semibold text-text-muted">Providers</p><p className="mt-1 text-xl font-bold text-text-main">{providers.length}</p><p className="text-xs text-text-muted">Supported provider options</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:col-span-2 lg:col-span-1"><RefreshCcw className="h-5 w-5 text-blue-600" /><p className="mt-2 text-xs font-semibold text-text-muted">Last Sync</p><p className="mt-1 text-xl font-bold text-text-main">{latestSync ? new Date(latestSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}</p><p className="text-xs text-text-muted">Most recent integration update</p></div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap border-b border-border px-3 pt-2" role="tablist" aria-label="Integration groups">
          {([['ALL', 'All'], ['CONNECTED', 'Connected'], ['ATTENTION', 'Needs Attention'], ['HARDWARE', 'Hardware'], ['CLOUD', 'Cloud Services'], ['COMING_SOON', 'Coming Soon']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`border-b-2 px-4 py-2.5 text-sm font-medium ${tab === value ? 'border-primary-600 text-primary-700' : 'border-transparent text-text-muted hover:text-text-main'}`}>{label}</button>)}
        </div>
        <div className="grid gap-2.5 border-b border-border p-3 md:grid-cols-2 xl:grid-cols-[1.3fr_repeat(4,1fr)_auto]">
          <label className="relative"><span className="sr-only">Search integrations</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-text-muted" /><input className="input h-10 pl-9" placeholder="Search integrations..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <select aria-label="Category filter" className="input h-10" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="ALL">All categories</option>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select aria-label="Status filter" className="input h-10" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option>{['Connected', 'Not Connected', 'Requires Attention', 'Sync Failed', 'Credentials Expired', 'Disabled'].map((value) => <option key={value}>{value}</option>)}</select>
          <select aria-label="Provider filter" className="input h-10" value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}><option value="ALL">All providers</option>{providerNames.map((value) => <option key={value}>{value}</option>)}</select>
          <select aria-label="Type filter" className="input h-10" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="ALL">All types</option>{Array.from(new Set(providers.map((provider) => provider.providerType))).sort().map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</select>
          <button type="button" className="btn-ghost h-10 whitespace-nowrap px-3" disabled={!hasFilters} onClick={() => { setSearch(''); setCategoryFilter('ALL'); setStatusFilter('ALL'); setProviderFilter('ALL'); setTypeFilter('ALL'); }}><FilterX className="h-4 w-4" />Clear filters</button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {visibleCards.map((card) => {
          const cardProvider = providers.find((provider) => provider.category === card.category);
          const providerUnavailable = cardProvider?.status === 'FUTURE';
          return <CategoryCard
            key={card.category}
            card={card}
            canManage={canManage}
            provider={cardProvider}
            onPrimary={() => { selectCard(card, card.connectionStatus === 'Connected' || providerUnavailable ? 'dashboard' : 'setup'); recordAction(canManage && card.connectionStatus !== 'Connected' && !providerUnavailable ? 'INTEGRATION_SETUP_OPENED' : 'INTEGRATION_VIEWED', card); canManage && card.connectionStatus !== 'Connected' && !providerUnavailable ? setSetupOpen(true) : setDetailOpen(true); }}
            onSecondary={() => { selectCard(card, card.connectionStatus === 'Connected' ? 'logs' : 'dashboard'); if (card.connectionStatus === 'Connected') setDetailOpen(true); }}
          />
        })}
        {!visibleCards.length ? <div className="col-span-full rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center"><PlugZap className="mx-auto h-8 w-8 text-text-muted" /><p className="mt-3 font-semibold text-text-main">No integrations match your filters.</p><button type="button" className="btn-ghost mt-2" onClick={() => { setSearch(''); setCategoryFilter('ALL'); setStatusFilter('ALL'); setProviderFilter('ALL'); setTypeFilter('ALL'); setTab('ALL'); }}>Clear filters</button></div> : null}
      </section>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Integration Manager views">
        {[
          ['dashboard', 'Category Dashboard', Activity],
          ...(canManage ? [['setup', 'Setup Flow', ClipboardList] as const] : []),
          ['devices', 'Devices & Mapping', Search],
          ['logs', 'Logs', FileText],
        ].map(([id, label, Icon]) => (
          <button
            key={id as string}
            type="button"
            onClick={() => setActiveView(id as typeof activeView)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
              activeView === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label as string}
          </button>
        ))}
      </div>

      {activeView === 'dashboard' ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="card">
            <h3 className="text-base font-semibold text-slate-900">{categoryLabels[activeCategory]}</h3>
            <p className="mt-1 text-sm text-slate-500">
              Provider registry and configuration requirements for this integration category.
            </p>
            <div className="mt-4">
              <ProviderRegistry providers={providers} category={activeCategory} />
            </div>
          </div>
          <div className="card">
            <ShieldCheck className="h-5 w-5 text-slate-500" />
            <h3 className="mt-2 text-base font-semibold text-slate-900">Credential handling</h3>
            <p className="mt-2 text-sm text-slate-600">
              Raw passwords, RTSP URLs, API keys, and device secrets stay server-side. Modules receive only masked values and credential references.
            </p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              {selectedCard?.providerName || 'Provider'} / {selectedCard?.connectionStatus || 'Not Connected'}
            </div>
          </div>
        </div>
      ) : null}

      {activeView === 'setup' ? (
        <div className="space-y-5">
          <div className="card">
            <h3 className="text-base font-semibold text-slate-900">Standard setup workflow</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {(overview?.setupSteps || []).map((step, index) => (
                <div key={step} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-500">Step {index + 1}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{step}</div>
                </div>
              ))}
            </div>
          </div>
          {supportsHardwareSetup ? (
            <HardwareIntegrationPanel mode={hardwareMode} canManage={canManage} surface="manager" />
          ) : (
            <div className="card">
              <Cable className="h-5 w-5 text-slate-500" />
              <h3 className="mt-2 text-base font-semibold text-slate-900">Provider setup</h3>
              <p className="mt-1 text-sm text-slate-600">
                {categoryLabels[activeCategory]} uses environment-backed provider adapters for now. Configure secrets in Railway or the future secret manager, then test from this panel.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {activeView === 'devices' ? (
        <div className="space-y-4">
          <div className="card">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Device import and hotel-area mapping</h3>
                <p className="mt-1 text-sm text-slate-500">Imported devices are mapped to floors, rooms, areas, and module entities from this central manager.</p>
              </div>
              {canManage ? <button
                type="button"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <PlugZap className="h-4 w-4" />
                Publish import event
              </button> : null}
            </div>
          </div>
          <DeviceMappingTable devices={devices} />
        </div>
      ) : null}

      {activeView === 'logs' ? (
        <div className="card">
          <h3 className="text-base font-semibold text-slate-900">Integration logs</h3>
          <p className="mt-1 text-sm text-slate-500">Setup, test, connection, import, and sync events for {categoryLabels[activeCategory]}.</p>
          <div className="mt-4">
            <LogsDrawer logs={logs} />
          </div>
        </div>
      ) : null}

      {detailOpen && selectedCard ? (
        <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/40" role="dialog" aria-modal="true" aria-labelledby="integration-detail-title">
          <div className="flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div className="flex items-center gap-3"><ProviderIcon providerName={selectedCard.providerName} category={selectedCard.category} connected={selectedCard.connectionStatus === 'Connected'} /><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Integration details</p><h3 id="integration-detail-title" className="mt-1 text-xl font-bold text-text-main">{selectedCard.label}</h3><p className="mt-1 text-sm text-text-muted">{selectedCard.providerName}</p></div></div>
              <button type="button" className="btn-ghost h-9 w-9 p-0" onClick={() => setDetailOpen(false)} aria-label="Close integration details"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-3">
                {[['Status', selectedCard.connectionStatus], ['Health', labelize(selectedCard.healthStatus)], ['Connected', String(selectedCard.connectedCount)], ['Errors', String(selectedCard.errorCount)], ['Last sync', formatDate(selectedCard.lastSyncAt)], ['Credential', selectedCard.connectionStatus === 'Credentials Expired' ? 'Requires re-authentication' : selectedCard.connectionStatus === 'Connected' ? 'Credential stored' : 'Credential missing']].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-bg/40 p-3"><p className="text-xs text-text-muted">{label}</p><p className="mt-1 text-sm font-semibold text-text-main">{value}</p></div>)}
              </div>
              <div><h4 className="font-semibold text-text-main">Recent events</h4><div className="mt-3"><LogsDrawer logs={logs} /></div></div>
              <div className="rounded-xl border border-border bg-bg/40 p-4"><ShieldCheck className="h-5 w-5 text-primary-700" /><p className="mt-2 text-sm font-semibold text-text-main">Credential security</p><p className="mt-1 text-sm text-text-muted">Only credential status and server-side references are shown. Raw secrets are never returned to this interface.</p></div>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border p-4">
              {canManage ? <button type="button" className="btn-primary" disabled={actionMutation.isPending} onClick={() => { actionMutation.mutate('integration.connection.tested'); recordAction('INTEGRATION_CONNECTION_TESTED', selectedCard); }}>Test connection</button> : null}
              <button type="button" className="btn-outline" onClick={() => setActiveView('logs')}>View logs</button>
              {canManage ? <button type="button" className="btn-outline" onClick={() => { setDetailOpen(false); setSetupOpen(true); setSetupStep(1); }}>Edit configuration</button> : null}
            </div>
          </div>
        </div>
      ) : null}

      {setupOpen ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="integration-setup-title">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Step {setupStep} of 7</p><h3 id="integration-setup-title" className="mt-1 text-xl font-bold text-text-main">Add integration</h3><p className="mt-1 text-sm text-text-muted">Configure a provider without exposing raw credentials.</p></div><button type="button" className="btn-ghost h-9 w-9 p-0" onClick={() => setSetupOpen(false)} aria-label="Close setup wizard"><X className="h-4 w-4" /></button></div>
            <div className="grid grid-cols-7 gap-1 px-5 pt-5" aria-label="Setup progress">{Array.from({ length: 7 }, (_, index) => <span key={index} className={`h-1.5 rounded-full ${index + 1 <= setupStep ? 'bg-primary-600' : 'bg-border'}`} />)}</div>
            <div className="min-h-64 p-5">
              {setupStep === 1 ? <div><h4 className="font-semibold text-text-main">Select category</h4><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(categoryLabels).map(([value, label]) => <button key={value} type="button" onClick={() => setActiveCategory(value as IntegrationManagerCategory)} className={`rounded-xl border p-3 text-left text-sm font-medium ${activeCategory === value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-border text-text-main hover:bg-bg'}`}>{label}</button>)}</div></div> : null}
              {setupStep === 2 ? <div><h4 className="font-semibold text-text-main">Select provider</h4><div className="mt-3"><ProviderRegistry providers={providers} category={activeCategory} /></div></div> : null}
              {setupStep === 3 ? <div><h4 className="font-semibold text-text-main">Connection details</h4><p className="mt-1 text-sm text-text-muted">Secrets are sent securely and are not retained in frontend state.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label><span className="label">Endpoint or tenant</span><input className="input" autoComplete="off" /></label><label><span className="label">Credential</span><input type="password" className="input" autoComplete="new-password" placeholder="••••••••••••" /></label></div></div> : null}
              {setupStep === 4 ? <div className="text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-primary-600" /><h4 className="mt-3 font-semibold text-text-main">Test connection</h4><p className="mt-1 text-sm text-text-muted">Verify provider access before discovery.</p><button type="button" className="btn-primary mt-4" onClick={() => actionMutation.mutate('integration.connection.tested')}>Run connection test</button></div> : null}
              {setupStep === 5 ? <div><h4 className="font-semibold text-text-main">Discover services or devices</h4><p className="mt-2 text-sm text-text-muted">Discovery becomes available after a successful connection. Unsupported providers remain clearly marked as coming soon or environment configured.</p></div> : null}
              {setupStep === 6 ? <div><h4 className="font-semibold text-text-main">Map services</h4><p className="mt-2 text-sm text-text-muted">Map discovered devices or services to hotel floors, rooms, areas, and consuming modules.</p></div> : null}
              {setupStep === 7 ? <div><h4 className="font-semibold text-text-main">Review and save</h4><div className="mt-3 rounded-xl border border-border bg-bg/40 p-4 text-sm text-text-muted"><p><strong className="text-text-main">Category:</strong> {categoryLabels[activeCategory]}</p><p className="mt-2"><strong className="text-text-main">Credential:</strong> Stored securely after save; raw value will not be displayed.</p></div></div> : null}
            </div>
            <div className="flex items-center justify-between border-t border-border p-4"><button type="button" className="btn-outline" disabled={setupStep === 1} onClick={() => setSetupStep((step) => Math.max(1, step - 1))}>Back</button>{setupStep < 7 ? <button type="button" className="btn-primary" onClick={() => setSetupStep((step) => Math.min(7, step + 1))}>Continue</button> : <button type="button" className="btn-primary" onClick={() => { const card = overview?.categories.find((item) => item.category === activeCategory); if (card) recordAction('INTEGRATION_CONFIGURATION_SAVED', card); actionMutation.mutate('integration.updated'); setSetupOpen(false); }}>Save integration</button>}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
