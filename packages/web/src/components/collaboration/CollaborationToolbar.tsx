import { useMemo, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Bot,
  Building2,
  Camera,
  CameraOff,
  ChevronDown,
  ClipboardList,
  DoorOpen,
  FileText,
  Home,
  Languages,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
  NotebookPen,
  ScreenShareOff,
  ShieldAlert,
  Sparkles,
  ThermometerSun,
  Users,
  Wrench,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { getUserPermissions, isSuperAdminUser, type PermissionId, type UserRole } from '@/utils/userAccess';

type ToolbarSection = 'communication' | 'hotel' | 'ai' | 'productivity';

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
};

export type CollaborationToolbarProps = {
  cameraOn?: boolean;
  microphoneOn?: boolean;
  screenSharing?: boolean;
  onToggleCamera?: () => void;
  onToggleMicrophone?: () => void;
  onToggleScreenShare?: () => void;
  onOpenParticipants?: () => void;
  onSummarizeConversation?: () => void;
  onTranslate?: () => void;
  className?: string;
  variant?: 'light' | 'dark';
};

const sectionLabels: Record<ToolbarSection, string> = {
  communication: 'Communication',
  hotel: 'Hotel operations',
  ai: 'AI',
  productivity: 'Productivity',
};

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
  cameraOn = false,
  microphoneOn = true,
  screenSharing = false,
  onToggleCamera,
  onToggleMicrophone,
  onToggleScreenShare,
  onOpenParticipants,
  onSummarizeConversation,
  onTranslate,
  className = '',
  variant = 'dark',
}: CollaborationToolbarProps) {
  const navigate = useNavigate();
  const canShow = useModuleAccess();
  const [showMore, setShowMore] = useState(false);

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
        permission: 'messages',
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
        permission: 'messages',
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
        permission: 'messages',
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
        permission: 'messages',
        onSelect: onOpenParticipants,
        disabled: !onOpenParticipants,
      },
      {
        id: 'guest-profile',
        label: 'Guest profile',
        section: 'hotel',
        icon: Users,
        permission: 'guests',
        route: '/guests',
      },
      {
        id: 'reservation',
        label: 'Reservation',
        section: 'hotel',
        icon: ClipboardList,
        permission: 'bookings',
        route: '/bookings',
      },
      {
        id: 'room-controls',
        label: 'Room controls',
        section: 'hotel',
        icon: Home,
        permission: 'rooms',
        route: '/rooms',
      },
      {
        id: 'housekeeping',
        label: 'Housekeeping',
        section: 'hotel',
        icon: Building2,
        permission: 'housekeeping',
        route: '/housekeeping',
      },
      {
        id: 'maintenance',
        label: 'Maintenance',
        section: 'hotel',
        icon: Wrench,
        permission: 'maintenance_center',
        route: '/maintenance-center',
      },
      {
        id: 'security-cameras',
        label: 'Security cameras',
        section: 'hotel',
        icon: Camera,
        permission: 'security_center',
        route: '/security-center/cctv',
      },
      {
        id: 'smart-doors',
        label: 'Smart doors',
        section: 'hotel',
        icon: DoorOpen,
        permission: 'smart_building',
        route: '/operations/smart-building/doors',
      },
      {
        id: 'sensors',
        label: 'Sensors',
        section: 'hotel',
        icon: ThermometerSun,
        permission: 'smart_building',
        route: '/operations/smart-building/sensors',
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
    ],
    [
      cameraOn,
      microphoneOn,
      navigate,
      onOpenParticipants,
      onSummarizeConversation,
      onToggleCamera,
      onToggleMicrophone,
      onToggleScreenShare,
      onTranslate,
      screenSharing,
    ]
  );

  const visibleActions = actions.filter(canShow);
  const primaryActions = visibleActions.filter((action) => action.section === 'communication');
  const secondarySections: ToolbarSection[] = ['hotel', 'ai', 'productivity'];
  const isDark = variant === 'dark';

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
