import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { usePresenceStore, getPresenceLabel } from '@/stores/presenceStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accessRequestService, enterpriseSearchService, messageService, notificationService } from '@/services';
import { getNotificationIcon, getNotificationColor, formatNotificationTime } from '@/services/notifications';
import { getExplicitPermissions, isSuperAdminUser, type PermissionId, type UserRole } from '@/utils/userAccess';
import toast from 'react-hot-toast';
import { useUiStore } from '@/stores/uiStore';
import {
  loadAccessRequestAckMap,
  isAccessRequestAcked,
  onAccessRequestAckChanged,
  ackAccessRequest,
} from '@/utils/accessRequestAck';
import AppChatbot from '@/components/support/AppChatbot';
import CommandPalette from '@/components/command/CommandPalette';
import { PresenceDot } from '@/components/presence';
import { useSocketPresence } from '@/hooks/useSocketPresence';
import type { PresenceStatus } from '@/types';
import { SidebarRail, SidebarFlyout, useSidebarNav, navSections } from './navigation';
import type { NavGroup, NavItem, NavSection } from './navigation';

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
  value.toLowerCase().trim().replace(/\s+/g, ' ');

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

const rankSearchTargets = (query: string, targets: GlobalSearchTarget[], limit = 8) => {
  const q = query.trim();
  if (!q) return targets.slice(0, limit);

  return targets
    .map((target) => ({ target, score: scoreTarget(q, target) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score || a.target.name.localeCompare(b.target.name))
    .slice(0, limit)
    .map((item) => item.target);
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
};

const getWorkspaceLabel = (role?: string) => {
  switch (role) {
    case 'ADMIN':
      return 'Admin Workspace';
    case 'MANAGER':
      return 'Manager Workspace';
    case 'FRONT_DESK':
      return 'Front Desk Workspace';
    case 'HOUSEKEEPING':
      return 'Housekeeping Workspace';
    case 'MAINTENANCE':
      return 'Maintenance Workspace';
    default:
      return 'Hotel Workspace';
  }
};

export default function DashboardLayout() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearchActiveIndex, setGlobalSearchActiveIndex] = useState(0);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandSearchQuery, setCommandSearchQuery] = useState('');
  const [commandActiveIndex, setCommandActiveIndex] = useState(0);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  
  const { user, logout } = useAuthStore();
  const { getEffectiveStatus, isConnected } = usePresenceStore();
  const setGlobalSearch = useUiStore((s) => s.setGlobalSearch);
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize socket connection and presence subscriptions
  const { emitPresenceSet } = useSocketPresence();

  // Sidebar nav state
  const sidebarNav = useSidebarNav();

  // Get current user's effective presence status (always treat as current user)
  const userPresenceStatus = user ? getEffectiveStatus(user.id, true) : 'OFFLINE';

  // Teams-like presence status options (includes "Appear offline")
  const presenceOptions: { key: PresenceStatus; label: string; hint: string }[] = [
    { key: 'AVAILABLE', label: 'Available', hint: 'Ready to help' },
    { key: 'BUSY', label: 'Busy', hint: 'In a task' },
    { key: 'AWAY', label: 'Away', hint: 'Stepped out' },
    { key: 'DND', label: 'Do not disturb', hint: 'No interruptions' },
    { key: 'APPEAR_OFFLINE', label: 'Appear offline', hint: 'Shown as offline' },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userPermissions = useMemo(
    () => getExplicitPermissions(user?.id, user?.modulePermissions as PermissionId[] | undefined),
    [user?.id, user?.modulePermissions]
  );
  const isSuperAdmin = isSuperAdminUser(user?.id, user?.role as UserRole | undefined);
  const hasAccess = (permission?: PermissionId) =>
    !permission || isSuperAdmin || userPermissions.includes(permission);
  const hasRoleAccess = (roles?: UserRole[]) =>
    !roles || roles.includes((user?.role || '') as UserRole);
  const canShowNavItem = (item: NavItem) =>
    hasAccess(item.permission) && hasRoleAccess(item.roles);
  const canShowNavGroup = (group: NavGroup) =>
    hasAccess(group.permission) && hasRoleAccess(group.roles);
  const groupToNavItem = (group: NavGroup): NavItem | null =>
    group.href
      ? {
          id: group.id,
          label: group.label,
          href: group.href,
          permission: group.permission,
          roles: group.roles,
          icon: group.icon,
          badge: group.badge,
        }
      : null;
  const getSectionSearchItems = (section: NavSection): NavItem[] => {
    const items = [...(section.items ?? [])];

    for (const group of section.groups ?? []) {
      if (!canShowNavGroup(group)) continue;
      const groupItem = groupToNavItem(group);
      if (groupItem) items.push(groupItem);
      items.push(...group.items);
    }

    return items.filter(canShowNavItem);
  };

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const lastPendingCount = useRef<number | null>(null);
  const lastInfoReceivedCount = useRef<number | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const globalSearchRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
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
    if (!showNotifications) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (notificationsRef.current?.contains(target)) return;
      setShowNotifications(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowNotifications(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showNotifications]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 'k') {
        event.preventDefault();
        setShowGlobalSearch(false);
        setShowCommandPalette((open) => !open);
        return;
      }

      if (event.key === '/' && !isEditableTarget(event.target)) {
        event.preventDefault();
        setShowCommandPalette(false);
        setShowGlobalSearch(true);
        window.requestAnimationFrame(() => document.getElementById('global-search')?.focus());
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!user) return;
    const ping = () => {
      messageService.heartbeatSupportPresence().catch(() => {});
    };
    ping();
    const timer = setInterval(ping, 45_000);
    return () => clearInterval(timer);
  }, [user?.id]);

  // Build search targets from nav config
  const globalSearchTargets = useMemo<GlobalSearchTarget[]>(() => {
    const targets: GlobalSearchTarget[] = [];
    
    for (const section of navSections) {
      for (const item of getSectionSearchItems(section)) {
        targets.push({
          id: `${section.id}:${item.id}`,
          name: item.label,
          href: item.href,
          section: section.label,
          permission: item.permission,
          roles: item.roles,
          keywords: item.label === 'Reservation' 
            ? ['booking', 'bookings', 'reservation', 'reservations', 'check-in', 'check out', 'stay']
            : item.label === 'Financials'
            ? ['finance', 'financial', 'reports', 'analytics']
            : item.label === 'Invoicing'
            ? ['invoice', 'invoices', 'billing', 'bill', 'charge', 'charges']
            : item.label === 'Expenses'
            ? ['expense', 'expenses', 'spend', 'spending', 'cost', 'costs', 'transactions']
            : item.label === 'Smart Building'
            ? ['smart building', 'iot', 'doors', 'sensors', 'energy', 'hvac', 'assets']
            : item.label === 'CCTV'
            ? ['camera', 'cameras', 'security', 'video']
            : undefined,
        });
      }
    }

    return targets;
  }, [hasAccess, user?.role]);

  const globalSearchResults = useMemo(() => {
    if (!globalSearchQuery.trim()) return [];
    return rankSearchTargets(globalSearchQuery, globalSearchTargets, 5);
  }, [globalSearchQuery, globalSearchTargets]);

  const enterpriseQuickSearch = useQuery({
    queryKey: ['enterprise-search', 'global', globalSearchQuery],
    queryFn: () => enterpriseSearchService.search({ q: globalSearchQuery, limit: 6 }),
    enabled: globalSearchQuery.trim().length >= 2,
    staleTime: 15_000,
  });

  const combinedGlobalSearchResults = useMemo<GlobalSearchTarget[]>(() => {
    const enterpriseResults = (enterpriseQuickSearch.data?.results || []).map((result) => ({
      id: `enterprise:${result.searchId}`,
      name: result.title,
      href: result.sourceUrl || '/operations-center/search',
      section: result.category.replace(/_/g, ' '),
      keywords: [result.sourceModule, result.status, result.priority, result.severity].filter(Boolean) as string[],
    }));
    const seen = new Set<string>();
    return [...enterpriseResults, ...globalSearchResults].filter((item) => {
      const key = `${item.href}:${item.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);
  }, [enterpriseQuickSearch.data?.results, globalSearchResults]);

  const commandPaletteResults = useMemo(
    () => rankSearchTargets(commandSearchQuery, globalSearchTargets, commandSearchQuery.trim() ? 10 : 12),
    [commandSearchQuery, globalSearchTargets]
  );

  const workspaceLabel = getWorkspaceLabel(user?.role);

  // Close flyout when navigating
  useEffect(() => {
    sidebarNav.closeFlyout();
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      {/* Mobile sidebar backdrop */}
      {sidebarNav.isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={sidebarNav.closeMobile}
          role="presentation"
        />
      )}

      {/* Sidebar Rail */}
      <div className="hidden lg:flex" data-sidebar-rail>
        <SidebarRail
          openSection={sidebarNav.openSection}
          lockedSection={sidebarNav.lockedSection}
          onIconHover={sidebarNav.handleIconHover}
          onIconLeave={sidebarNav.handleIconLeave}
          onIconClick={sidebarNav.handleIconClick}
          accessRequestBadge={pendingAccessCount}
        />
      </div>

      {/* Sidebar Flyout */}
      <SidebarFlyout
        openSection={sidebarNav.openSection}
        isLocked={sidebarNav.isLocked}
        onFlyoutEnter={sidebarNav.handleFlyoutEnter}
        onFlyoutLeave={sidebarNav.handleFlyoutLeave}
        onItemClick={sidebarNav.closeFlyout}
        onClickOutside={sidebarNav.closeFlyout}
        accessRequestBadge={pendingAccessCount}
      />

      {/* Mobile Sidebar (slide-in drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transform bg-white border-r border-slate-200 transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarNav.isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Mobile navigation"
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-slate-100">
            <img src="/laflo-logo.png" alt="LaFlo" className="h-10 w-10 object-contain" />
            <button
              type="button"
              onClick={sidebarNav.closeMobile}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              aria-label="Close menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Mobile Nav Links */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navSections.map((section) => {
              const visibleItems = (section.items ?? []).filter(canShowNavItem);
              const visibleGroups = (section.groups ?? [])
                .filter(canShowNavGroup)
                .map((group) => ({
                  ...group,
                  items: group.items.filter(canShowNavItem),
                }))
                .filter((group) => group.href || group.items.length > 0);
              if (visibleItems.length === 0 && visibleGroups.length === 0) return null;

              return (
                <div key={section.id} className="mb-4">
                  <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {section.label}
                  </p>
                  {visibleGroups.length > 0 ? (
                    <div className="space-y-2">
                      {visibleGroups.map((group) => {
                        const groupItem = groupToNavItem(group);
                        const groupHref = group.href;
                        const groupIsActive = groupHref
                          ? groupHref === '/operations-center'
                            ? location.pathname === groupHref
                            : location.pathname === groupHref || location.pathname.startsWith(`${groupHref}/`)
                          : group.items.some((item) => location.pathname === item.href || location.pathname.startsWith(`${item.href}/`));

                        return (
                          <div key={group.id}>
                            {groupItem ? (
                              <NavLink
                                to={groupItem.href}
                                onClick={sidebarNav.closeMobile}
                                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                                  groupIsActive
                                    ? 'bg-slate-800 text-white'
                                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                                }`}
                              >
                                {group.label}
                              </NavLink>
                            ) : (
                              <p className="px-3 py-2 text-sm font-semibold text-slate-800">{group.label}</p>
                            )}
                            <div className="mt-1 space-y-1">
                              {group.items.map((item) => {
                                const isActive = item.href === '/'
                                  ? location.pathname === '/'
                                  : location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);

                                return (
                                  <NavLink
                                    key={item.id}
                                    to={item.href}
                                    onClick={sidebarNav.closeMobile}
                                    className={`flex items-center gap-3 rounded-xl px-6 py-2 text-sm font-medium transition-all ${
                                      isActive
                                        ? 'bg-slate-800 text-white'
                                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                    }`}
                                  >
                                    {item.label}
                                  </NavLink>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    visibleItems.map((item) => {
                      const isActive = item.href === '/'
                        ? location.pathname === '/'
                        : location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);

                      return (
                        <NavLink
                          key={item.id}
                          to={item.href}
                          onClick={sidebarNav.closeMobile}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                            isActive
                              ? 'bg-slate-800 text-white'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          {item.label}
                        </NavLink>
                      );
                    })
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200" role="banner">
          <div className="mx-auto grid h-16 w-full max-w-none grid-cols-[auto_1fr_auto] items-center gap-3 px-4 lg:px-6">
            <div className="flex items-center">
              <button
                onClick={sidebarNav.toggleMobile}
                className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden focus:outline-none focus:ring-2 focus:ring-slate-500"
                aria-label="Open navigation menu"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>

            {/* Search */}
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
                    placeholder="Search rooms, guests, bookings..."
                    value={globalSearchQuery}
                    onChange={(e) => {
                      setGlobalSearchQuery(e.target.value);
                      setGlobalSearch(e.target.value);
                      setShowGlobalSearch(true);
                      setGlobalSearchActiveIndex(0);
                    }}
                    onFocus={() => setShowGlobalSearch(true)}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={showGlobalSearch && globalSearchQuery.trim().length > 0}
                    aria-controls="global-search-results"
                    aria-keyshortcuts="/ Control+K Meta+K"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShowGlobalSearch(false);
                        return;
                      }
                      if (!showGlobalSearch) return;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setGlobalSearchActiveIndex((idx) =>
                          Math.min(idx + 1, Math.max(0, combinedGlobalSearchResults.length - 1))
                        );
                        return;
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setGlobalSearchActiveIndex((idx) => Math.max(0, idx - 1));
                        return;
                      }
                      if (e.key === 'Enter') {
                        const pick = combinedGlobalSearchResults[globalSearchActiveIndex] || combinedGlobalSearchResults[0];
                        if (!pick) return;
                        e.preventDefault();
                        setShowGlobalSearch(false);
                        setGlobalSearchQuery('');
                        setGlobalSearch('');
                        navigate(pick.href);
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-20 text-sm placeholder-slate-400 transition-all focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowGlobalSearch(false);
                      setShowCommandPalette(true);
                    }}
                    className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 shadow-sm hover:text-slate-800 sm:block"
                    aria-label="Open command palette"
                    aria-keyshortcuts="Control+K Meta+K"
                  >
                    Ctrl K
                  </button>

                  {showGlobalSearch && globalSearchQuery.trim().length > 0 && (
                    <div
                      id="global-search-results"
                      className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                      role="listbox"
                      aria-label="Search results"
                    >
                      {combinedGlobalSearchResults.length > 0 ? (
                        <div className="py-2">
                          {combinedGlobalSearchResults.map((item, idx) => (
                            <button
                              key={item.id}
                              type="button"
                              role="option"
                              aria-selected={idx === globalSearchActiveIndex}
                              onMouseDown={(ev) => ev.preventDefault()}
                              onClick={() => {
                                setShowGlobalSearch(false);
                                setGlobalSearchQuery('');
                                setGlobalSearch('');
                                navigate(item.href);
                              }}
                              className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                                idx === globalSearchActiveIndex
                                  ? 'bg-slate-100 text-slate-900'
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
                        Tip: use Up/Down then Enter to jump
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center justify-end gap-2">
              {/* User avatar */}
              <div ref={userMenuRef} className="relative flex items-center">
                <button
                  type="button"
                  onClick={() => setShowUserMenu((prev) => !prev)}
                  className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
                  aria-haspopup="menu"
                  aria-expanded={showUserMenu}
                >
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-medium text-slate-900">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-slate-500">{workspaceLabel} / {getPresenceLabel(userPresenceStatus)}</p>
                  </div>
                  <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                      {profileAvatar ? (
                        <img src={profileAvatar} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm font-medium text-slate-600">
                          {user?.firstName?.[0]}{user?.lastName?.[0]}
                        </span>
                      )}
                    </div>
                    {/* Presence indicator dot */}
                    <div className="absolute -bottom-0.5 -right-0.5 z-10">
                      <PresenceDot status={userPresenceStatus} size="sm" />
                    </div>
                  </div>
                </button>

                {showUserMenu && (
                  <div
                    role="menu"
                    className="absolute right-0 top-14 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg z-50"
                  >
                    {/* Teams-like Status Picker - Collapsed/Expanded */}
                    <div className="px-4 py-3">
                      {/* Current status row - click to expand */}
                      <button
                        type="button"
                        onClick={() => setShowStatusPicker(!showStatusPicker)}
                        className="w-full flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <PresenceDot status={userPresenceStatus} size="sm" showBorder={false} />
                          <span className="font-medium text-slate-700">
                            {isConnected ? getPresenceLabel(userPresenceStatus) : 'Offline'}
                          </span>
                        </div>
                        <svg
                          className={`w-4 h-4 text-slate-400 transition-transform ${showStatusPicker ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Expanded status options */}
                      {showStatusPicker && (
                        <div className="mt-2 space-y-1">
                          {!isConnected && (
                            <p className="text-xs text-amber-600 px-2 py-1 bg-amber-50 rounded">
                              You're offline. Reconnecting…
                            </p>
                          )}
                          {presenceOptions.map((opt) => (
                            <button
                              key={opt.key}
                              type="button"
                              disabled={!isConnected}
                              onClick={() => {
                                emitPresenceSet(opt.key);
                                setShowStatusPicker(false);
                              }}
                              className={`w-full flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors ${
                                !isConnected
                                  ? 'opacity-50 cursor-not-allowed'
                                  : userPresenceStatus === opt.key || (opt.key === 'APPEAR_OFFLINE' && userPresenceStatus === 'OFFLINE' && isConnected)
                                    ? 'bg-primary-50 text-primary-700'
                                    : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <PresenceDot status={opt.key === 'APPEAR_OFFLINE' ? 'OFFLINE' : opt.key} size="sm" showBorder={false} />
                              <div className="text-left">
                                <span className="font-medium">{opt.label}</span>
                                <span className="block text-xs text-slate-400">{opt.hint}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="h-px bg-slate-100" role="presentation" />
                    {/* Profile & Appearance - available to all */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowUserMenu(false);
                        navigate('/settings?tab=appearance');
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Profile & Appearance
                    </button>
                    {/* Security - available to all */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowUserMenu(false);
                        navigate('/settings?tab=security');
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Security & Password
                    </button>
                    {/* Full Settings - admin/manager only */}
                    {isAdmin && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setShowUserMenu(false);
                          navigate('/settings');
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Hotel Settings
                      </button>
                    )}
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
                {/* Notifications */}
                <div ref={notificationsRef} className="relative">
                  <button
                    onClick={() => setShowNotifications((prev) => !prev)}
                    className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100 transition-colors"
                    aria-label="Notifications"
                    aria-haspopup="dialog"
                    aria-expanded={showNotifications}
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
                    <div
                      className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-1.5rem))] rounded-xl border border-slate-200 bg-white shadow-lg z-50"
                      role="dialog"
                      aria-label="Notification center"
                    >
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
                            className="text-xs font-medium text-slate-600 hover:text-slate-800"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {systemNotifications && systemNotifications.notifications && systemNotifications.notifications.length > 0 && (
                          <div className="divide-y divide-slate-100">
                            {systemNotifications.notifications.map((notification) => (
                              <button
                                key={notification.id}
                                onClick={() => {
                                  markNotificationAsReadMutation.mutate(notification.id);
                                  setShowNotifications(false);
                                  if (notification.type === 'TICKET_ESCALATED' || notification.type === 'TICKET_BREACHED' || notification.type === 'TICKET_ASSIGNED') {
                                    navigate(`/messages?thread=${notification.conversationId}`);
                                  } else if (notification.type === 'MESSAGE_RECEIVED') {
                                    navigate(`/messages?thread=${notification.conversationId}`);
                                  }
                                }}
                                className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 ${!notification.isRead ? 'bg-sky-50/50' : ''}`}
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
                                  <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-sky-500" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                        
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
                          className="w-full text-sm font-medium text-slate-600 hover:text-slate-800"
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
      <CommandPalette
        open={showCommandPalette}
        query={commandSearchQuery}
        items={commandPaletteResults}
        activeIndex={commandActiveIndex}
        workspaceLabel={workspaceLabel}
        onQueryChange={setCommandSearchQuery}
        onActiveIndexChange={setCommandActiveIndex}
        onClose={() => setShowCommandPalette(false)}
        onSelect={(item) => {
          setShowCommandPalette(false);
          setCommandSearchQuery('');
          setCommandActiveIndex(0);
          navigate(item.href);
        }}
      />
      {!location.pathname.startsWith('/calls') && !location.pathname.startsWith('/operations') ? <AppChatbot /> : null}
    </div>
  );
}
