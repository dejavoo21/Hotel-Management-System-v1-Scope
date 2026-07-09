import { useMemo, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Bot,
  Building2,
  BarChart3,
  Camera,
  CameraOff,
  ChevronDown,
  ClipboardList,
  DoorClosed,
  DoorOpen,
  FileBarChart,
  FileText,
  Gauge,
  Hand,
  Home,
  Languages,
  LayoutDashboard,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
  NotebookPen,
  PhoneOff,
  PieChart,
  Receipt,
  SmilePlus,
  ScreenShareOff,
  ShieldAlert,
  Sparkles,
  ThermometerSun,
  UsersRound,
  WalletCards,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { getUserPermissions, isSuperAdminUser, type PermissionId, type UserRole } from '@/utils/userAccess';
import operationsService from '@/services/operations';
import securityCenterService from '@/services/securityCenter';
import smartBuildingService from '@/services/smartBuilding';
import incidentService from '@/services/incidents';

type ToolbarSection = 'communication' | 'hotel' | 'ai' | 'productivity';
type CollaborationWorkspace = 'support' | 'security' | 'maintenance' | 'incidents' | 'operations' | 'smart-building' | 'management';

type ToolbarAction = {
  id: string;
  label: string;
  shortLabel?: string;
  section: ToolbarSection;
  icon: ComponentType<{ className?: string }>;
  permission?: PermissionId;
  permissionsAny?: PermissionId[];
  route?: string;
  onSelect?: () => void;
  active?: boolean;
  disabled?: boolean;
  description?: string;
  workspaces?: CollaborationWorkspace[];
};

export type CollaborationToolbarProps = {
  workspace?: CollaborationWorkspace;
  cameraOn?: boolean;
  microphoneOn?: boolean;
  screenSharing?: boolean;
  onToggleCamera?: () => void;
  onToggleMicrophone?: () => void;
  onToggleScreenShare?: () => void;
  onOpenParticipants?: () => void;
  onSummarizeConversation?: () => void;
  onTranslate?: () => void;
  onEndSession?: () => void;
  className?: string;
  variant?: 'light' | 'dark';
  showStatusStrip?: boolean;
  extensionActions?: ToolbarAction[];
};

const sectionLabels: Record<ToolbarSection, string> = {
  communication: 'Communication',
  hotel: 'Hotel operations',
  ai: 'AI',
  productivity: 'Productivity',
};

const collaborationPermissions: PermissionId[] = [
  'messages',
  'bookings',
  'security_center',
  'maintenance_center',
  'smart_building',
  'incident_management',
  'dashboard',
];

function useModuleAccess() {
  const { user } = useAuthStore();
  const permissions = useMemo(
    () => getUserPermissions(user?.id, user?.role as UserRole | undefined, user?.modulePermissions as PermissionId[] | undefined),
    [user?.id, user?.role, user?.modulePermissions]
  );
  const isSuperAdmin = isSuperAdminUser(user?.id, user?.role as UserRole | undefined);

  return (action: Pick<ToolbarAction, 'permission' | 'permissionsAny'>) => {
    if (isSuperAdmin) return true;
    if (action.permissionsAny?.length) return action.permissionsAny.some((permission) => permissions.includes(permission));
    if (action.permission) return permissions.includes(action.permission);
    return true;
  };
}

export default function CollaborationToolbar({
  workspace = 'support',
  cameraOn = false,
  microphoneOn = true,
  screenSharing = false,
  onToggleCamera,
  onToggleMicrophone,
  onToggleScreenShare,
  onOpenParticipants,
  onSummarizeConversation,
  onTranslate,
  onEndSession,
  className = '',
  variant = 'dark',
  showStatusStrip = true,
  extensionActions = [],
}: CollaborationToolbarProps) {
  const navigate = useNavigate();
  const canShow = useModuleAccess();
  const { user } = useAuthStore();
  const [showMore, setShowMore] = useState(false);
  const userPermissions = useMemo(
    () => getUserPermissions(user?.id, user?.role as UserRole | undefined, user?.modulePermissions as PermissionId[] | undefined),
    [user?.id, user?.role, user?.modulePermissions]
  );
  const isSuperAdmin = isSuperAdminUser(user?.id, user?.role as UserRole | undefined);
  const canAccess = (permission: PermissionId) => isSuperAdmin || userPermissions.includes(permission);

  const operationsStatusQuery = useQuery({
    queryKey: ['collaboration-status', 'operations'],
    queryFn: () => operationsService.getOperationsContext(user?.hotelId || ''),
    enabled: showStatusStrip && Boolean(user) && canAccess('bookings'),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  const securityStatusQuery = useQuery({
    queryKey: ['collaboration-status', 'security'],
    queryFn: securityCenterService.getOverview,
    enabled: showStatusStrip && Boolean(user) && canAccess('security_center'),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  const smartBuildingStatusQuery = useQuery({
    queryKey: ['collaboration-status', 'smart-building'],
    queryFn: smartBuildingService.getOverview,
    enabled: showStatusStrip && Boolean(user) && canAccess('smart_building'),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  const incidentStatusQuery = useQuery({
    queryKey: ['collaboration-status', 'incidents'],
    queryFn: incidentService.overview,
    enabled: showStatusStrip && Boolean(user) && canAccess('incident_management'),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  const pendingAction = (label: string) => {
    toast(`${label} will connect when that workflow is enabled.`);
  };

  const actions = useMemo<ToolbarAction[]>(
    () => [
      {
        id: 'camera',
        label: cameraOn ? 'Turn camera off' : 'Turn camera on',
        shortLabel: cameraOn ? 'Camera on' : 'Camera off',
        section: 'communication',
        icon: cameraOn ? Camera : CameraOff,
        permissionsAny: collaborationPermissions,
        onSelect: onToggleCamera,
        active: cameraOn,
        disabled: !onToggleCamera,
      },
      {
        id: 'microphone',
        label: microphoneOn ? 'Mute microphone' : 'Unmute microphone',
        shortLabel: microphoneOn ? 'Mic on' : 'Muted',
        section: 'communication',
        icon: microphoneOn ? Mic : MicOff,
        permissionsAny: collaborationPermissions,
        onSelect: onToggleMicrophone,
        active: microphoneOn,
        disabled: !onToggleMicrophone,
      },
      {
        id: 'screen-share',
        label: screenSharing ? 'Stop screen share' : 'Share screen',
        shortLabel: screenSharing ? 'Sharing' : 'Share',
        section: 'communication',
        icon: screenSharing ? ScreenShareOff : MonitorUp,
        permissionsAny: collaborationPermissions,
        onSelect: onToggleScreenShare,
        active: screenSharing,
        disabled: !onToggleScreenShare,
      },
      {
        id: 'chat',
        label: 'Open chat',
        shortLabel: 'Chat',
        section: 'communication',
        icon: MessageSquare,
        permission: 'messages',
        route: '/messages',
      },
      {
        id: 'participants',
        label: 'Participants',
        shortLabel: 'People',
        section: 'communication',
        icon: Users,
        permissionsAny: collaborationPermissions,
        onSelect: onOpenParticipants,
        disabled: !onOpenParticipants,
      },
      {
        id: 'raise-hand',
        label: 'Raise hand',
        shortLabel: 'Raise',
        section: 'communication',
        icon: Hand,
        permissionsAny: collaborationPermissions,
        onSelect: () => pendingAction('Raise hand'),
      },
      {
        id: 'reactions',
        label: 'Reactions',
        shortLabel: 'React',
        section: 'communication',
        icon: SmilePlus,
        permissionsAny: collaborationPermissions,
        onSelect: () => pendingAction('Reactions'),
      },
      {
        id: 'view',
        label: 'View options',
        shortLabel: 'View',
        section: 'communication',
        icon: LayoutDashboard,
        permissionsAny: collaborationPermissions,
        onSelect: () => pendingAction('View options'),
      },
      {
        id: 'session-controls',
        label: 'Session controls',
        shortLabel: 'Session',
        section: 'communication',
        icon: Gauge,
        permissionsAny: collaborationPermissions,
        onSelect: () => pendingAction('Session controls'),
      },
      {
        id: 'end-session',
        label: 'End session',
        shortLabel: 'End',
        section: 'communication',
        icon: PhoneOff,
        permissionsAny: collaborationPermissions,
        onSelect: onEndSession || (() => pendingAction('End session')),
      },
      {
        id: 'guest-profile',
        label: 'Guest',
        section: 'hotel',
        icon: Users,
        permission: 'guests',
        route: '/guests',
        workspaces: ['support'],
      },
      {
        id: 'reservation',
        label: 'Reservation',
        section: 'hotel',
        icon: ClipboardList,
        permission: 'bookings',
        route: '/bookings',
        workspaces: ['support'],
      },
      {
        id: 'payment',
        label: 'Payment',
        section: 'hotel',
        icon: WalletCards,
        permission: 'financials',
        route: '/reports',
        workspaces: ['support'],
      },
      {
        id: 'room-controls',
        label: 'Room controls',
        section: 'hotel',
        icon: Home,
        permission: 'rooms',
        route: '/rooms',
        workspaces: ['support'],
      },
      {
        id: 'housekeeping',
        label: 'Housekeeping',
        section: 'hotel',
        icon: Building2,
        permission: 'housekeeping',
        route: '/housekeeping',
        workspaces: ['support'],
      },
      {
        id: 'maintenance',
        label: 'Maintenance',
        section: 'hotel',
        icon: Wrench,
        permission: 'maintenance_center',
        route: '/maintenance-center',
        workspaces: ['support', 'maintenance'],
      },
      {
        id: 'cctv',
        label: 'CCTV',
        section: 'hotel',
        icon: Camera,
        permission: 'security_center',
        route: '/security-center/cctv',
        workspaces: ['security'],
      },
      {
        id: 'smart-doors-security',
        label: 'Smart Doors',
        section: 'hotel',
        icon: DoorOpen,
        permission: 'security_center',
        route: '/operations/smart-building/doors',
        workspaces: ['security'],
      },
      {
        id: 'access-logs',
        label: 'Access Logs',
        section: 'hotel',
        icon: Receipt,
        permission: 'security_center',
        route: '/security-center/access-logs',
        workspaces: ['security'],
      },
      {
        id: 'visitors',
        label: 'Visitors',
        section: 'hotel',
        icon: UsersRound,
        permission: 'security_center',
        route: '/security-center/visitors',
        workspaces: ['security'],
      },
      {
        id: 'security-incidents',
        label: 'Incidents',
        section: 'hotel',
        icon: ShieldAlert,
        permission: 'incident_management',
        route: '/incidents',
        workspaces: ['security', 'incidents'],
      },
      {
        id: 'smart-doors',
        label: 'Smart Doors',
        section: 'hotel',
        icon: DoorClosed,
        permission: 'smart_building',
        route: '/operations/smart-building/doors',
        workspaces: ['smart-building'],
      },
      {
        id: 'sensors',
        label: 'Sensors',
        section: 'hotel',
        icon: ThermometerSun,
        permission: 'smart_building',
        route: '/operations/smart-building/sensors',
        workspaces: ['smart-building'],
      },
      {
        id: 'energy',
        label: 'Energy',
        section: 'hotel',
        icon: Zap,
        permission: 'smart_building',
        route: '/operations/smart-building/energy',
        workspaces: ['smart-building'],
      },
      {
        id: 'hvac',
        label: 'HVAC',
        section: 'hotel',
        icon: ThermometerSun,
        permission: 'smart_building',
        route: '/operations/smart-building/hvac',
        workspaces: ['smart-building'],
      },
      {
        id: 'assets',
        label: 'Assets',
        section: 'hotel',
        icon: Building2,
        permission: 'smart_building',
        route: '/operations/smart-building/assets',
        workspaces: ['smart-building'],
      },
      {
        id: 'work-orders',
        label: 'Work Orders',
        section: 'hotel',
        icon: ClipboardList,
        permission: 'maintenance_center',
        route: '/maintenance-center/work-orders',
        workspaces: ['maintenance'],
      },
      {
        id: 'faults',
        label: 'Faults',
        section: 'hotel',
        icon: ShieldAlert,
        permission: 'maintenance_center',
        route: '/maintenance-center/faults',
        workspaces: ['maintenance'],
      },
      {
        id: 'repairs',
        label: 'Repairs',
        section: 'hotel',
        icon: Wrench,
        permission: 'maintenance_center',
        route: '/maintenance-center/repairs',
        workspaces: ['maintenance'],
      },
      {
        id: 'asset-history',
        label: 'Asset History',
        section: 'hotel',
        icon: FileText,
        permission: 'maintenance_center',
        route: '/maintenance-center/assets',
        workspaces: ['maintenance'],
      },
      {
        id: 'ai-concierge',
        label: 'AI Concierge',
        section: 'hotel',
        icon: Bot,
        permission: 'bookings',
        route: '/operations-center/ai',
        workspaces: ['operations'],
      },
      {
        id: 'revenue',
        label: 'Revenue',
        section: 'hotel',
        icon: BarChart3,
        permission: 'financials',
        route: '/operations-center/revenue',
        workspaces: ['operations', 'management'],
      },
      {
        id: 'weather',
        label: 'Weather',
        section: 'hotel',
        icon: ThermometerSun,
        permission: 'bookings',
        route: '/operations-center/weather',
        workspaces: ['operations'],
      },
      {
        id: 'tasks',
        label: 'Tasks',
        section: 'hotel',
        icon: ClipboardList,
        permission: 'bookings',
        route: '/operations-center/tasks',
        workspaces: ['operations'],
      },
      {
        id: 'market-intelligence',
        label: 'Market Intelligence',
        section: 'hotel',
        icon: PieChart,
        permission: 'bookings',
        route: '/operations-center/market-intelligence',
        workspaces: ['operations'],
      },
      {
        id: 'executive-dashboard',
        label: 'Executive Dashboard',
        section: 'hotel',
        icon: LayoutDashboard,
        permission: 'dashboard',
        route: '/enterprise-command-center',
        workspaces: ['operations', 'incidents'],
      },
      {
        id: 'kpis',
        label: 'KPIs',
        section: 'hotel',
        icon: Gauge,
        permission: 'dashboard',
        route: '/',
        workspaces: ['operations', 'incidents'],
      },
      {
        id: 'reports',
        label: 'Reports',
        section: 'hotel',
        icon: FileBarChart,
        permission: 'financials',
        route: '/reports',
        workspaces: ['operations', 'incidents'],
      },
      {
        id: 'summarize',
        label: 'Summarize conversation',
        section: 'ai',
        icon: Sparkles,
        permissionsAny: ['bookings', 'messages'],
        onSelect: onSummarizeConversation || (() => navigate('/operations-center/ai')),
      },
      {
        id: 'create-task',
        label: 'Create task',
        section: 'ai',
        icon: ClipboardList,
        permissionsAny: ['bookings', 'maintenance_center', 'housekeeping'],
        route: '/operations-center/tasks',
      },
      {
        id: 'generate-incident',
        label: 'Generate incident',
        section: 'ai',
        icon: ShieldAlert,
        permission: 'incident_management',
        route: '/incidents',
      },
      {
        id: 'translate',
        label: 'Translate',
        section: 'ai',
        icon: Languages,
        permissionsAny: ['messages', 'concierge'],
        onSelect: onTranslate || (() => pendingAction('Translation')),
      },
      {
        id: 'action-items',
        label: 'Action items',
        section: 'ai',
        icon: Bot,
        permissionsAny: ['bookings', 'messages'],
        route: '/operations-center/ai',
      },
      {
        id: 'notes',
        label: 'Notes',
        section: 'productivity',
        icon: NotebookPen,
        permissionsAny: ['messages', 'bookings', 'guests'],
        onSelect: () => pendingAction('Notes'),
      },
      {
        id: 'files',
        label: 'Files',
        section: 'productivity',
        icon: FileText,
        permissionsAny: ['messages', 'guests'],
        onSelect: () => pendingAction('Files'),
      },
      {
        id: 'more',
        label: 'More actions',
        section: 'productivity',
        icon: MoreHorizontal,
        onSelect: () => pendingAction('More actions'),
      },
      ...extensionActions,
    ],
    [
      cameraOn,
      extensionActions,
      microphoneOn,
      navigate,
      onOpenParticipants,
      onEndSession,
      onSummarizeConversation,
      onToggleCamera,
      onToggleMicrophone,
      onToggleScreenShare,
      onTranslate,
      screenSharing,
    ]
  );

  const visibleActions = actions.filter((action) => canShow(action) && (!action.workspaces || action.workspaces.includes(workspace)));
  const primaryActions = visibleActions.filter((action) => action.section === 'communication').slice(0, 10);
  const secondarySections: ToolbarSection[] = ['hotel', 'ai', 'productivity'];
  const isDark = variant === 'dark';
  const occupancy = operationsStatusQuery.data?.ops?.inhouseNow ?? null;
  const criticalAlerts =
    (incidentStatusQuery.data?.critical || 0) +
    (securityStatusQuery.data?.alerts.open || 0) +
    (smartBuildingStatusQuery.data?.health.activeAlerts || 0);
  const camerasOnline = securityStatusQuery.data?.cctv.online ?? smartBuildingStatusQuery.data?.cameras.online ?? null;
  const doorsConnected = smartBuildingStatusQuery.data?.doors.locked ?? null;
  const sensorsHealthy =
    smartBuildingStatusQuery.data
      ? smartBuildingStatusQuery.data.temperatureSensors.warning +
          smartBuildingStatusQuery.data.waterLeakSensors.alerts +
          smartBuildingStatusQuery.data.motionAlerts.active ===
        0
      : null;
  const aiMonitoring = operationsStatusQuery.data ? 'Active' : canAccess('bookings') ? 'Waiting' : 'Restricted';

  const statusItems = [
    { label: 'Occupancy', value: occupancy == null ? 'No data' : `${occupancy} in-house`, tone: 'slate' },
    { label: 'Critical Alerts', value: String(criticalAlerts), tone: criticalAlerts > 0 ? 'rose' : 'emerald' },
    { label: 'Cameras Online', value: camerasOnline == null ? 'No data' : String(camerasOnline), tone: camerasOnline == null ? 'slate' : 'emerald' },
    { label: 'Doors Connected', value: doorsConnected == null ? 'No data' : String(doorsConnected), tone: doorsConnected == null ? 'slate' : 'sky' },
    { label: 'Sensors Healthy', value: sensorsHealthy == null ? 'No data' : sensorsHealthy ? 'Healthy' : 'Needs attention', tone: sensorsHealthy === false ? 'amber' : 'emerald' },
    { label: 'AI Monitoring', value: aiMonitoring, tone: aiMonitoring === 'Active' ? 'emerald' : 'slate' },
  ];

  const runAction = (action: ToolbarAction) => {
    if (action.disabled) return;
    if (action.route) {
      navigate(action.route);
      return;
    }
    action.onSelect?.();
  };

  const buttonClass = (action: ToolbarAction) => {
    const activeClass = isDark
      ? 'border-sky-300/50 bg-sky-400/20 text-white'
      : 'border-primary-200 bg-primary-50 text-primary-700';
    const idleClass = isDark
      ? 'border-white/10 bg-white/10 text-white hover:bg-white/15'
      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50';
    return [
      'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold',
      'focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2',
      isDark ? 'focus:ring-offset-slate-950' : 'focus:ring-offset-white',
      action.active ? activeClass : idleClass,
      action.disabled ? 'cursor-not-allowed opacity-45' : '',
    ].join(' ');
  };

  const renderAction = (action: ToolbarAction, compact = false) => {
    const Icon = action.icon;
    return (
      <button
        key={action.id}
        type="button"
        onClick={() => runAction(action)}
        disabled={action.disabled}
        aria-label={action.label}
        aria-pressed={typeof action.active === 'boolean' ? action.active : undefined}
        title={action.description || action.label}
        className={`${buttonClass(action)} ${compact ? 'w-full justify-start' : ''}`}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className={compact ? 'truncate' : 'hidden whitespace-nowrap md:inline'}>
          {action.shortLabel || action.label}
        </span>
      </button>
    );
  };

  return (
    <div
      className={[
        'relative rounded-3xl border p-3 shadow-lg backdrop-blur',
        isDark ? 'border-white/10 bg-slate-950/75 text-white' : 'border-slate-200 bg-white/95 text-slate-900',
        className,
      ].join(' ')}
      aria-label="Collaboration toolbar"
    >
      {showStatusStrip ? (
        <div
          className={`mb-3 grid gap-2 rounded-2xl border p-2 text-xs sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 ${
            isDark ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-50'
          }`}
          aria-label="Hotel status"
        >
          {statusItems.map((item) => (
            <div key={item.label} className={`rounded-xl px-3 py-2 ${isDark ? 'bg-white/10' : 'bg-white'}`}>
              <div className={isDark ? 'text-white/55' : 'text-slate-500'}>{item.label}</div>
              <div
                className={[
                  'mt-1 font-semibold',
                  item.tone === 'rose' ? 'text-rose-500' : '',
                  item.tone === 'amber' ? 'text-amber-600' : '',
                  item.tone === 'emerald' ? 'text-emerald-600' : '',
                  item.tone === 'sky' ? 'text-sky-600' : '',
                  item.tone === 'slate' ? (isDark ? 'text-white' : 'text-slate-900') : '',
                ].join(' ')}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="flex flex-wrap items-center gap-2" aria-label={sectionLabels.communication}>
          {primaryActions.map((action) => renderAction(action))}
        </div>

        <div className={`hidden h-8 w-px xl:block ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} role="presentation" />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:flex xl:min-w-0 xl:flex-1">
          {secondarySections.map((section) => {
            const sectionActions = visibleActions.filter((action) => action.section === section);
            if (!sectionActions.length) return null;
            return (
              <div key={section} className="min-w-0">
                <div className={`mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide ${isDark ? 'text-white/55' : 'text-slate-500'}`}>
                  {sectionLabels[section]}
                </div>
                <div className="flex flex-wrap gap-2">
                  {sectionActions.slice(0, section === 'hotel' ? 8 : 5).map((action) => renderAction(action))}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowMore((prev) => !prev)}
          className={[
            'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 xl:hidden',
            isDark
              ? 'border-white/10 bg-white/10 text-white focus:ring-offset-slate-950'
              : 'border-slate-200 bg-white text-slate-700 focus:ring-offset-white',
          ].join(' ')}
          aria-expanded={showMore}
          aria-controls="collaboration-toolbar-more"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          More
          <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </div>

      {showMore ? (
        <div
          id="collaboration-toolbar-more"
          className={`mt-3 grid gap-2 rounded-2xl border p-3 md:grid-cols-2 lg:grid-cols-3 xl:hidden ${
            isDark ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-50'
          }`}
        >
          {visibleActions.map((action) => renderAction(action, true))}
        </div>
      ) : null}

      <div className="sr-only" aria-live="polite">
        Collaboration tools are filtered by your current permissions.
      </div>
    </div>
  );
}
