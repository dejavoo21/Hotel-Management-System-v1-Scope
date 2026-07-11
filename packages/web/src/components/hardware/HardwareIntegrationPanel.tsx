import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Camera, Cloud, Eye, Monitor, Pencil, Plus, PowerOff, Router, Save, Search, TestTube2, Video, Wifi } from 'lucide-react';
import { hardwareIntegrationService, getApiError } from '@/services';
import type {
  HardwareIntegration,
  HardwareIntegrationPayload,
  HardwareIntegrationType,
  HardwareProtocol,
  HardwareProvider,
  CctvDiscoveryResult,
  CctvNvrChannel,
  DiscoveredCctvCamera,
} from '@/services/hardwareIntegrations';

type HardwareMode = 'cctv' | 'smart-building';
type CctvMethod = 'USB_LOCAL' | 'DISCOVER_IP' | 'CONNECT_NVR' | 'MANUAL_CAMERA' | 'CLOUD_PROVIDER';

type HardwareIntegrationPanelProps = {
  mode: HardwareMode;
  canManage: boolean;
  surface?: 'manager' | 'module';
  selectedCategory?: string;
};

const cctvProviders: HardwareProvider[] = ['HIKVISION', 'DAHUA', 'AXIS', 'ONVIF', 'GENERIC_RTSP', 'GENERIC_HLS', 'GENERIC_MJPEG'];
const cctvProtocols: HardwareProtocol[] = ['RTSP', 'HLS', 'MJPEG', 'ONVIF'];
const nvrProviders: HardwareProvider[] = ['HIKVISION', 'DAHUA', 'AXIS', 'ONVIF'];
const nvrProtocols: HardwareProtocol[] = ['ONVIF', 'RTSP', 'REST_API'];
const cctvStreamKinds = ['HLS', 'MJPEG', 'SNAPSHOT', 'RTSP', 'ONVIF'] as const;
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

const discoveryStateClass = (state: string) => {
  if (state === 'DEVICES_FOUND') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (state === 'SCAN_FAILED') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (state === 'SCANNING' || state === 'AUTHENTICATION_REQUIRED') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

const fieldValue = (value: string) => value.trim() || undefined;

const cctvMethods: Array<{ id: CctvMethod; label: string; detail: string; icon: typeof Camera }> = [
  { id: 'USB_LOCAL', label: 'Local Camera / Staff Device Camera', detail: 'Browser webcam for calls, staff support, and preview testing.', icon: Video },
  { id: 'DISCOVER_IP', label: 'Discover IP Cameras', detail: 'Prepare ONVIF/IP discovery using a hotel subnet.', icon: Search },
  { id: 'CONNECT_NVR', label: 'Connect NVR', detail: 'Hikvision, Dahua, Axis, or Generic ONVIF recorders.', icon: Monitor },
  { id: 'MANUAL_CAMERA', label: 'Add Manual Camera', detail: 'HLS, MJPEG, Snapshot, RTSP, or ONVIF details.', icon: Camera },
  { id: 'CLOUD_PROVIDER', label: 'Cloud Provider', detail: 'Verkada, Eagle Eye, Rhombus, or other APIs.', icon: Cloud },
];

const cloudProviders = [
  { id: 'VERKADA', label: 'Verkada', detail: 'Cloud API / OAuth setup coming soon.' },
  { id: 'EAGLE_EYE', label: 'Eagle Eye', detail: 'Cloud VMS API setup coming soon.' },
  { id: 'RHOMBUS', label: 'Rhombus', detail: 'Cloud camera API setup coming soon.' },
  { id: 'OTHER', label: 'Other Cloud Provider', detail: 'Custom API provider adapter placeholder.' },
] as const;

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

export default function HardwareIntegrationPanel({ mode, canManage, surface = 'manager' }: HardwareIntegrationPanelProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cctvMethod, setCctvMethod] = useState<CctvMethod>('MANUAL_CAMERA');
  const [subnet, setSubnet] = useState('192.168.1.0/24');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [discoveryState, setDiscoveryState] = useState<'NOT_STARTED' | 'SCANNING' | 'DEVICES_FOUND' | 'NO_DEVICES_FOUND' | 'AUTHENTICATION_REQUIRED' | 'SCAN_FAILED'>('NOT_STARTED');
  const [discoveryResult, setDiscoveryResult] = useState<CctvDiscoveryResult | null>(null);
  const [selectedDiscoveredIds, setSelectedDiscoveredIds] = useState<string[]>([]);
  const [nvrChannels, setNvrChannels] = useState<CctvNvrChannel[]>([]);
  const [selectedChannelNumbers, setSelectedChannelNumbers] = useState<number[]>([]);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
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
    streamKind: 'ONVIF',
    cloudProvider: 'VERKADA',
    gatewayId: '',
    deviceIdentifier: '',
    topicPathChannel: '',
  });

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => () => {
    localStream?.getTracks().forEach((track) => track.stop());
  }, [localStream]);

  const types: HardwareIntegrationType[] = mode === 'cctv' ? ['CCTV_CAMERA', 'CCTV_NVR'] : ['SMART_DEVICE', 'SMART_GATEWAY'];
  const queryTypes = mode === 'cctv' ? ['CCTV_CAMERA', 'CCTV_NVR'] : ['SMART_DEVICE', 'SMART_GATEWAY'];
  const providers = mode === 'cctv' ? cctvProviders : smartProviders;
  const protocols = mode === 'cctv' ? cctvProtocols : smartProtocols;
  const title = mode === 'cctv' ? 'Hardware connections' : 'Device and gateway connections';
  const description = surface === 'module'
    ? mode === 'cctv'
      ? 'CCTV integrations are configured centrally in Settings / Integrations and consumed here by Security Center.'
      : 'Smart Building integrations are configured centrally in Settings / Integrations and consumed here by this dashboard.'
    : mode === 'cctv'
      ? 'Add cameras or NVRs without exposing RTSP URLs, passwords, or API keys to the browser.'
      : 'Add Smart Building devices or gateways for locks, sensors, HVAC, energy, and access hardware.';

  const query = useQuery({
    queryKey: ['hardware-integrations', mode],
    queryFn: async () => {
      if (mode === 'cctv') return hardwareIntegrationService.listCctv();
      const results = await Promise.all(queryTypes.map((type) => hardwareIntegrationService.list(type as HardwareIntegrationType)));
      return results.flat();
    },
    refetchInterval: 15_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['hardware-integrations'] });
  const createMutation = useMutation({
    mutationFn: (payload: HardwareIntegrationPayload) => mode === 'cctv'
      ? hardwareIntegrationService.createCctv(payload)
      : hardwareIntegrationService.create(payload),
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
    mutationFn: (id: string) => mode === 'cctv'
      ? hardwareIntegrationService.testCctvCamera(id)
      : hardwareIntegrationService.test(id),
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
    mutationFn: (id: string) => mode === 'cctv'
      ? hardwareIntegrationService.viewCctvPlayback(id)
      : hardwareIntegrationService.view(id),
    onSuccess: (data) => toast(data.message),
    onError: (error) => toast.error(getApiError(error).message),
  });
  const discoverMutation = useMutation({
    mutationFn: () => hardwareIntegrationService.discoverCctv({ subnet, provider: 'ONVIF' }),
    onMutate: () => {
      setDiscoveryState('SCANNING');
      setDiscoveryResult(null);
      setSelectedDiscoveredIds([]);
    },
    onSuccess: (data) => {
      setDiscoveryResult(data);
      setDiscoveryState(data.state);
      toast(data.message);
    },
    onError: (error) => {
      setDiscoveryState('SCAN_FAILED');
      toast.error(getApiError(error).message);
    },
  });
  const nvrTestMutation = useMutation({
    mutationFn: () => hardwareIntegrationService.testNvr({
      provider: form.provider as HardwareProvider,
      protocol: form.protocol as HardwareProtocol,
      host: form.host,
      port: form.port ? Number(form.port) : undefined,
      username: form.username || undefined,
      secret: form.secret || undefined,
      channelCount: form.channelNumber ? Number(form.channelNumber) : undefined,
    }),
    onSuccess: (data) => {
      setNvrChannels(data.channels || []);
      setSelectedChannelNumbers((data.channels || []).map((channel) => channel.channelNumber));
      toast(data.message);
    },
    onError: (error) => toast.error(getApiError(error).message),
  });
  const previewTestMutation = useMutation({
    mutationFn: () => hardwareIntegrationService.testCctvPreview({
      provider: form.provider as HardwareProvider,
      protocol: (form.streamKind === 'SNAPSHOT' ? 'REST_API' : form.streamKind) as HardwareProtocol,
      host: form.host,
      port: form.port ? Number(form.port) : undefined,
      username: form.username || undefined,
      secret: form.secret || undefined,
    }),
    onSuccess: (data) => {
      setPreviewMessage(data.message);
      toast(data.message);
    },
    onError: (error) => {
      const message = getApiError(error).message;
      setPreviewMessage(message);
      toast.error(message);
    },
  });
  const localCameraMutation = useMutation({
    mutationFn: async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not support local camera access.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      return stream;
    },
    onSuccess: (stream) => {
      localStream?.getTracks().forEach((track) => track.stop());
      setLocalStream(stream);
      toast.success('Local camera preview started. Use this for calls, not CCTV recording.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Local camera test failed'),
  });
  const importDiscoveredMutation = useMutation({
    mutationFn: async (cameras: DiscoveredCctvCamera[]) => {
      const saved = [];
      for (const camera of cameras) {
        saved.push(await hardwareIntegrationService.createCctv({
          integrationType: 'CCTV_CAMERA',
          name: `${camera.manufacturer} ${camera.model}`,
          location: 'Unmapped',
          provider: 'ONVIF',
          protocol: 'ONVIF',
          host: camera.ipAddress,
          deviceIdentifier: camera.id,
          streamPath: camera.streamReference || undefined,
          connectionMethod: 'MANUAL_CAMERA',
          streamKind: 'ONVIF',
          metadata: {
            importedFrom: 'discovery',
            discoverySubnet: discoveryResult?.subnet,
            manufacturer: camera.manufacturer,
            model: camera.model,
            macAddress: camera.macAddress,
            authenticationStatus: camera.authenticationStatus,
            onvifSupported: camera.onvifSupported,
            streamAvailable: camera.streamAvailable,
            mappingStatus: 'UNMAPPED',
          },
        }));
      }
      return saved;
    },
    onSuccess: async (saved) => {
      toast.success(`${saved.length} discovered camera${saved.length === 1 ? '' : 's'} imported for mapping`);
      setSelectedDiscoveredIds([]);
      await invalidate();
    },
    onError: (error) => toast.error(getApiError(error).message),
  });
  const importNvrChannelsMutation = useMutation({
    mutationFn: async (channels: CctvNvrChannel[]) => {
      const saved = [];
      for (const channel of channels) {
        saved.push(await hardwareIntegrationService.createCctv({
          integrationType: 'CCTV_CAMERA',
          name: `${fieldValue(form.name) || fieldValue(form.host) || 'NVR'} ${channel.channelName}`,
          location: fieldValue(form.location) || 'Unmapped',
          roomArea: fieldValue(form.roomArea),
          floor: form.floor ? Number(form.floor) : undefined,
          provider: form.provider as HardwareProvider,
          protocol: form.protocol as HardwareProtocol,
          host: fieldValue(form.host),
          port: form.port ? Number(form.port) : undefined,
          channelNumber: channel.channelNumber,
          username: fieldValue(form.username),
          secret: form.secret || undefined,
          streamPath: channel.streamReference,
          deviceIdentifier: `${form.host}:${channel.channelNumber}`,
          connectionMethod: 'CONNECT_NVR',
          streamKind: form.protocol === 'RTSP' ? 'RTSP' : 'ONVIF',
          metadata: {
            importedFrom: 'nvr-channel',
            nvrHost: form.host,
            channelName: channel.channelName,
            resolution: channel.resolution,
            fps: channel.fps,
            streamReference: channel.streamReference,
            mappingStatus: 'UNMAPPED',
          },
        }));
      }
      return saved;
    },
    onSuccess: async (saved) => {
      toast.success(`${saved.length} NVR channel${saved.length === 1 ? '' : 's'} imported as camera records`);
      setSelectedChannelNumbers([]);
      await invalidate();
    },
    onError: (error) => toast.error(getApiError(error).message),
  });

  const integrations = useMemo(() => query.data || [], [query.data]);
  const gatewayIntegrations = useMemo(
    () => integrations.filter((item) => item.integrationType === 'SMART_GATEWAY'),
    [integrations]
  );
  const discoveredCameras = discoveryResult?.discovered || [];
  const selectedDiscoveredCameras = discoveredCameras.filter((camera) => selectedDiscoveredIds.includes(camera.id));
  const selectedNvrChannels = nvrChannels.filter((channel) => selectedChannelNumbers.includes(channel.channelNumber));
  const canSubmit = canManage && form.name.trim().length > 0;
  const canConfigureHere = canManage && surface === 'manager';
  const resetForm = () => {
    setEditingId(null);
    setCctvMethod('MANUAL_CAMERA');
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
      streamKind: 'ONVIF',
      cloudProvider: 'VERKADA',
      gatewayId: '',
      deviceIdentifier: '',
      topicPathChannel: '',
    });
    setDiscoveryState('NOT_STARTED');
    setDiscoveryResult(null);
    setSelectedDiscoveredIds([]);
    setNvrChannels([]);
    setSelectedChannelNumbers([]);
    setPreviewMessage(null);
  };

  const startEdit = (item: HardwareIntegration) => {
    setEditingId(item.id);
    setCctvMethod(item.integrationType === 'CCTV_NVR' ? 'CONNECT_NVR' : 'MANUAL_CAMERA');
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
      streamKind: String(item.metadata?.streamKind || item.protocol || 'ONVIF'),
      cloudProvider: String(item.metadata?.cloudProvider || 'VERKADA'),
      gatewayId: item.gatewayId || '',
      deviceIdentifier: item.deviceIdentifier || '',
      topicPathChannel: item.topicPathChannel || '',
    });
    setShowForm(true);
  };

  const buildPayload = (): HardwareIntegrationPayload => {
    const streamKind = form.streamKind as HardwareIntegrationPayload['streamKind'];
    const mappedProtocol = mode === 'cctv' && streamKind === 'SNAPSHOT'
      ? 'REST_API'
      : (mode === 'cctv' && streamKind ? streamKind : form.protocol) as HardwareProtocol;
    return {
    integrationType,
    name: form.name.trim(),
    location: form.location.trim() || undefined,
    floor: form.floor ? Number(form.floor) : undefined,
    roomArea: form.roomArea.trim() || undefined,
    provider: form.provider as HardwareProvider,
    protocol: mappedProtocol,
    host: form.host.trim() || undefined,
    port: form.port ? Number(form.port) : undefined,
    channelNumber: form.channelNumber ? Number(form.channelNumber) : undefined,
    username: form.username.trim() || undefined,
    secret: form.secret || undefined,
    streamPath: form.streamPath.trim() || undefined,
    gatewayId: form.gatewayId.trim() || undefined,
    deviceIdentifier: form.deviceIdentifier.trim() || undefined,
    topicPathChannel: form.topicPathChannel.trim() || undefined,
    connectionMethod: mode === 'cctv' && cctvMethod !== 'USB_LOCAL' && cctvMethod !== 'DISCOVER_IP' ? cctvMethod : undefined,
    streamKind: mode === 'cctv' ? streamKind : undefined,
    cloudProvider: mode === 'cctv' && cctvMethod === 'CLOUD_PROVIDER' ? form.cloudProvider as HardwareIntegrationPayload['cloudProvider'] : undefined,
    metadata: mode === 'smart-building'
      ? { deviceType }
      : mode === 'cctv'
        ? { connectionMethod: cctvMethod, streamKind, cloudProvider: form.cloudProvider }
        : undefined,
  };
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || cctvMethod === 'USB_LOCAL' || cctvMethod === 'DISCOVER_IP' || cctvMethod === 'CLOUD_PROVIDER') return;
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
            {surface === 'module' ? (
              <p className="mt-2 text-xs font-semibold text-sky-700">Centralized setup: configure credentials, providers, and device imports in Settings / Integrations.</p>
            ) : !canManage ? (
              <p className="mt-2 text-xs font-semibold text-amber-700">Read-only: Admin, Manager, Security, or Smart Building access is required to manage hardware.</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (surface === 'module') {
              navigate('/settings?tab=integrations');
              return;
            }
            if (showForm) {
              setShowForm(false);
              resetForm();
              return;
            }
            setShowForm(true);
          }}
          disabled={!canManage && surface !== 'module'}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {surface === 'module'
            ? 'Open Integration Manager'
            : showForm
              ? 'Cancel setup'
              : mode === 'cctv'
                ? 'Add Camera / NVR'
                : 'Add Device / Gateway'}
        </button>
      </div>

      {showForm && surface === 'manager' ? (
        <form onSubmit={submit} className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          {mode === 'cctv' ? (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Connection method</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                {cctvMethods.map((method) => {
                  const Icon = method.icon;
                  const selected = cctvMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => {
                        setCctvMethod(method.id);
                        setDiscoveryState('NOT_STARTED');
                        setDiscoveryResult(null);
                        setSelectedDiscoveredIds([]);
                        setNvrChannels([]);
                        setSelectedChannelNumbers([]);
                        setPreviewMessage(null);
                        if (method.id === 'CONNECT_NVR') {
                          setIntegrationType('CCTV_NVR');
                          setForm((prev) => ({ ...prev, provider: 'ONVIF', protocol: 'ONVIF', streamKind: 'ONVIF' }));
                        } else if (method.id === 'MANUAL_CAMERA') {
                          setIntegrationType('CCTV_CAMERA');
                          setForm((prev) => ({ ...prev, provider: 'ONVIF', protocol: 'ONVIF', streamKind: 'ONVIF' }));
                        }
                      }}
                      className={`min-h-[96px] rounded-2xl border p-3 text-left transition ${
                        selected
                          ? 'border-slate-900 bg-white shadow-sm'
                          : 'border-slate-200 bg-white/70 hover:border-slate-300 hover:bg-white'
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${selected ? 'text-slate-950' : 'text-slate-500'}`} />
                      <span className="mt-2 block text-sm font-semibold text-slate-900">{method.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{method.detail}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {mode === 'cctv' && cctvMethod === 'USB_LOCAL' ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <h3 className="text-sm font-semibold text-sky-950">Local camera check</h3>
              <p className="mt-1 text-sm text-sky-800">
                USB and laptop cameras are for staff video calls and reception assistance. They are not saved as CCTV or NVR security cameras.
              </p>
              <button
                type="button"
                onClick={() => localCameraMutation.mutate()}
                disabled={!canConfigureHere || localCameraMutation.isPending}
                className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Video className="h-4 w-4" />
                Test browser camera
              </button>
              {localStream ? (
                <div className="mt-4 overflow-hidden rounded-2xl border border-sky-200 bg-slate-950">
                  <video ref={localVideoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" aria-label="Local camera preview" />
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-3 py-2 text-xs text-slate-600">
                    <span>Local preview only. This feed is not saved as CCTV.</span>
                    <button
                      type="button"
                      onClick={() => {
                        localStream.getTracks().forEach((track) => track.stop());
                        setLocalStream(null);
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Stop preview
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {mode === 'cctv' && cctvMethod === 'DISCOVER_IP' ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-semibold text-amber-950">Discover IP cameras</h3>
              <p className="mt-1 text-sm text-amber-800">
                Enter the hotel camera subnet. Until the ONVIF discovery worker is configured, this returns a clear placeholder instead of pretending to scan.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor="cctv-subnet">Subnet</label>
                <input
                  id="cctv-subnet"
                  value={subnet}
                  onChange={(event) => setSubnet(event.target.value)}
                  className="min-h-10 flex-1 rounded-xl border border-amber-200 px-3 py-2 text-sm"
                  placeholder="192.168.1.0/24"
                />
                <button
                  type="button"
                  onClick={() => discoverMutation.mutate()}
                  disabled={!canConfigureHere || discoverMutation.isPending}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Search className="h-4 w-4" />
                  Scan network
                </button>
              </div>
              <div className="mt-4 rounded-2xl border border-amber-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Discovery state</p>
                    <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${discoveryStateClass(discoveryState)}`}>
                      {labelize(discoveryState)}
                    </span>
                  </div>
                  {discoveryResult ? (
                    <p className="max-w-2xl text-sm text-slate-600">{discoveryResult.message}</p>
                  ) : (
                    <p className="max-w-2xl text-sm text-slate-600">No scan has run in this setup session.</p>
                  )}
                </div>
                {discoveredCameras.length > 0 ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Import</th>
                          <th className="px-3 py-2">Address</th>
                          <th className="px-3 py-2">Device</th>
                          <th className="px-3 py-2">ONVIF</th>
                          <th className="px-3 py-2">Stream</th>
                          <th className="px-3 py-2">Auth</th>
                          <th className="px-3 py-2">Mapping</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {discoveredCameras.map((camera) => (
                          <tr key={camera.id}>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={selectedDiscoveredIds.includes(camera.id)}
                                onChange={(event) =>
                                  setSelectedDiscoveredIds((prev) =>
                                    event.target.checked ? [...prev, camera.id] : prev.filter((id) => id !== camera.id)
                                  )
                                }
                                aria-label={`Select ${camera.manufacturer} ${camera.model}`}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-900">{camera.ipAddress}</div>
                              <div className="text-xs text-slate-500">{camera.macAddress || 'MAC unknown'}</div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-900">{camera.manufacturer}</div>
                              <div className="text-xs text-slate-500">{camera.model}</div>
                            </td>
                            <td className="px-3 py-2">{camera.onvifSupported ? 'Supported' : 'Unknown'}</td>
                            <td className="px-3 py-2">{camera.streamAvailable ? 'Available' : 'Gateway required'}</td>
                            <td className="px-3 py-2">{labelize(camera.authenticationStatus)}</td>
                            <td className="px-3 py-2">Unmapped</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">Imported cameras are saved as unmapped CCTV records. Assign location and credentials after import.</p>
                      <button
                        type="button"
                        onClick={() => importDiscoveredMutation.mutate(selectedDiscoveredCameras)}
                        disabled={!canConfigureHere || selectedDiscoveredCameras.length === 0 || importDiscoveredMutation.isPending}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        Import selected
                      </button>
                    </div>
                  </div>
                ) : discoveryResult ? (
                  <div className="mt-4 rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {discoveryResult.configured
                      ? 'No devices were discovered on this subnet.'
                      : 'Discovery service is not configured. Configure ONVIF discovery/media gateway before expecting real camera results.'}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {mode === 'cctv' && cctvMethod === 'CLOUD_PROVIDER' ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-950">Cloud CCTV provider</h3>
              <p className="mt-1 text-sm text-slate-600">
                Cloud connectors for Verkada, Eagle Eye, Rhombus, and other providers require vendor API credentials in the Integration Hub. Setup is intentionally disabled until a provider adapter is configured.
              </p>
              <label className="mt-3 block text-sm font-medium text-slate-700">
                Provider
                <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {cloudProviders.map((provider) => {
                    const selected = form.cloudProvider === provider.id;
                    return (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => setForm({ ...form, cloudProvider: provider.id })}
                        className={`rounded-2xl border p-3 text-left ${
                          selected ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <span className="block text-sm font-semibold text-slate-900">{provider.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">{provider.detail}</span>
                        <span className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          Coming soon
                        </span>
                      </button>
                    );
                  })}
                </div>
              </label>
            </div>
          ) : null}

          {mode !== 'cctv' || cctvMethod === 'CONNECT_NVR' || cctvMethod === 'MANUAL_CAMERA' ? (
          <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-medium text-slate-700">
              Type
              <select
                value={integrationType}
                onChange={(event) => setIntegrationType(event.target.value as HardwareIntegrationType)}
                disabled={mode === 'cctv'}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
              >
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
                {(mode === 'cctv' && cctvMethod === 'CONNECT_NVR' ? nvrProviders : providers).map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              {mode === 'cctv' && cctvMethod === 'MANUAL_CAMERA' ? 'Stream type' : 'Protocol'}
              <select
                value={mode === 'cctv' && cctvMethod === 'MANUAL_CAMERA' ? form.streamKind : form.protocol}
                onChange={(event) => {
                  if (mode === 'cctv' && cctvMethod === 'MANUAL_CAMERA') {
                    setForm({ ...form, streamKind: event.target.value, protocol: event.target.value === 'SNAPSHOT' ? 'REST_API' : event.target.value });
                    return;
                  }
                  setForm({ ...form, protocol: event.target.value, streamKind: event.target.value });
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {(mode === 'cctv' && cctvMethod === 'MANUAL_CAMERA'
                  ? cctvStreamKinds
                  : mode === 'cctv' && cctvMethod === 'CONNECT_NVR'
                    ? nvrProtocols
                    : protocols
                ).map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              {mode === 'cctv' && cctvMethod === 'MANUAL_CAMERA' ? 'Host / URL' : 'Endpoint / host'}
              <input value={form.host} onChange={(event) => setForm({ ...form, host: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="192.168.1.20 or https://vendor.local" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Port
              <input type="number" value={form.port} onChange={(event) => setForm({ ...form, port: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              {mode === 'cctv' && cctvMethod === 'CONNECT_NVR' ? 'Channel count' : 'Channel'}
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
            <p className="text-xs text-slate-500">
              Secrets are encrypted server-side. Raw RTSP URLs, passwords, and API keys are never returned to this page.
            </p>
            {mode === 'cctv' && cctvMethod === 'CONNECT_NVR' ? (
              <button
                type="button"
                onClick={() => nvrTestMutation.mutate()}
                disabled={!canConfigureHere || !form.host.trim() || nvrTestMutation.isPending}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                <TestTube2 className="h-4 w-4" />
                Test NVR
              </button>
            ) : null}
            {mode === 'cctv' && cctvMethod === 'MANUAL_CAMERA' ? (
              <button
                type="button"
                onClick={() => previewTestMutation.mutate()}
                disabled={!canConfigureHere || !form.host.trim() || previewTestMutation.isPending}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                <Eye className="h-4 w-4" />
                Test stream preview
              </button>
            ) : null}
            <button type="submit" disabled={!canSubmit || createMutation.isPending || updateMutation.isPending} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <Save className="h-4 w-4" />
              {editingId ? 'Save changes' : 'Save'}
            </button>
          </div>
          {mode === 'cctv' && cctvMethod === 'MANUAL_CAMERA' && previewMessage ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              {previewMessage}
            </div>
          ) : null}
          {mode === 'cctv' && cctvMethod === 'CONNECT_NVR' && nvrChannels.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">NVR channel import</h3>
                  <p className="mt-1 text-sm text-slate-600">Channel references are imported as unmapped CCTV camera records. Live stream metadata requires the secure media gateway.</p>
                </div>
                <button
                  type="button"
                  onClick={() => importNvrChannelsMutation.mutate(selectedNvrChannels)}
                  disabled={!canConfigureHere || selectedNvrChannels.length === 0 || importNvrChannelsMutation.isPending}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  Import selected
                </button>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Import</th>
                      <th className="px-3 py-2">Channel</th>
                      <th className="px-3 py-2">Reference</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Metadata</th>
                      <th className="px-3 py-2">Mapping</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {nvrChannels.map((channel) => (
                      <tr key={channel.channelNumber}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedChannelNumbers.includes(channel.channelNumber)}
                            onChange={(event) =>
                              setSelectedChannelNumbers((prev) =>
                                event.target.checked
                                  ? [...prev, channel.channelNumber]
                                  : prev.filter((value) => value !== channel.channelNumber)
                              )
                            }
                            aria-label={`Select ${channel.channelName}`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900">{channel.channelName}</div>
                          <div className="text-xs text-slate-500">Channel {channel.channelNumber}</div>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500">{channel.streamReference}</td>
                        <td className="px-3 py-2">{labelize(channel.status)}</td>
                        <td className="px-3 py-2">{channel.resolution || 'Gateway required'}{channel.fps ? ` / ${channel.fps}fps` : ''}</td>
                        <td className="px-3 py-2">Unmapped</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          </>
          ) : null}
        </form>
      ) : null}

      <div className="mt-5 space-y-3">
        {query.isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Loading hardware integrations...</div>
        ) : integrations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
            <Router className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 text-sm font-semibold text-slate-800">No hardware integrations configured.</p>
            <p className="mt-1 text-sm text-slate-500">
              {surface === 'module'
                ? 'Use Settings / Integrations to add and map devices before they appear here.'
                : 'Add hardware to start testing real devices and gateways.'}
            </p>
          </div>
        ) : (
          integrations.map((item) => (
            <IntegrationCard
              key={item.id}
              item={item}
              canManage={surface === 'manager' && canManage}
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
