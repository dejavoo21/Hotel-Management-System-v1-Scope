import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { usePresenceStore } from '@/stores/presenceStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accessRequestService, messageService, notificationService } from '@/services';
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
import { PresenceDot } from '@/components/presence';
import { useSocketPresence } from '@/hooks/useSocketPresence';
import { SidebarRail, SidebarFlyout, useSidebarNav, navSections } from './navigation';

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

export default function DashboardLayout() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearchActiveIndex, setGlobalSearchActiveIndex] = useState(0);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  
  const { user, logout } = useAuthStore();
  const { getEffectiveStatus } = usePresenceStore();
  const setGlobalSearch = useUiStore((s) => s.setGlobalSearch);
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize socket connection and presence subscriptions
  useSocketPresence();

  // Sidebar nav state
  const sidebarNav = useSidebarNav();

  // Get current user's effective presence status
  const userPresenceStatus = user ? getEffectiveStatus(user.id, true) : 'OFFLINE';

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

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const lastPendingCount = useRef<number | null>(null);
  const lastInfoReceivedCount = useRef<number | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const globalSearchRef = useRef<HTMLDivElement | null>(null);
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
      for (const item of section.items) {
        // Check access
        if (item.permission && !hasAccess(item.permission)) continue;
        if (item.roles && !item.roles.includes((user?.role || '') as UserRole)) continue;
        
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
            : undefined,
        });
      }
    }

    return targets;
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
              const visibleItems = section.items.filter(item => 
                hasAccess(item.permission) && 
                (!item.roles || item.roles.includes((user?.role || '') as UserRole))
              );
              if (visibleItems.length === 0) return null;

              return (
                <div key={section.id} className="mb-4">
                  <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {section.label}
                  </p>
                  {visibleItems.map((item) => {
                    const isActive = item.href === '/' 
                      ? location.pathname === '/' 
                      : location.pathname.startsWith(item.href);
                    
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
                  })}
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm placeholder-slate-400 focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all"
                  />

                  {showGlobalSearch && globalSearchQuery.trim().length > 0 && (
                    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
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
                        Tip: use ↑ ↓ then Enter to jump
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
                    <p className="text-xs text-slate-500">{user?.role}</p>
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
                    className="absolute right-0 top-14 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                  >
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
      <AppChatbot />
    </div>
  );
}
