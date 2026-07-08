import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Camera, Eye, Pencil, Plus, PowerOff, Router, Save, TestTube2, Wifi } from 'lucide-react';
import { hardwareIntegrationService, getApiError } from '@/services';
import type {
  HardwareIntegration,
  HardwareIntegrationPayload,
  HardwareIntegrationType,
  HardwareProtocol,
  HardwareProvider,
} from '@/services/hardwareIntegrations';

type HardwareMode = 'cctv' | 'smart-building';

type HardwareIntegrationPanelProps = {
  mode: HardwareMode;
  canManage: boolean;
};

const cctvProviders: HardwareProvider[] = ['HIKVISION', 'DAHUA', 'AXIS', 'ONVIF', 'GENERIC_RTSP', 'GENERIC_HLS', 'GENERIC_MJPEG'];
const cctvProtocols: HardwareProtocol[] = ['RTSP', 'HLS', 'MJPEG', 'ONVIF'];
const smartProviders: HardwareProvider[] = ['MQTT', 'BACNET', 'MODBUS', 'REST_API', 'WEBHOOK', 'ONVIF', 'VENDOR_API', 'TTLOCK', 'SALTO', 'OTHER'];
const smartProtocols: HardwareProtocol[] = ['MQTT', 'BACNET', 'MODBUS', 'REST_API', 'WEBHOOK', 'ONVIF', 'VENDOR_API'];
const deviceTypes = [
  'DOOR_LOCK',
  'DOOR_SENSOR',
  'MOTION_SENSOR',
  'TEMPERATURE_SENSOR',
  'WATER_LEAK_SENSOR',
  'PANIC_BUTTON',
  'ENERGY_METER',
  'HVAC',
  'ELEVATOR',
  'ASSET',
  'OTHER',
];

const labelize = (value: string) => value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const statusClass = (status: string) => {
  if (status === 'CONNECTED' || status === 'HEALTHY') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'TEST_FAILED' || status === 'CRITICAL') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (status === 'DEGRADED' || status === 'WARNING') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

function IntegrationCard({
  item,
  canManage,
  onTest,
  onEdit,
  onDisable,
  onView,
  busy,
}: {
  item: HardwareIntegration;
  canManage: boolean;
  onTest: (id: string) => void;
  onEdit: (item: HardwareIntegration) => void;
  onDisable: (id: string) => void;
  onView: (id: string) => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-950">{item.name}</h3>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(item.status)}`}>
              {labelize(item.status)}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(item.healthStatus)}`}>
              {labelize(item.healthStatus)}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {[item.location, item.roomArea, item.floor != null ? `Floor ${item.floor}` : null].filter(Boolean).join(' / ') || 'Location not set'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">{labelize(item.provider)}</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">{labelize(item.protocol)}</span>
            {item.host ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">Endpoint configured</span> : null}
            {item.gatewayId ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">Gateway linked</span> : null}
            {item.hasSecret ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">Secret {item.secretMasked}</span> : null}
            {item.lastSeenAt ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">Last seen {new Date(item.lastSeenAt).toLocaleString()}</span> : null}
          </div>
          {item.lastTestResult?.message ? (
            <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {item.lastTestResult.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onTest(item.id)}
            disabled={!canManage || busy}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <TestTube2 className="h-4 w-4" />
            Test
          </button>
          <button
            type="button"
            onClick={() => onEdit(item)}
            disabled={!canManage || busy}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          {item.integrationType === 'CCTV_CAMERA' ? (
            <button
              type="button"
              onClick={() => onView(item.id)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Eye className="h-4 w-4" />
              View live feed
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onDisable(item.id)}
            disabled={!canManage || busy || !item.enabled}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            <PowerOff className="h-4 w-4" />
            Disable
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HardwareIntegrationPanel({ mode, canManage }: HardwareIntegrationPanelProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [integrationType, setIntegrationType] = useState<HardwareIntegrationType>(mode === 'cctv' ? 'CCTV_CAMERA' : 'SMART_DEVICE');
  const [deviceType, setDeviceType] = useState('DOOR_LOCK');
  const [form, setForm] = useState({
    name: '',
    location: '',
    floor: '',
    roomArea: '',
    provider: mode === 'cctv' ? 'ONVIF' : 'MQTT',
    protocol: mode === 'cctv' ? 'ONVIF' : 'MQTT',
    host: '',
    port: '',
    channelNumber: '',
    username: '',
    secret: '',
    streamPath: '',
    gatewayId: '',
    deviceIdentifier: '',
    topicPathChannel: '',
  });

  const types: HardwareIntegrationType[] = mode === 'cctv' ? ['CCTV_CAMERA', 'CCTV_NVR'] : ['SMART_DEVICE', 'SMART_GATEWAY'];
  const queryTypes = mode === 'cctv' ? ['CCTV_CAMERA', 'CCTV_NVR'] : ['SMART_DEVICE', 'SMART_GATEWAY'];
  const providers = mode === 'cctv' ? cctvProviders : smartProviders;
  const protocols = mode === 'cctv' ? cctvProtocols : smartProtocols;
  const title = mode === 'cctv' ? 'Hardware connections' : 'Device and gateway connections';
  const description = mode === 'cctv'
    ? 'Add cameras or NVRs without exposing RTSP URLs, passwords, or API keys to the browser.'
    : 'Add Smart Building devices or gateways for locks, sensors, HVAC, energy, and access hardware.';

  const query = useQuery({
    queryKey: ['hardware-integrations', mode],
    queryFn: async () => {
      const results = await Promise.all(queryTypes.map((type) => hardwareIntegrationService.list(type as HardwareIntegrationType)));
      return results.flat();
    },
    refetchInterval: 15_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['hardware-integrations'] });
  const createMutation = useMutation({
    mutationFn: (payload: HardwareIntegrationPayload) => hardwareIntegrationService.create(payload),
    onSuccess: async () => {
      toast.success('Hardware integration saved');
      setShowForm(false);
      resetForm();
      await invalidate();
    },
    onError: (error) => toast.error(getApiError(error).message),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: HardwareIntegrationPayload }) => hardwareIntegrationService.update(id, payload),
    onSuccess: async () => {
      toast.success('Hardware integration updated');
      setShowForm(false);
      resetForm();
      await invalidate();
    },
    onError: (error) => toast.error(getApiError(error).message),
  });
  const testMutation = useMutation({
    mutationFn: hardwareIntegrationService.test,
    onSuccess: async () => {
      toast.success('Connection test complete');
      await invalidate();
    },
    onError: (error) => toast.error(getApiError(error).message),
  });
  const disableMutation = useMutation({
    mutationFn: hardwareIntegrationService.disable,
    onSuccess: async () => {
      toast.success('Hardware integration disabled');
      await invalidate();
    },
    onError: (error) => toast.error(getApiError(error).message),
  });
  const viewMutation = useMutation({
    mutationFn: hardwareIntegrationService.view,
    onSuccess: (data) => toast(data.message),
    onError: (error) => toast.error(getApiError(error).message),
  });

  const integrations = useMemo(() => query.data || [], [query.data]);
  const gatewayIntegrations = useMemo(
    () => integrations.filter((item) => item.integrationType === 'SMART_GATEWAY'),
    [integrations]
  );
  const canSubmit = canManage && form.name.trim().length > 0;
  const resetForm = () => {
    setEditingId(null);
    setIntegrationType(mode === 'cctv' ? 'CCTV_CAMERA' : 'SMART_DEVICE');
    setDeviceType('DOOR_LOCK');
    setForm({
      name: '',
      location: '',
      floor: '',
      roomArea: '',
      provider: mode === 'cctv' ? 'ONVIF' : 'MQTT',
      protocol: mode === 'cctv' ? 'ONVIF' : 'MQTT',
      host: '',
      port: '',
      channelNumber: '',
      username: '',
      secret: '',
      streamPath: '',
      gatewayId: '',
      deviceIdentifier: '',
      topicPathChannel: '',
    });
  };

  const startEdit = (item: HardwareIntegration) => {
    setEditingId(item.id);
    setIntegrationType(item.integrationType);
    setDeviceType(String(item.metadata?.deviceType || 'DOOR_LOCK'));
    setForm({
      name: item.name || '',
      location: item.location || '',
      floor: item.floor != null ? String(item.floor) : '',
      roomArea: item.roomArea || '',
      provider: item.provider,
      protocol: item.protocol,
      host: item.host || '',
      port: item.port != null ? String(item.port) : '',
      channelNumber: item.channelNumber != null ? String(item.channelNumber) : '',
      username: item.username || '',
      secret: '',
      streamPath: item.streamPath || '',
      gatewayId: item.gatewayId || '',
      deviceIdentifier: item.deviceIdentifier || '',
      topicPathChannel: item.topicPathChannel || '',
    });
    setShowForm(true);
  };

  const buildPayload = (): HardwareIntegrationPayload => ({
    integrationType,
    name: form.name.trim(),
    location: form.location.trim() || undefined,
    floor: form.floor ? Number(form.floor) : undefined,
    roomArea: form.roomArea.trim() || undefined,
    provider: form.provider as HardwareProvider,
    protocol: form.protocol as HardwareProtocol,
    host: form.host.trim() || undefined,
    port: form.port ? Number(form.port) : undefined,
    channelNumber: form.channelNumber ? Number(form.channelNumber) : undefined,
    username: form.username.trim() || undefined,
    secret: form.secret || undefined,
    streamPath: form.streamPath.trim() || undefined,
    gatewayId: form.gatewayId.trim() || undefined,
    deviceIdentifier: form.deviceIdentifier.trim() || undefined,
    topicPathChannel: form.topicPathChannel.trim() || undefined,
    metadata: mode === 'smart-building' ? { deviceType } : undefined,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    const payload = buildPayload();
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
      return;
    }
    createMutation.mutate(payload);
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
            {mode === 'cctv' ? <Camera className="h-5 w-5" /> : <Wifi className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-950">{title}</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>
            {!canManage ? (
              <p className="mt-2 text-xs font-semibold text-amber-700">Read-only: Admin, Manager, Security, or Smart Building access is required to manage hardware.</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (showForm) {
              setShowForm(false);
              resetForm();
              return;
            }
            setShowForm(true);
          }}
          disabled={!canManage}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {showForm ? 'Cancel setup' : mode === 'cctv' ? 'Add Camera / NVR' : 'Add Device / Gateway'}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={submit} className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-medium text-slate-700">
              Type
              <select value={integrationType} onChange={(event) => setIntegrationType(event.target.value as HardwareIntegrationType)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {types.map((type) => <option key={type} value={type}>{labelize(type)}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Name
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={mode === 'cctv' ? 'Reception Camera' : 'Room 101 Smart Lock'} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Location
              <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Lobby, Basement, Floor 2" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Room / area
              <input value={form.roomArea} onChange={(event) => setForm({ ...form, roomArea: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Plant room" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Floor
              <input type="number" value={form.floor} onChange={(event) => setForm({ ...form, floor: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
            {mode === 'smart-building' ? (
              <label className="text-sm font-medium text-slate-700">
                Device type
                <select value={deviceType} onChange={(event) => setDeviceType(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  {deviceTypes.map((type) => <option key={type} value={type}>{labelize(type)}</option>)}
                </select>
              </label>
            ) : null}
            {mode === 'smart-building' && integrationType === 'SMART_DEVICE' ? (
              <label className="text-sm font-medium text-slate-700">
                Gateway
                {gatewayIntegrations.length > 0 ? (
                  <select
                    value={form.gatewayId}
                    onChange={(event) => setForm({ ...form, gatewayId: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">No gateway linked</option>
                    {gatewayIntegrations.map((gateway) => (
                      <option key={gateway.id} value={gateway.id}>
                        {gateway.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={form.gatewayId}
                    onChange={(event) => setForm({ ...form, gatewayId: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Gateway ID or register a gateway first"
                  />
                )}
              </label>
            ) : null}
            <label className="text-sm font-medium text-slate-700">
              Provider
              <select value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {providers.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Protocol
              <select value={form.protocol} onChange={(event) => setForm({ ...form, protocol: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {protocols.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Endpoint / host
              <input value={form.host} onChange={(event) => setForm({ ...form, host: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="192.168.1.20 or https://vendor.local" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Port
              <input type="number" value={form.port} onChange={(event) => setForm({ ...form, port: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Channel
              <input type="number" value={form.channelNumber} onChange={(event) => setForm({ ...form, channelNumber: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Username
              <input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" autoComplete="off" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Password / API key
              <input type="password" value={form.secret} onChange={(event) => setForm({ ...form, secret: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" autoComplete="new-password" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Stream path
              <input value={form.streamPath} onChange={(event) => setForm({ ...form, streamPath: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="/Streaming/Channels/101" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Device identifier
              <input value={form.deviceIdentifier} onChange={(event) => setForm({ ...form, deviceIdentifier: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="vendor-device-id" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Topic / path / channel
              <input value={form.topicPathChannel} onChange={(event) => setForm({ ...form, topicPathChannel: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="mqtt/topic or webhook path" />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Secrets are encrypted server-side and never returned to this page.</p>
            <button type="submit" disabled={!canSubmit || createMutation.isPending || updateMutation.isPending} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <Save className="h-4 w-4" />
              {editingId ? 'Save changes' : 'Save'}
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-5 space-y-3">
        {query.isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Loading hardware integrations...</div>
        ) : integrations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
            <Router className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 text-sm font-semibold text-slate-800">No hardware integrations configured.</p>
            <p className="mt-1 text-sm text-slate-500">Add hardware to start testing real devices and gateways.</p>
          </div>
        ) : (
          integrations.map((item) => (
            <IntegrationCard
              key={item.id}
              item={item}
              canManage={canManage}
              onTest={(id) => testMutation.mutate(id)}
              onEdit={startEdit}
              onDisable={(id) => disableMutation.mutate(id)}
              onView={(id) => viewMutation.mutate(id)}
              busy={testMutation.isPending || disableMutation.isPending || viewMutation.isPending}
            />
          ))
        )}
      </div>
    </section>
  );
}
