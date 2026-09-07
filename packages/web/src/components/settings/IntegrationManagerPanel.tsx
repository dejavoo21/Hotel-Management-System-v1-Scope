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
  MessageSquareText,
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
  CCTV: 'CCTV & Security Integrations',
  SMART_LOCKS: 'Smart Locks',
  SENSORS: 'Sensors',
  HVAC: 'HVAC',
  ENERGY_METERS: 'Energy Meters',
  WEATHER: 'Weather',
  PAYMENTS: 'Payments',
  BOOKING_CHANNELS: 'Booking Channels',
  REVIEW_PLATFORMS: 'Review Platforms',
  MICROSOFT_365: 'Microsoft 365',
  AI_PROVIDERS: 'OpenAI / AI Providers',
  OTHER_PROVIDERS: 'Other Providers',
};

type ProviderDisplayStatus = 'Available' | 'Connected' | 'Future' | 'Disabled';

const providerGroupOrder = [
  'Hotel Core Systems',
  'CCTV & Security Integrations',
  'Smart Building / IoT',
  'Payments',
  'Messaging / Communication',
  'AI / Data Sources',
  'Future Integrations',
] as const;

function groupForProvider(provider: IntegrationManagerProvider) {
  if (provider.category === 'CCTV') return 'CCTV & Security Integrations';
  if (provider.status === 'FUTURE') return 'Future Integrations';
  if (['SMART_LOCKS', 'SENSORS', 'HVAC', 'ENERGY_METERS', 'OTHER_PROVIDERS'].includes(provider.category)) return 'Smart Building / IoT';
  if (provider.category === 'PAYMENTS') return 'Payments';
  if (provider.category === 'MICROSOFT_365') return 'Messaging / Communication';
  if (['AI_PROVIDERS', 'WEATHER'].includes(provider.category)) return 'AI / Data Sources';
  return 'Hotel Core Systems';
}

function displayStatus(provider: IntegrationManagerProvider, cards: IntegrationCategoryCard[]): ProviderDisplayStatus {
  if (provider.status === 'FUTURE') return 'Future';
  if (provider.status === 'ENVIRONMENT_CONFIGURED') return 'Connected';
  const categoryCard = cards.find((card) => card.category === provider.category);
  const selectedProvider = categoryCard?.providerName.trim().toLowerCase() === provider.name.trim().toLowerCase();
  if (selectedProvider && categoryCard?.connectionStatus === 'Disabled') return 'Disabled';
  if (selectedProvider && categoryCard?.connectionStatus === 'Connected') return 'Connected';
  return 'Available';
}

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
  REVIEW_PLATFORMS: 'bg-amber-50 text-amber-700',
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
  REVIEW_PLATFORMS: MessageSquareText,
  MICROSOFT_365: Mail,
  AI_PROVIDERS: BrainCircuit,
  OTHER_PROVIDERS: PlugZap,
};

const providerBrandAssets = [
  { match: 'microsoft', src: '/assets/integration-providers/microsoft-365.ico' },
  { match: 'openweather', src: '/assets/integration-providers/openweather.svg' },
  { match: 'booking.com', src: '/assets/integration-providers/booking-com.png' },
  { match: 'hikvision', src: '/assets/integration-providers/hikvision.ico' },
  { match: 'ttlock', src: '/assets/integration-providers/ttlock.png' },
  { match: 'twilio', src: '/assets/integration-providers/twilio.png' },
  { match: 'stripe', src: '/assets/integration-providers/stripe.png' },
  { match: 'openai', src: '/assets/integration-providers/openai.svg' },
] as const;

const hardwareCategories: IntegrationManagerCategory[] = ['CCTV', 'SMART_LOCKS', 'SENSORS', 'HVAC', 'ENERGY_METERS'];

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
  label,
  cards = [],
  canManage,
  testingProviderId,
  onConfigure,
  onManage,
  onTest,
  onViewDocs,
}: {
  providers: IntegrationManagerProvider[];
  category?: IntegrationManagerCategory;
  label?: string;
  cards?: IntegrationCategoryCard[];
  canManage?: boolean;
  testingProviderId?: string | null;
  onConfigure?: (provider: IntegrationManagerProvider) => void;
  onManage?: (provider: IntegrationManagerProvider) => void;
  onTest?: (provider: IntegrationManagerProvider) => void;
  onViewDocs?: (provider: IntegrationManagerProvider) => void;
}) {
  const visible = category ? providers.filter((provider) => provider.category === category) : providers;
  if (!visible.length) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">No providers registered for this category yet.</div>;
  }
  return (
    <div aria-label={label || 'Integration providers'} className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4">
      {visible.map((provider) => (
        <article key={provider.id} className="flex min-h-[290px] min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary-200 hover:shadow-md">
          {(() => {
            const status = displayStatus(provider, cards);
            const isFuture = status === 'Future';
            const isConnected = status === 'Connected';
            const primaryLabel = !canManage ? 'Permission required' : isFuture ? 'Coming soon' : isConnected ? 'Manage' : 'Configure';
            return <>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <ProviderIcon providerName={provider.name} category={provider.category} connected={status === 'Connected'} size="sm" />
              <div className="min-w-0">
                <div title={provider.name} className="break-words text-sm font-bold leading-5 text-text-main">{provider.name}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-xs text-text-muted">{provider.connectionMethods.map((method) => <span key={method} className="rounded-full border border-border bg-bg px-2 py-0.5">{labelize(method)}</span>)}</div>
              </div>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(status === 'Future' ? 'FUTURE' : status)}`}>
              {status}
            </span>
          </div>
          <div className="mt-3 flex-1 space-y-1">
            {provider.credentialFields.length ? provider.credentialFields.map((field) => (
              <div key={field.key} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-xs">
                <span className="min-w-0 break-words font-medium text-text-main">{field.label}</span>
                <span className={`shrink-0 ${field.secret ? 'text-amber-700' : 'text-text-muted'}`}>{field.secret ? '•••• Masked' : field.required ? 'Required' : 'Optional'}</span>
              </div>
            )) : (
              <div className="rounded-xl border border-border bg-bg px-3 py-2 text-xs text-text-muted">No credentials required.</div>
            )}
          </div>
          {onConfigure || onManage || onViewDocs ? <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
            <button
              type="button"
              disabled={!canManage || isFuture || status === 'Disabled'}
              title={!canManage ? 'Permission required' : isFuture ? 'This provider is not available yet' : status === 'Disabled' ? 'This provider is disabled' : undefined}
              onClick={() => isConnected ? onManage?.(provider) : onConfigure?.(provider)}
              className="btn-primary h-9 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-55"
            >{primaryLabel}</button>
            {!isFuture ? <button type="button" disabled={!canManage || testingProviderId === provider.id} onClick={() => onTest?.(provider)} className="btn-outline h-9 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-55">{testingProviderId === provider.id ? 'Testing…' : 'Test connection'}</button> : null}
            <button type="button" onClick={() => onViewDocs?.(provider)} className="btn-outline h-9 px-3 text-xs">{isFuture ? 'View requirements' : 'View docs'}</button>
          </div> : null}
            </>;
          })()}
        </article>
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
  const [protocolFilter, setProtocolFilter] = useState('ALL');
  const [connectedOnly, setConnectedOnly] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [providerInfo, setProviderInfo] = useState<IntegrationManagerProvider | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<IntegrationManagerProvider | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const [providerTestResult, setProviderTestResult] = useState<string | null>(null);

  const overviewQuery = useQuery({
    queryKey: ['integration-manager', 'overview'],
    queryFn: integrationManagerService.overview,
    staleTime: 30_000,
  });
  const reviewConnectorQuery = useQuery({
    queryKey: ['integration-manager', 'review-platforms'],
    queryFn: integrationManagerService.reviewConnectorStatus,
    staleTime: 15_000,
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
      if (eventType === 'integration.connection.tested') toast.error('Connection testing is unavailable for this provider. No connection was changed.');
      else toast.success('Integration action requested');
      await queryClient.invalidateQueries({ queryKey: ['integration-manager'] });
    },
    onError: (error) => toast.error(getApiError(error).message),
  });
  const providerTestMutation = useMutation({
    mutationFn: (provider: IntegrationManagerProvider) => integrationManagerService.publishEvent(
      'integration.connection.tested',
      provider.id,
      { category: provider.category, providerId: provider.id, requestedFrom: 'provider-catalogue' },
    ),
    onSuccess: async () => {
      setProviderTestResult('Connection testing is unavailable until this provider has a server-side adapter and stored credential reference. No connection was changed.');
      toast.error('Connection test unavailable. No connection was changed.');
      await queryClient.invalidateQueries({ queryKey: ['integration-manager'] });
    },
    onError: (error) => toast.error(getApiError(error).message),
  });
  const connectGoogleMutation = useMutation({
    mutationFn: integrationManagerService.connectGoogleReviews,
    onSuccess: ({ authorizationUrl }) => { window.location.assign(authorizationUrl); },
    onError: (error) => toast.error(getApiError(error).message),
  });
  const syncGoogleMutation = useMutation({
    mutationFn: integrationManagerService.syncGoogleReviews,
    onSuccess: async ({ imported }) => {
      toast.success(`${imported} Google review${imported === 1 ? '' : 's'} synchronized`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['integration-manager'] }),
        queryClient.invalidateQueries({ queryKey: ['reviews'] }),
      ]);
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
  const latestSync = useMemo(() => (overview?.categories || [])
    .map((card) => card.lastSyncAt).filter(Boolean).sort().at(-1) || null, [overview?.categories]);
  const providerNames = useMemo(() => Array.from(new Set(providers.map((provider) => provider.name))).sort(), [providers]);
  const protocols = useMemo(() => Array.from(new Set(providers.flatMap((provider) => provider.connectionMethods))).sort(), [providers]);
  const visibleProviders = useMemo(() => providers.filter((provider) => {
    const status = displayStatus(provider, overview?.categories || []);
    const categoryCard = overview?.categories.find((card) => card.category === provider.category);
    const attention = ['Requires Attention', 'Sync Failed', 'Credentials Expired'].includes(categoryCard?.connectionStatus || '');
    const isHardware = hardwareCategories.includes(provider.category);
    const tabMatch = tab === 'ALL'
      || (tab === 'CONNECTED' && status === 'Connected')
      || (tab === 'ATTENTION' && attention)
      || (tab === 'HARDWARE' && isHardware)
      || (tab === 'CLOUD' && !isHardware)
      || (tab === 'COMING_SOON' && status === 'Future');
    const haystack = `${provider.name} ${categoryLabels[provider.category]} ${provider.providerType} ${provider.connectionMethods.join(' ')}`.toLowerCase();
    return tabMatch
      && (!search.trim() || haystack.includes(search.trim().toLowerCase()))
      && (categoryFilter === 'ALL' || provider.category === categoryFilter)
      && (statusFilter === 'ALL' || status === statusFilter)
      && (providerFilter === 'ALL' || provider.name === providerFilter)
      && (typeFilter === 'ALL' || provider.providerType === typeFilter)
      && (protocolFilter === 'ALL' || provider.connectionMethods.includes(protocolFilter))
      && (!connectedOnly || status === 'Connected');
  }), [categoryFilter, connectedOnly, hardwareCategories, overview?.categories, protocolFilter, providerFilter, providers, search, statusFilter, tab, typeFilter]);
  const groupedProviders = useMemo(() => providerGroupOrder
    .map((group) => ({ group, providers: visibleProviders.filter((provider) => groupForProvider(provider) === group) }))
    .filter((entry) => entry.providers.length), [visibleProviders]);
  const hasFilters = Boolean(search || categoryFilter !== 'ALL' || statusFilter !== 'ALL' || providerFilter !== 'ALL' || typeFilter !== 'ALL' || protocolFilter !== 'ALL' || connectedOnly);
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
  const clearProviderFilters = () => {
    setSearch('');
    setCategoryFilter('ALL');
    setStatusFilter('ALL');
    setProviderFilter('ALL');
    setTypeFilter('ALL');
    setProtocolFilter('ALL');
    setConnectedOnly(false);
    setTab('ALL');
  };
  const refreshOverview = async () => {
    const result = await overviewQuery.refetch();
    if (result.isError) toast.error(getApiError(result.error).message || 'Integration catalogue refresh failed');
    else toast.success('Integration catalogue refreshed');
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
      <div className="card border-rose-200 bg-rose-50 text-rose-700" role="alert">
        <p className="font-semibold">Integration Manager could not be loaded.</p>
        <button type="button" className="btn-outline mt-3" disabled={overviewQuery.isFetching} onClick={() => void refreshOverview()}>
          <RefreshCcw className={`h-4 w-4 ${overviewQuery.isFetching ? 'animate-spin' : ''}`} />
          {overviewQuery.isFetching ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none space-y-4 overflow-x-hidden pb-28">
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
            <button type="button" disabled={overviewQuery.isFetching} onClick={() => void refreshOverview()} className="btn-outline disabled:opacity-55"><RefreshCcw className={`h-4 w-4 ${overviewQuery.isFetching ? 'animate-spin' : ''}`} />{overviewQuery.isFetching ? 'Refreshing…' : 'Refresh'}</button>
            {canManage ? <button type="button" onClick={() => { setSelectedProvider(null); setSetupOpen(true); setSetupStep(1); }} className="btn-primary"><Plus className="h-4 w-4" />Add integration</button> : null}
          </div>
        </div>

        <div className="theme-kpi-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
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
        <div className="grid gap-2.5 border-b border-border p-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-[minmax(240px,1.35fr)_repeat(5,minmax(150px,1fr))_auto]">
          <label className="relative"><span className="sr-only">Search integrations</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-text-muted" /><input className="input h-10 pl-9" placeholder="Search integrations..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <select aria-label="Category filter" className="input h-10" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="ALL">All categories</option>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select aria-label="Status filter" className="input h-10" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option>{['Available', 'Connected', 'Future', 'Disabled'].map((value) => <option key={value}>{value}</option>)}</select>
          <select aria-label="Provider filter" className="input h-10" value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}><option value="ALL">All providers</option>{providerNames.map((value) => <option key={value}>{value}</option>)}</select>
          <select aria-label="Type filter" className="input h-10" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="ALL">All types</option>{Array.from(new Set(providers.map((provider) => provider.providerType))).sort().map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</select>
          <select aria-label="Protocol filter" className="input h-10" value={protocolFilter} onChange={(event) => setProtocolFilter(event.target.value)}><option value="ALL">All protocols</option>{protocols.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</select>
          <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-text-main"><input type="checkbox" checked={connectedOnly} onChange={(event) => setConnectedOnly(event.target.checked)} className="rounded border-border text-primary-600" />Connected only</label>
          <button type="button" className="btn-ghost h-10 whitespace-nowrap px-3" disabled={!hasFilters} onClick={clearProviderFilters}><FilterX className="h-4 w-4" />Clear filters</button>
        </div>
      </section>

      <section aria-label="Integration provider catalogue" className="w-full space-y-8">
        {groupedProviders.map(({ group, providers: groupProviders }) => <section key={group} className="w-full">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h3 className="text-base font-bold text-text-main">{group}</h3><p className="mt-1 text-xs text-text-muted">{groupProviders.length} provider{groupProviders.length === 1 ? '' : 's'} available in this workspace.</p></div></div>
          <ProviderRegistry
            providers={groupProviders}
            label={`${group} providers`}
            cards={overview?.categories || []}
            canManage={canManage}
            testingProviderId={providerTestMutation.isPending ? providerTestMutation.variables?.id || null : null}
            onConfigure={(provider) => { setSelectedProvider(provider); setActiveCategory(provider.category); setProviderTestResult(null); setSetupStep(3); setSetupOpen(true); }}
            onManage={(provider) => { const card = overview?.categories.find((item) => item.category === provider.category); if (card) { selectCard(card, 'dashboard'); setDetailOpen(true); recordAction('INTEGRATION_VIEWED', card); } }}
            onTest={(provider) => providerTestMutation.mutate(provider)}
            onViewDocs={setProviderInfo}
          />
        </section>)}
        {!groupedProviders.length ? <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center"><PlugZap className="mx-auto h-8 w-8 text-text-muted" /><p className="mt-3 font-semibold text-text-main">No integrations match the selected filters.</p><div className="mt-4 flex flex-wrap justify-center gap-2"><button type="button" className="btn-outline" onClick={clearProviderFilters}>Clear filters</button><button type="button" className="btn-outline" onClick={clearProviderFilters}>View all integrations</button>{canManage ? <button type="button" className="btn-primary" onClick={() => { setSelectedProvider(null); setSetupStep(1); setSetupOpen(true); }}>Add custom integration</button> : null}</div></div> : null}
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

      {activeView === 'dashboard' && !hasFilters ? (
        <div className="grid w-full gap-4 xl:grid-cols-2">
          {selectedCard ? <CategoryCard
            card={selectedCard}
            canManage={canManage}
            provider={providers.find((provider) => provider.category === selectedCard.category)}
            onPrimary={() => { const provider = providers.find((item) => item.category === selectedCard.category); if (selectedCard.connectionStatus === 'Connected') setDetailOpen(true); else if (provider && provider.status !== 'FUTURE' && canManage) { setSelectedProvider(provider); setSetupStep(3); setSetupOpen(true); } else setDetailOpen(true); }}
            onSecondary={() => { if (selectedCard.connectionStatus === 'Connected') setDetailOpen(true); else setProviderInfo(providers.find((provider) => provider.category === selectedCard.category) || null); }}
          /> : null}
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
          ) : activeCategory === 'REVIEW_PLATFORMS' ? (
            <div className="card">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3">
                  <ProviderIcon providerName="Google Business Profile" category="REVIEW_PLATFORMS" />
                  <div>
                    <h3 className="text-base font-semibold text-text-main">Google Business Profile reviews</h3>
                    <p className="mt-1 max-w-2xl text-sm text-text-muted">{reviewConnectorQuery.data?.google.setupMessage || 'Checking Google connector configuration...'}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className={`rounded-full border px-2.5 py-1 font-semibold ${statusClass(reviewConnectorQuery.data?.google.status || 'Not Connected')}`}>{labelize(reviewConnectorQuery.data?.google.status || 'NOT_CONNECTED')}</span>
                      {reviewConnectorQuery.data?.google.lastSyncAt ? <span className="rounded-full border border-border bg-bg px-2.5 py-1 text-text-muted">Last sync {formatDate(reviewConnectorQuery.data.google.lastSyncAt)}</span> : null}
                    </div>
                  </div>
                </div>
                {canManage ? <div className="flex shrink-0 flex-wrap gap-2">
                  {reviewConnectorQuery.data?.google.status === 'CONNECTED'
                    ? <button type="button" className="btn-primary" disabled={syncGoogleMutation.isPending} onClick={() => syncGoogleMutation.mutate()}><RefreshCcw className={`h-4 w-4 ${syncGoogleMutation.isPending ? 'animate-spin' : ''}`} />Sync reviews</button>
                    : <button type="button" className="btn-primary" disabled={!reviewConnectorQuery.data?.google.credentialsConfigured || connectGoogleMutation.isPending} onClick={() => connectGoogleMutation.mutate()}><Link2 className="h-4 w-4" />Connect Google</button>}
                </div> : null}
              </div>
              <div className="mt-4 rounded-xl border border-border bg-bg/40 p-4 text-xs text-text-muted">
                <p className="font-semibold text-text-main">OAuth redirect URI</p>
                <code className="mt-1 block break-all">{reviewConnectorQuery.data?.google.redirectUri || 'Loading...'}</code>
                <p className="mt-2">Register this exact HTTPS URI in Google Cloud. If the public URL changes, update GOOGLE_BUSINESS_REDIRECT_URI in Railway and the matching authorized redirect URI in Google Cloud.</p>
              </div>
            </div>
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

      {providerInfo ? (
        <div className="fixed inset-0 z-[70] flex justify-end bg-text-main/40" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProviderInfo(null); }}>
          <section role="dialog" aria-modal="true" aria-label={`${providerInfo.name} documentation`} className="flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5"><div className="flex items-center gap-3"><ProviderIcon providerName={providerInfo.name} category={providerInfo.category} /><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Provider requirements</p><h3 className="mt-1 text-xl font-bold text-text-main">{providerInfo.name}</h3><p className="mt-1 text-sm text-text-muted">{labelize(providerInfo.providerType)}</p></div></div><button type="button" className="btn-ghost h-9 w-9 p-0" onClick={() => setProviderInfo(null)} aria-label="Close provider documentation"><X className="h-4 w-4" /></button></div>
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div><h4 className="text-sm font-semibold text-text-main">Supported protocols and features</h4><div className="mt-2 flex flex-wrap gap-2">{providerInfo.connectionMethods.map((method) => <span key={method} className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs font-semibold text-text-muted">{labelize(method)}</span>)}</div></div>
              <div><h4 className="text-sm font-semibold text-text-main">Required connection fields</h4><div className="mt-2 space-y-2">{providerInfo.credentialFields.length ? providerInfo.credentialFields.map((field) => <div key={field.key} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg p-3 text-sm"><span className="font-medium text-text-main">{field.label}</span><span className="text-xs text-text-muted">{field.secret ? 'Secret · always masked' : field.required ? 'Required' : 'Optional'}</span></div>) : <p className="rounded-xl border border-border bg-bg p-3 text-sm text-text-muted">No credentials are required.</p>}</div></div>
              <div className="rounded-xl border border-primary-100 bg-primary-50 p-4 text-sm text-primary-800">{providerInfo.status === 'FUTURE' ? 'This connector is planned. Connection controls remain disabled until the provider adapter is released.' : 'Configuration and tests are available only to authorised administrators. Stored secrets are never returned to this page.'}</div>
            </div>
          </section>
        </div>
      ) : null}

      {setupOpen ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="integration-setup-title">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Step {setupStep} of 7</p><h3 id="integration-setup-title" className="mt-1 text-xl font-bold text-text-main">{selectedProvider ? `Configure ${selectedProvider.name}` : 'Add integration'}</h3><p className="mt-1 text-sm text-text-muted">Configure a provider without exposing stored credentials.</p></div><button type="button" className="btn-ghost h-9 w-9 p-0" onClick={() => setSetupOpen(false)} aria-label="Close setup wizard"><X className="h-4 w-4" /></button></div>
            <div className="grid grid-cols-7 gap-1 px-5 pt-5" aria-label="Setup progress">{Array.from({ length: 7 }, (_, index) => <span key={index} className={`h-1.5 rounded-full ${index + 1 <= setupStep ? 'bg-primary-600' : 'bg-border'}`} />)}</div>
            <div className="min-h-64 p-5">
              {setupStep === 1 ? <div><h4 className="font-semibold text-text-main">Select category</h4><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(categoryLabels).map(([value, label]) => <button key={value} type="button" onClick={() => setActiveCategory(value as IntegrationManagerCategory)} className={`rounded-xl border p-3 text-left text-sm font-medium ${activeCategory === value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-border text-text-main hover:bg-bg'}`}>{label}</button>)}</div></div> : null}
              {setupStep === 2 ? <div><h4 className="font-semibold text-text-main">Select provider</h4><div className="mt-3"><ProviderRegistry providers={providers} category={activeCategory} cards={overview?.categories || []} canManage={canManage} onConfigure={(provider) => { setSelectedProvider(provider); setActiveCategory(provider.category); setSetupStep(3); }} onManage={(provider) => { setSelectedProvider(provider); setSetupStep(3); }} onViewDocs={setProviderInfo} /></div></div> : null}
              {setupStep === 3 ? <div><h4 className="font-semibold text-text-main">Connection requirements{selectedProvider ? ` · ${selectedProvider.name}` : ''}</h4><div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Credential entry is unavailable in this build.</strong> Configure secrets in Railway or the approved secret manager. This page will not collect or discard credential values.</div><div className="mt-4 grid gap-3 sm:grid-cols-2">{(selectedProvider?.credentialFields || [{ key: 'endpoint', label: 'Endpoint or tenant', required: true }, { key: 'credential', label: 'Credential', secret: true, required: true }]).map((field) => <div key={field.key} className="rounded-xl border border-border bg-bg p-3"><span className="text-sm font-semibold text-text-main">{field.label}{field.required ? ' *' : ''}</span><span className="mt-1 block text-xs text-text-muted">{field.secret ? 'Secret · always masked' : field.required ? 'Required · configure server-side' : 'Optional'}</span></div>)}</div></div> : null}
              {setupStep === 4 ? <div className="text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-primary-600" /><h4 className="mt-3 font-semibold text-text-main">Test connection</h4><p className="mt-1 text-sm text-text-muted">The server will record the request and return an explicit unavailable result when no provider adapter is connected.</p><button type="button" disabled={providerTestMutation.isPending || actionMutation.isPending} className="btn-primary mt-4 disabled:opacity-55" onClick={() => selectedProvider ? providerTestMutation.mutate(selectedProvider) : actionMutation.mutate('integration.connection.tested')}>{providerTestMutation.isPending || actionMutation.isPending ? 'Testing…' : 'Run connection test'}</button>{providerTestResult ? <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-900">{providerTestResult}</p> : null}</div> : null}
              {setupStep === 5 ? <div><h4 className="font-semibold text-text-main">Discover services or devices</h4><p className="mt-2 text-sm text-text-muted">Discovery becomes available after a successful connection. Unsupported providers remain clearly marked as coming soon or environment configured.</p></div> : null}
              {setupStep === 6 ? <div><h4 className="font-semibold text-text-main">Map services</h4><p className="mt-2 text-sm text-text-muted">Map discovered devices or services to hotel floors, rooms, areas, and consuming modules.</p></div> : null}
              {setupStep === 7 ? <div><h4 className="font-semibold text-text-main">Configuration unavailable</h4><div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><p><strong>Category:</strong> {categoryLabels[activeCategory]}</p><p className="mt-2">Provider configuration cannot be saved from LaFlo until the secure credential service and provider adapter are connected. No configuration or credential has been changed.</p></div></div> : null}
            </div>
            <div className="flex items-center justify-between border-t border-border p-4"><button type="button" className="btn-outline" disabled={setupStep === 1} onClick={() => setSetupStep((step) => Math.max(1, step - 1))}>Back</button>{setupStep < 7 ? <button type="button" className="btn-primary" onClick={() => setSetupStep((step) => Math.min(7, step + 1))}>Continue</button> : <button type="button" className="btn-primary" onClick={() => setSetupOpen(false)}>Close</button>}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
