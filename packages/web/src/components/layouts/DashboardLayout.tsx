import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { usePresenceStore } from '@/stores/presenceStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accessRequestService, messageService, notificationService } from '@/services';
import { getNotificationIcon, getNotificationColor, formatNotificationTime } from '@/services/notifications';
import { getUserPermissions, isSuperAdminUser, type PermissionId, type UserRole } from '@/utils/userAccess';
import toast from 'react-hot-toast';
import { useUiStore } from '@/stores/uiStore';
import {
  loadAccessRequestAckMap,
  isAccessRequestAcked,
  onAccessRequestAckChanged,
  ackAccessRequest,
} from '@/utils/accessRequestAck';
import AppChatbot from '@/components/support/AppChatbot';
import { PresenceDot, PresenceMenu } from '@/components/presence';
import { useSocketPresence } from '@/hooks/useSocketPresence';

type NavigationItem = {
  name: string;
  href: string;
  permission: PermissionId;
  icon: JSX.Element;
  badge?: number;
};

type NavigationGroupItem = NavigationItem & {
  roles?: UserRole[];
};

type GlobalSearchTarget = {
  id: string;
  name: string;
  href: string;
  section: string;
  permission?: PermissionId;
  roles?: UserRole[];
  keywords?: string[];
};

const normalizeSearch = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const scoreTarget = (query: string, target: GlobalSearchTarget) => {
  const q = normalizeSearch(query);
  if (!q) return -1;

  const name = normalizeSearch(target.name);
  const href = normalizeSearch(target.href);
  const section = normalizeSearch(target.section);
  const keywords = (target.keywords || []).map(normalizeSearch).join(' ');
  const haystack = `${name} ${href} ${section} ${keywords}`;

  const tokens = q.split(' ').filter(Boolean);
  if (!tokens.every((t) => haystack.includes(t))) return -1;

  // Prefer clearer matches first.
  if (name === q) return 100;
  if (href === q) return 98;
  if (name.startsWith(q)) return 90;
  if ((target.keywords || []).some((k) => normalizeSearch(k).startsWith(q))) return 85;
  if (name.includes(q)) return 75;
  if (keywords.includes(q)) return 70;
  if (section.includes(q)) return 60;
  if (href.includes(q)) return 55;
  return 50;
};

const navigation: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    permission: 'dashboard',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    ),
  },
  {
    name: 'Reservation',
    href: '/bookings',
    permission: 'bookings',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: 'Rooms',
    href: '/rooms',
    permission: 'rooms',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    name: 'Messages',
    href: '/messages',
    permission: 'messages',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    name: 'Calls',
    href: '/calls',
    permission: 'messages',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h2.153a2 2 0 011.96 1.608l.415 2.076a2 2 0 01-.502 1.821l-1.16 1.16a16 16 0 006.364 6.364l1.16-1.16a2 2 0 011.821-.502l2.076.415A2 2 0 0121 16.847V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
  },
  {
    name: 'Housekeeping',
    href: '/housekeeping',
    permission: 'housekeeping',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  },
  {
    name: 'Inventory',
    href: '/inventory',
    permission: 'inventory',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    name: 'Calendar',
    href: '/calendar',
    permission: 'calendar',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: 'Guests',
    href: '/guests',
    permission: 'guests',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const bottomNavigation: NavigationGroupItem[] = [
  {
    name: 'Financials',
    href: '/reports',
    permission: 'financials',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    name: 'Reviews',
    href: '/reviews',
    permission: 'reviews',
    roles: ['ADMIN', 'MANAGER'],
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
  {
    name: 'Concierge',
    href: '/concierge',
    permission: 'concierge',
    roles: ['ADMIN', 'MANAGER'],
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
];

const adminNavigation: NavigationItem[] = [
  {
    name: 'Users',
    href: '/users',
    permission: 'users',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    name: 'Settings',
    href: '/settings',
    permission: 'settings',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showFinancialFlyout, setShowFinancialFlyout] = useState(false);
  const [showSettingsFlyout, setShowSettingsFlyout] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearchActiveIndex, setGlobalSearchActiveIndex] = useState(0);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState({
    operations: true,
    guest: true,
    backOffice: true,
    experience: true,
    admin: true,
    financials: true,
  });
  const { user, logout } = useAuthStore();
  const setGlobalSearch = useUiStore((s) => s.setGlobalSearch);
  const navigate = useNavigate();
  const location = useLocation();

  // Socket presence - establishes connection and handles presence events
  useSocketPresence();
  const { isConnected, getEffectiveStatus } = usePresenceStore();
  const currentUserEffectiveStatus = user ? getEffectiveStatus(user.id, true) : 'OFFLINE';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Use backend modulePermissions as primary source, fall back to local storage / role defaults
  const userPermissions = useMemo(
    () => getUserPermissions(user?.id, user?.role, user?.modulePermissions as PermissionId[] | undefined),
    [user?.id, user?.role, user?.modulePermissions]
  );
  const isSuperAdmin = isSuperAdminUser(user?.id, user?.role as UserRole | undefined);
  const hasAccess = (permission?: PermissionId) =>
    !permission || isSuperAdmin || userPermissions.includes(permission);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const lastPendingCount = useRef<number | null>(null);
  const lastInfoReceivedCount = useRef<number | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const globalSearchRef = useRef<HTMLDivElement | null>(null);
  const financialFlyoutRef = useRef<HTMLDivElement | null>(null);
  const settingsFlyoutRef = useRef<HTMLDivElement | null>(null);
  const [accessRequestAck, setAccessRequestAck] = useState(() => loadAccessRequestAckMap());

  const avatarStorageKey = `laflo-profile-avatar:${user?.id || 'guest'}`;

  useEffect(() => onAccessRequestAckChanged(() => setAccessRequestAck(loadAccessRequestAckMap())), []);

  useEffect(() => {
    try {
      const value = localStorage.getItem(avatarStorageKey);
      setProfileAvatar(value || null);
    } catch {
      setProfileAvatar(null);
    }
  }, [avatarStorageKey]);

  const onAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (!result) return;
      try {
        localStorage.setItem(avatarStorageKey, result);
      } catch {
        toast.error('Failed to save profile picture');
        return;
      }
      setProfileAvatar(result);
      toast.success('Profile picture updated');
    };
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    try {
      localStorage.removeItem(avatarStorageKey);
      setProfileAvatar(null);
      toast.success('Profile picture removed');
    } catch {
      toast.error('Failed to remove profile picture');
    }
  };

  const { data: accessRequests } = useQuery({
    queryKey: ['accessRequests', 'badge'],
    queryFn: accessRequestService.list,
    enabled: isAdmin,
    refetchInterval: isAdmin ? 30000 : false,
  });

  // System notifications query
  const queryClient = useQueryClient();
  const { data: systemNotifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.getNotifications({ isRead: false, limit: 10 }),
    refetchInterval: 15000,
  });

  const { data: unreadNotificationCount } = useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: notificationService.getUnreadCount,
    refetchInterval: 15000,
  });

  const markNotificationAsReadMutation = useMutation({
    mutationFn: notificationService.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllNotificationsReadMutation = useMutation({
    mutationFn: notificationService.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const pendingAccessCount = useMemo(() => {
    if (!accessRequests) return 0;
    return accessRequests.filter(
      (request) =>
        request.status === 'PENDING' ||
        request.status === 'NEEDS_INFO' ||
        (request.status === 'INFO_RECEIVED' && !isAccessRequestAcked(accessRequestAck, request.id))
    ).length;
  }, [accessRequests, accessRequestAck]);

  const pendingAccessRequests = useMemo(() => {
    if (!accessRequests) return [];
    return accessRequests
      .filter(
        (request) =>
          request.status === 'PENDING' ||
          request.status === 'NEEDS_INFO' ||
          (request.status === 'INFO_RECEIVED' && !isAccessRequestAcked(accessRequestAck, request.id))
      )
      .slice(0, 5);
  }, [accessRequests, accessRequestAck]);

  const infoReceivedCount = useMemo(() => {
    if (!accessRequests) return 0;
    return accessRequests.filter(
      (request) => request.status === 'INFO_RECEIVED' && !isAccessRequestAcked(accessRequestAck, request.id)
    ).length;
  }, [accessRequests, accessRequestAck]);

  const settingsFlyoutItems = useMemo(
    () => [
      { label: 'Hotel Info', href: '/settings?tab=hotel' },
      { label: 'Room Types', href: '/settings?tab=room-types' },
      { label: 'Security', href: '/settings?tab=security' },
      { label: 'Notifications', href: '/settings?tab=notifications' },
      { label: 'Appearance', href: '/settings?tab=appearance' },
      { label: 'Audit Trail', href: '/settings?tab=audit-trail' },
      { label: 'Access Requests', href: '/settings?tab=access-requests' },
    ],
    []
  );

  useEffect(() => {
    if (!isAdmin) return;
    if (lastPendingCount.current === null) {
      lastPendingCount.current = pendingAccessCount;
      return;
    }
    if (pendingAccessCount > lastPendingCount.current) {
      toast.success('New access request received');
    }
    lastPendingCount.current = pendingAccessCount;
  }, [pendingAccessCount, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (lastInfoReceivedCount.current === null) {
      lastInfoReceivedCount.current = infoReceivedCount;
      return;
    }
    if (infoReceivedCount > lastInfoReceivedCount.current) {
      toast.success('Access request response received');
    }
    lastInfoReceivedCount.current = infoReceivedCount;
  }, [infoReceivedCount, isAdmin]);

  useEffect(() => {
    if (!showUserMenu) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (userMenuRef.current && userMenuRef.current.contains(target)) return;
      setShowUserMenu(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowUserMenu(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showUserMenu]);

  useEffect(() => {
    if (!showGlobalSearch) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (globalSearchRef.current && globalSearchRef.current.contains(target)) return;
      setShowGlobalSearch(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowGlobalSearch(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showGlobalSearch]);

  useEffect(() => {
    setShowFinancialFlyout(false);
    setShowSettingsFlyout(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!showFinancialFlyout) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (financialFlyoutRef.current?.contains(target)) return;
      setShowFinancialFlyout(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowFinancialFlyout(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showFinancialFlyout]);

  useEffect(() => {
    if (!showSettingsFlyout) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (settingsFlyoutRef.current?.contains(target)) return;
      setShowSettingsFlyout(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowSettingsFlyout(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showSettingsFlyout]);

  useEffect(() => {
    if (!user) return;
    const ping = () => {
      messageService.heartbeatSupportPresence().catch(() => {
        // Keep this silent: presence is best-effort telemetry.
      });
    };
    ping();
    const timer = setInterval(ping, 45_000);
    return () => clearInterval(timer);
  }, [user?.id]);

  const NavItem = ({ item, onClick }: { item: NavigationItem; onClick?: () => void }) => {
    const isActive = location.pathname === item.href ||
      (item.href !== '/' && location.pathname.startsWith(item.href));

    return (
      <NavLink
        to={item.href}
        onClick={onClick}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-primary-600 text-primary-contrast shadow-sm'
            : 'text-text-muted hover:bg-card hover:text-text-main'
        }`}
      >
        {item.icon}
        <span className="flex-1">{item.name}</span>
        {item.badge ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-medium text-white">
            {item.badge}
          </span>
        ) : null}
      </NavLink>
    );
  };

  const SectionHeader = ({
    title,
    sectionKey,
  }: {
    title: string;
    sectionKey: keyof typeof openSections;
  }) => (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-lg px-3 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:bg-slate-50"
      onClick={() =>
        setOpenSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }))
      }
      aria-expanded={openSections[sectionKey]}
    >
      <span>{title}</span>
      <svg
        className={`h-3.5 w-3.5 transition-transform ${openSections[sectionKey] ? 'rotate-180' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );

  const mainItems = navigation;
  const dashboardItem = mainItems.find((item) => item.name === 'Dashboard');
  const opsItems = mainItems.filter((item) =>
    ['Reservation', 'Rooms', 'Housekeeping', 'Inventory', 'Calendar'].includes(item.name)
  );
  const guestItems = mainItems.filter((item) => ['/guests', '/messages', '/calls'].includes(item.href));
  const financialItem = bottomNavigation.find((item) => item.name === 'Financials');
  const experienceItems = bottomNavigation.filter((item) => item.name !== 'Financials');
  const visibleExperienceItems = experienceItems.filter((item) => {
    if (item.roles && !item.roles.includes((user?.role || '') as UserRole)) return false;
    return hasAccess(item.permission);
  });

  const globalSearchTargets = useMemo<GlobalSearchTarget[]>(() => {
    const targets: GlobalSearchTarget[] = [];

    for (const item of navigation) {
      targets.push({
        id: `nav:${item.href}`,
        name: item.name,
        href: item.href,
        section: item.name === 'Dashboard' ? 'Dashboard' : 'Navigation',
        permission: item.permission,
        keywords:
          item.name === 'Reservation'
            ? ['booking', 'bookings', 'reservation', 'reservations', 'check-in', 'check out', 'stay']
            : undefined,
      });
    }

    for (const item of bottomNavigation) {
      targets.push({
        id: `bottom:${item.href}`,
        name: item.name,
        href: item.href,
        section: item.name === 'Financials' ? 'Back Office' : 'Experience',
        permission: item.permission,
        roles: item.roles,
        keywords: item.name === 'Financials' ? ['finance', 'financial', 'reports', 'analytics'] : undefined,
      });
    }

    // Back office sub-pages (explicit routes).
    targets.push({
      id: 'finance:invoices',
      name: 'Invoicing',
      href: '/invoices',
      section: 'Back Office',
      permission: 'financials',
      keywords: ['invoice', 'invoices', 'billing', 'bill', 'charge', 'charges'],
    });
    targets.push({
      id: 'finance:expenses',
      name: 'Expenses',
      href: '/expenses',
      section: 'Back Office',
      permission: 'financials',
      keywords: ['expense', 'expenses', 'spend', 'spending', 'cost', 'costs', 'transactions'],
    });

    for (const item of adminNavigation) {
      targets.push({
        id: `admin:${item.href}`,
        name: item.name,
        href: item.href,
        section: 'Admin',
        permission: item.permission,
        keywords: item.name === 'Settings' ? ['security', 'access requests', '2fa', 'profile'] : undefined,
      });
    }

    // De-dupe by href and apply access filters.
    const seen = new Set<string>();
    return targets.filter((t) => {
      if (seen.has(t.href)) return false;
      seen.add(t.href);
      if (t.roles && !t.roles.includes((user?.role || '') as UserRole)) return false;
      if (t.permission && !hasAccess(t.permission)) return false;
      return true;
    });
  }, [hasAccess, user?.role]);

  const globalSearchResults = useMemo(() => {
    const q = globalSearchQuery.trim();
    if (!q) return [];
    return globalSearchTargets
      .map((t) => ({ target: t, score: scoreTarget(q, t) }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score || a.target.name.localeCompare(b.target.name))
      .slice(0, 8)
      .map((x) => x.target);
  }, [globalSearchQuery, globalSearchTargets]);

  return (
    <div className="flex min-h-screen w-full bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          role="presentation"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white border-r border-slate-200 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Main navigation"
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-[86px] flex-col justify-center gap-2 px-5 border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/60">
            <img src="/laflo-logo.png" alt="LaFlo" className="h-20 w-20 object-contain" />
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto overflow-x-visible p-4 space-y-1" aria-label="Application navigation">
            {dashboardItem && hasAccess(dashboardItem.permission) ? (
              <NavItem key={dashboardItem.name} item={dashboardItem} onClick={() => setSidebarOpen(false)} />
            ) : null}

            <SectionHeader title="Operations" sectionKey="operations" />
            {openSections.operations &&
              opsItems.map((item) =>
                hasAccess(item.permission) ? (
                  <NavItem key={item.name} item={item} onClick={() => setSidebarOpen(false)} />
                ) : null
              )}

            <SectionHeader title="Guest" sectionKey="guest" />
            {openSections.guest &&
              guestItems.map((item) =>
                hasAccess(item.permission) ? (
                  <NavItem key={item.name} item={item} onClick={() => setSidebarOpen(false)} />
                ) : null
              )}

            <div className="my-4 border-t border-slate-100" role="presentation" />

            <SectionHeader title="Back Office" sectionKey="backOffice" />
            {openSections.backOffice &&
              financialItem &&
              hasAccess(financialItem.permission) && (
                <div ref={financialFlyoutRef} className="relative">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium text-text-muted transition-all duration-200 hover:bg-card hover:text-text-main"
                    onClick={() => setShowFinancialFlyout((prev) => !prev)}
                    onMouseEnter={() => setShowFinancialFlyout(true)}
                    aria-expanded={showFinancialFlyout}
                    aria-haspopup="menu"
                  >
                    {financialItem.icon}
                    <span className="flex-1">Financials</span>
                    <svg className={`h-4 w-4 text-slate-400 transition-transform ${showFinancialFlyout ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showFinancialFlyout && (
                    <div
                      role="menu"
                      className="absolute left-full top-0 z-40 ml-2 min-w-[180px] rounded-2xl border border-border bg-card p-2 shadow-lg"
                      onMouseLeave={() => setShowFinancialFlyout(false)}
                    >
                      <NavLink
                        to="/invoices"
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          location.pathname.startsWith('/invoices')
                            ? 'bg-primary-50 text-text-main'
                            : 'text-text-muted hover:bg-card hover:text-text-main'
                        }`}
                        role="menuitem"
                      >
                        Invoicing
                      </NavLink>
                      <NavLink
                        to="/expenses"
                        onClick={() => setSidebarOpen(false)}
                        className={`mt-1 flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          location.pathname.startsWith('/expenses')
                            ? 'bg-primary-50 text-text-main'
                            : 'text-text-muted hover:bg-card hover:text-text-main'
                        }`}
                        role="menuitem"
                      >
                        Expenses
                      </NavLink>
                    </div>
                  )}
                </div>
              )}

            {visibleExperienceItems.length > 0 && (
              <>
                <SectionHeader title="Experience" sectionKey="experience" />
                {openSections.experience &&
                  visibleExperienceItems.map((item) => (
                    <NavItem key={item.name} item={item} onClick={() => setSidebarOpen(false)} />
                  ))}
              </>
            )}

            {(isAdmin || hasAccess('settings') || hasAccess('users')) && (
              <>
                <div className="my-4 border-t border-slate-100" role="presentation" />
                <SectionHeader title="Admin" sectionKey="admin" />
                {openSections.admin &&
                  adminNavigation.map((item) => {
                    if (!hasAccess(item.permission)) return null;
                    if (item.name === 'Settings') {
                      const isSettingsActive = location.pathname.startsWith('/settings');
                      const settingsBadge = pendingAccessCount > 0 ? pendingAccessCount : undefined;

                      return (
                        <div key={item.name} ref={settingsFlyoutRef} className="relative">
                          <button
                            type="button"
                            className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all duration-200 ${
                              isSettingsActive
                                ? 'bg-primary-solid text-on-primary shadow-sm'
                                : 'text-text-muted hover:bg-card hover:text-text-main'
                            }`}
                            onClick={() => setShowSettingsFlyout((prev) => !prev)}
                            onMouseEnter={() => setShowSettingsFlyout(true)}
                            aria-expanded={showSettingsFlyout}
                            aria-haspopup="menu"
                          >
                            {item.icon}
                            <span className="flex-1 text-left">{item.name}</span>
                            {settingsBadge ? (
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  isSettingsActive ? 'bg-white/20 text-on-primary' : 'bg-red-500 text-white'
                                }`}
                              >
                                {settingsBadge}
                              </span>
                            ) : null}
                            <svg
                              className={`h-4 w-4 transition-transform ${
                                showSettingsFlyout ? 'rotate-180' : ''
                              } ${isSettingsActive ? 'text-on-primary/90' : 'text-slate-400'}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {showSettingsFlyout && (
                            <div
                              role="menu"
                              className="absolute left-full top-0 z-40 ml-2 min-w-[220px] rounded-2xl border border-border bg-card p-2 shadow-lg"
                              onMouseLeave={() => setShowSettingsFlyout(false)}
                            >
                              {settingsFlyoutItems.map((subItem, index) => {
                                const subTab = new URL(subItem.href, 'https://laflo.local').searchParams.get('tab');
                                const active =
                                  location.pathname.startsWith('/settings') &&
                                  new URLSearchParams(location.search).get('tab') === subTab;

                                return (
                                  <NavLink
                                    key={subItem.href}
                                    to={subItem.href}
                                    onClick={() => {
                                      setSidebarOpen(false);
                                      setShowSettingsFlyout(false);
                                    }}
                                    className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                      active
                                        ? 'bg-primary-50 text-text-main'
                                        : 'text-text-muted hover:bg-card hover:text-text-main'
                                    } ${index > 0 ? 'mt-1' : ''}`}
                                    role="menuitem"
                                  >
                                    {subItem.label}
                                  </NavLink>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return (
                      <NavItem
                        key={item.name}
                        item={
                          item.name === 'Settings' && pendingAccessCount > 0
                            ? { ...item, badge: pendingAccessCount }
                            : item
                        }
                        onClick={() => setSidebarOpen(false)}
                      />
                    );
                  })}
              </>
            )}
          </nav>

          <div className="border-t border-slate-100 p-4" />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200" role="banner">
          <div className="mx-auto grid h-16 w-full max-w-none grid-cols-[auto_1fr_auto] items-center gap-3 px-4 lg:px-6">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Open navigation menu"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>

            {/* Search (centered like reference) */}
            <div className="flex justify-center">
              <div className="w-full max-w-xl">
                <div ref={globalSearchRef} className="relative">
                  <label htmlFor="global-search" className="sr-only">Search</label>
                  <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    id="global-search"
                    type="text"
                    placeholder="Search room, guest, book, etc"
                    value={globalSearchQuery}
                    onChange={(e) => {
                      setGlobalSearchQuery(e.target.value);
                      setGlobalSearch(e.target.value);
                      setShowGlobalSearch(true);
                      setGlobalSearchActiveIndex(0);
                    }}
                    onFocus={() => setShowGlobalSearch(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShowGlobalSearch(false);
                        return;
                      }
                      if (!showGlobalSearch) return;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setGlobalSearchActiveIndex((idx) =>
                          Math.min(idx + 1, Math.max(0, globalSearchResults.length - 1))
                        );
                        return;
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setGlobalSearchActiveIndex((idx) => Math.max(0, idx - 1));
                        return;
                      }
                      if (e.key === 'Enter') {
                        const pick = globalSearchResults[globalSearchActiveIndex] || globalSearchResults[0];
                        if (!pick) return;
                        e.preventDefault();
                        setShowGlobalSearch(false);
                        setGlobalSearchQuery('');
                        setGlobalSearch('');
                        navigate(pick.href);
                      }
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm placeholder-slate-400 focus:bg-white focus:border-primary-500 focus:ring-primary-500 transition-colors"
                  />

                  {showGlobalSearch && globalSearchQuery.trim().length > 0 && (
                    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                      {globalSearchResults.length > 0 ? (
                        <div className="py-2">
                          {globalSearchResults.map((item, idx) => (
                            <button
                              key={item.id}
                              type="button"
                              onMouseDown={(ev) => ev.preventDefault()}
                              onClick={() => {
                                setShowGlobalSearch(false);
                                setGlobalSearchQuery('');
                                setGlobalSearch('');
                                navigate(item.href);
                              }}
                              className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                                idx === globalSearchActiveIndex
                                  ? 'bg-primary-50 text-slate-900'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="truncate font-medium">{item.name}</div>
                                <div className="truncate text-xs text-slate-500">{item.section}</div>
                              </div>
                              <div className="shrink-0 text-xs font-medium text-slate-400">
                                {item.href}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="px-4 py-4 text-sm text-slate-500">No matches found.</div>
                      )}
                      <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
                        Tip: use ↑ ↓ then Enter to jump
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right side (match reference ordering: avatar/name then icons) */}
            <div className="flex items-center justify-end gap-2">
            {/* User avatar with presence */}
            <div ref={userMenuRef} className="relative flex items-center">
              <button
                type="button"
                onClick={() => setShowUserMenu((prev) => !prev)}
                className="flex items-center gap-3 rounded-2xl px-2 py-1.5 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-haspopup="menu"
                aria-expanded={showUserMenu}
              >
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-slate-900">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-slate-500">{user?.role}</p>
                </div>
                {/* Avatar with presence dot */}
                <div className="relative">
                  <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center overflow-hidden">
                    {profileAvatar ? (
                      <img src={profileAvatar} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-medium text-amber-700">
                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                      </span>
                    )}
                  </div>
                  {/* Presence indicator dot */}
                  <div className="absolute -bottom-0.5 -right-0.5">
                    <PresenceDot status={currentUserEffectiveStatus} size="sm" />
                  </div>
                </div>
              </button>

              {showUserMenu && (
                <div
                  role="menu"
                  className="absolute right-0 top-14 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                >
                  {/* Presence status selector */}
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-2">Set status</p>
                    <PresenceMenu 
                      currentStatus={currentUserEffectiveStatus}
                      isConnected={isConnected}
                    />
                  </div>
                  
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate('/settings?tab=profile');
                    }}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Profile
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate('/settings');
                    }}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Settings
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onAvatarChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => avatarInputRef.current?.click()}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Upload photo
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={removeAvatar}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:text-slate-400"
                    disabled={!profileAvatar}
                  >
                    Remove photo
                  </button>
                  <div className="h-px bg-slate-100" role="presentation" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={async () => {
                      setShowUserMenu(false);
                      await handleLogout();
                    }}
                    className="w-full px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 pl-1">
              {/* Settings */}
              <button
                className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 transition-colors"
                onClick={() => navigate('/settings')}
                title="Settings"
                aria-label="Settings"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications((prev) => !prev)}
                  className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Notifications"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {((isAdmin && pendingAccessCount > 0) || (unreadNotificationCount && unreadNotificationCount > 0)) && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
                      {(isAdmin ? pendingAccessCount : 0) + (unreadNotificationCount || 0)}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-96 rounded-xl border border-slate-200 bg-white shadow-lg z-50">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Notifications</p>
                        <p className="text-xs text-slate-500">
                          {(unreadNotificationCount || 0) + (isAdmin ? pendingAccessCount : 0)} unread
                        </p>
                      </div>
                      {(unreadNotificationCount || 0) > 0 && (
                        <button
                          onClick={() => markAllNotificationsReadMutation.mutate()}
                          className="text-xs font-medium text-primary-600 hover:text-primary-700"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {/* System Notifications */}
                      {systemNotifications && systemNotifications.notifications && systemNotifications.notifications.length > 0 && (
                        <div className="divide-y divide-slate-100">
                          {systemNotifications.notifications.map((notification) => (
                            <button
                              key={notification.id}
                              onClick={() => {
                                markNotificationAsReadMutation.mutate(notification.id);
                                setShowNotifications(false);
                                // Navigate based on notification type
                                if (notification.type === 'TICKET_ESCALATED' || notification.type === 'TICKET_BREACHED' || notification.type === 'TICKET_ASSIGNED') {
                                  navigate(`/messages?thread=${notification.conversationId}`);
                                } else if (notification.type === 'MESSAGE_RECEIVED') {
                                  navigate(`/messages?thread=${notification.conversationId}`);
                                }
                              }}
                              className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 ${!notification.isRead ? 'bg-blue-50/50' : ''}`}
                            >
                              <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${getNotificationColor(notification.type)}`}>
                                <span className="text-sm">{getNotificationIcon(notification.type)}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-900">{notification.title}</p>
                                <p className="text-xs text-slate-600 line-clamp-2">{notification.body}</p>
                                <p className="mt-1 text-xs text-slate-400">{formatNotificationTime(notification.createdAt)}</p>
                              </div>
                              {!notification.isRead && (
                                <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {/* Access Request Notifications (Admin only) */}
                      {isAdmin && pendingAccessRequests.length > 0 && (
                        <div className="divide-y divide-slate-100 border-t border-slate-200">
                          <div className="bg-slate-50 px-4 py-2">
                            <p className="text-xs font-semibold text-slate-600">Access Requests</p>
                          </div>
                          {pendingAccessRequests.map((request) => (
                            <button
                              key={request.id}
                              onClick={() => {
                                if (request.status === 'INFO_RECEIVED') {
                                  ackAccessRequest(request.id);
                                }
                                setShowNotifications(false);
                                navigate('/settings?tab=access-requests');
                              }}
                              className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                            >
                              <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
                                <span className="text-sm">👤</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-900">{request.fullName}</p>
                                <p className="text-xs text-slate-600">{request.email}</p>
                                <p className="text-xs text-slate-400">Company: {request.company || '-'}</p>
                              </div>
                              <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-amber-400" />
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {/* Empty state */}
                      {(!systemNotifications?.notifications?.length && !pendingAccessRequests.length) && (
                        <div className="px-4 py-8 text-center">
                          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                            <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                          </div>
                          <p className="text-sm text-slate-500">You're all caught up!</p>
                          <p className="text-xs text-slate-400">No new notifications</p>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-slate-100 px-4 py-3">
                      <button
                        onClick={() => {
                          setShowNotifications(false);
                          navigate('/settings?tab=notifications');
                        }}
                        className="w-full text-sm font-medium text-primary-600 hover:text-primary-700"
                      >
                        Notification settings
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        </header>

          {/* Page content */}
        <main id="main-content" className="min-w-0 flex-1 overflow-x-auto p-4 lg:p-6" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <AppChatbot />
    </div>
  );
}
