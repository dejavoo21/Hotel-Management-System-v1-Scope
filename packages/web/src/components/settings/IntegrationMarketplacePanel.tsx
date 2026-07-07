import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Activity, Cable, PlugZap, RefreshCcw, RotateCw, Unplug, Zap } from 'lucide-react';
import { getApiError, integrationsService } from '@/services';
import type { IntegrationCategory, IntegrationHealth, IntegrationProvider, IntegrationStatus } from '@/services/integrations';

const categoryLabels: Record<IntegrationCategory, string> = {
  WEATHER: 'Weather',
  COMMUNICATIONS: 'Communications',
  PAYMENTS: 'Payments',
  OTA: 'OTA',
  PRODUCTIVITY: 'Productivity',
  SMART_LOCKS: 'Smart Locks',
  CCTV: 'CCTV',
  IOT: 'IoT',
  AI: 'AI',
};

const statusClass = (status: IntegrationStatus) => {
  if (status === 'CONFIGURED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'PARTIAL') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'FUTURE') return 'border-slate-200 bg-slate-50 text-slate-500';
  return 'border-rose-200 bg-rose-50 text-rose-700';
};

const healthClass = (health: IntegrationHealth) => {
  if (health === 'HEALTHY') return 'bg-emerald-500';
  if (health === 'DEGRADED') return 'bg-amber-500';
  if (health === 'FUTURE') return 'bg-slate-300';
  return 'bg-rose-500';
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Never';
}

function ProviderCard({
  provider,
  selected,
  onSelect,
}: {
  provider: IntegrationProvider;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left transition-colors ${
        selected ? 'border-primary-300 bg-primary-50/60' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${healthClass(provider.health)}`} />
            <p className="truncate text-sm font-semibold text-slate-900">{provider.name}</p>
          </div>
          <p className="mt-1 text-xs text-slate-500">{categoryLabels[provider.category]}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(provider.status)}`}>
          {provider.status.replace(/_/g, ' ')}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {provider.capabilities.slice(0, 3).map((capability) => (
          <span key={capability} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500">
            {capability}
          </span>
        ))}
      </div>
    </button>
  );
}

export default function IntegrationMarketplacePanel() {
  const queryClient = useQueryClient();
  const [selectedProviderId, setSelectedProviderId] = useState<string>('stripe');
  const [category, setCategory] = useState<IntegrationCategory | 'ALL'>('ALL');

  const marketplaceQuery = useQuery({
    queryKey: ['integrations', 'marketplace'],
    queryFn: integrationsService.list,
    staleTime: 30_000,
  });

  const logsQuery = useQuery({
    queryKey: ['integrations', selectedProviderId, 'logs'],
    queryFn: () => integrationsService.getLogs(selectedProviderId),
    enabled: Boolean(selectedProviderId),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ providerId, action }: { providerId: string; action: 'test' | 'reconnect' | 'disconnect' }) => {
      if (action === 'test') return integrationsService.testConnection(providerId);
      if (action === 'reconnect') return integrationsService.reconnect(providerId);
      return integrationsService.disconnect(providerId);
    },
    onSuccess: async (result) => {
      toast[result.success ? 'success' : 'error'](result.message);
      await queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
    onError: (error) => toast.error(getApiError(error).message),
  });

  const providers = marketplaceQuery.data?.providers || [];
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId) || providers[0];
  const filteredProviders = useMemo(
    () => providers.filter((provider) => category === 'ALL' || provider.category === category),
    [category, providers]
  );
  const categories = useMemo(
    () => ['ALL', ...Array.from(new Set(providers.map((provider) => provider.category)))] as Array<IntegrationCategory | 'ALL'>,
    [providers]
  );

  if (marketplaceQuery.isLoading) {
    return (
      <div className="card">
        <div className="h-5 w-48 animate-pulse rounded bg-slate-100" />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      </div>
    );
  }

  if (marketplaceQuery.isError) {
    return (
      <div className="card border-rose-200 bg-rose-50 text-rose-700">
        Failed to load integration marketplace.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <PlugZap className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Integration Marketplace</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Manage hotel connectors, health, configuration requirements, and lifecycle actions.
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => marketplaceQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Providers</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{marketplaceQuery.data?.readiness.total || 0}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Configured</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{marketplaceQuery.data?.readiness.configured || 0}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Partial</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{marketplaceQuery.data?.readiness.partial || 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Future-ready</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{marketplaceQuery.data?.readiness.future || 0}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  category === item ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item === 'ALL' ? 'All' : categoryLabels[item]}
              </button>
            ))}
          </div>
          {filteredProviders.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              selected={selectedProvider?.id === provider.id}
              onSelect={() => setSelectedProviderId(provider.id)}
            />
          ))}
        </div>

        {selectedProvider ? (
          <div className="space-y-6">
            <div className="card">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">{selectedProvider.name}</h3>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(selectedProvider.status)}`}>
                      {selectedProvider.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{selectedProvider.notes || 'Connector ready for configuration.'}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">Health</p>
                      <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <span className={`h-2.5 w-2.5 rounded-full ${healthClass(selectedProvider.health)}`} />
                        {selectedProvider.health.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">Last sync</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(selectedProvider.lastSyncAt)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">Version</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{selectedProvider.version}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => actionMutation.mutate({ providerId: selectedProvider.id, action: 'test' })}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Activity className="h-4 w-4" />
                    Test
                  </button>
                  <button
                    type="button"
                    onClick={() => actionMutation.mutate({ providerId: selectedProvider.id, action: 'reconnect' })}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <RotateCw className="h-4 w-4" />
                    Reconnect
                  </button>
                  <button
                    type="button"
                    onClick={() => actionMutation.mutate({ providerId: selectedProvider.id, action: 'disconnect' })}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    <Unplug className="h-4 w-4" />
                    Disconnect
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="text-base font-semibold text-slate-900">Configuration</h3>
              <p className="mt-1 text-sm text-slate-500">Secrets are configured through environment variables or the future connector setup flow.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {selectedProvider.configuration.length ? selectedProvider.configuration.map((field) => (
                  <div key={field.key} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{field.label}</p>
                      {field.required ? <span className="text-xs font-semibold text-rose-600">Required</span> : <span className="text-xs text-slate-400">Optional</span>}
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-500">{field.key}</p>
                    <p className="mt-1 text-xs text-slate-400">{field.secret ? 'Secret value hidden' : field.type}</p>
                  </div>
                )) : (
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    No configuration fields registered.
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-2">
                <Cable className="h-5 w-5 text-slate-500" />
                <h3 className="text-base font-semibold text-slate-900">Logs</h3>
              </div>
              <div className="mt-4 space-y-2">
                {logsQuery.data?.length ? logsQuery.data.map((log) => (
                  <div key={log.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        log.level === 'ERROR' ? 'bg-rose-100 text-rose-700' : log.level === 'WARN' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {log.level}
                      </span>
                      <span className="text-xs text-slate-400">{formatDate(log.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{log.message}</p>
                  </div>
                )) : (
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    No logs yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <Zap className="mt-0.5 h-5 w-5 text-slate-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Future extension strategy</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Each connector should ship as an adapter around the Integration SDK, normalize vendor payloads into Platform Core events, and keep secrets in Railway or a dedicated secret manager.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card text-sm text-slate-500">Select an integration provider.</div>
        )}
      </div>
    </div>
  );
}
