import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Activity,
  AlertTriangle,
  Cable,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  Layers,
  PlugZap,
  RefreshCcw,
  Router,
  Search,
  ShieldCheck,
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
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString() : 'Never';
const labelize = (value: string) => value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

function CategoryCard({ card, active, onClick }: { card: IntegrationCategoryCard; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left shadow-sm transition-colors ${
        active ? 'border-primary-300 bg-primary-50/60' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-950">{card.label}</div>
          <div className="mt-1 text-xs text-slate-500">{card.providerName}</div>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(card.connectionStatus)}`}>
          {card.connectionStatus}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <span className="block text-slate-500">Connected</span>
          <span className="mt-1 block font-semibold text-slate-900">{card.connectedCount}</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <span className="block text-slate-500">Errors</span>
          <span className={card.errorCount > 0 ? 'mt-1 block font-semibold text-rose-700' : 'mt-1 block font-semibold text-slate-900'}>{card.errorCount}</span>
        </div>
      </div>
      <div className="mt-3 text-xs text-slate-500">Last sync: {formatDate(card.lastSyncAt)}</div>
    </button>
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
            <div>
              <div className="text-sm font-bold text-slate-950">{provider.name}</div>
              <div className="mt-1 text-xs text-slate-500">{provider.connectionMethods.join(' / ')}</div>
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
  const [activeCategory, setActiveCategory] = useState<IntegrationManagerCategory>('CCTV');
  const [activeView, setActiveView] = useState<'dashboard' | 'setup' | 'logs' | 'devices'>('dashboard');

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

  const overview = overviewQuery.data;
  const selectedCard = overview?.categories.find((card) => card.category === activeCategory);
  const providers = overview?.registry || [];
  const logs = useMemo(() => (overview?.recentLogs || []).filter((log) => log.category === activeCategory), [activeCategory, overview?.recentLogs]);
  const devices = devicesQuery.data || [];
  const hardwareMode = activeCategory === 'CCTV' ? 'cctv' : 'smart-building';
  const supportsHardwareSetup = ['CCTV', 'SMART_LOCKS', 'SENSORS', 'HVAC', 'ENERGY_METERS', 'OTHER_PROVIDERS'].includes(activeCategory);

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
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <PlugZap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Integration Manager</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Central configuration for external systems, hardware, devices, credentials, provider health, and Platform Core integration events.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => overviewQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <Database className="h-5 w-5 text-slate-500" />
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Categories</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{overview?.categories.length || 0}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">Connected</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{overview?.categories.filter((card) => card.connectionStatus === 'Connected').length || 0}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-amber-700">Needs attention</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{overview?.categories.filter((card) => card.errorCount > 0).length || 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <Layers className="h-5 w-5 text-slate-500" />
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Providers</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{providers.length}</p>
          </div>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(overview?.categories || []).map((card) => (
          <CategoryCard
            key={card.category}
            card={card}
            active={activeCategory === card.category}
            onClick={() => {
              setActiveCategory(card.category);
              setActiveView('dashboard');
            }}
          />
        ))}
      </section>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Integration Manager views">
        {[
          ['dashboard', 'Category Dashboard', Activity],
          ['setup', 'Setup Flow', ClipboardList],
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
            <HardwareIntegrationPanel mode={hardwareMode} canManage surface="manager" />
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
              <button
                type="button"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <PlugZap className="h-4 w-4" />
                Publish import event
              </button>
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
    </div>
  );
}
