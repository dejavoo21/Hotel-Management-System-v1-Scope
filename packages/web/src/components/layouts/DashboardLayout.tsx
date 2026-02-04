import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useQuery } from '@tanstack/react-query';
import { accessRequestService } from '@/services';
import { getUserPermissions, isSuperAdminUser, type PermissionId, type UserRole } from '@/utils/userAccess';
import toast from 'react-hot-toast';

type NavigationItem = {
  name: string;
  href: string;
  permission: PermissionId;
  icon: JSX.Element;
  badge?: number;
  expandable?: boolean;
};

type NavigationGroupItem = NavigationItem & {
  roles?: UserRole[];
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
    badge: 2,
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
    roles: ['ADMIN', 'MANAGER'],
    expandable: true,
  },
  {
    name: 'Reviews',
    href: '/reviews',
    permission: 'reviews',
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
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userPermissions = useMemo(
    () => getUserPermissions(user?.id, user?.role),
    [user?.id, user?.role]
  );
  const isSuperAdmin = isSuperAdminUser(user?.id);
  const hasAccess = (permission?: PermissionId) =>
    !permission || isSuperAdmin || userPermissions.includes(permission);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const lastPendingCount = useRef<number | null>(null);
  const lastInfoReceivedCount = useRef<number | null>(null);

  const { data: accessRequests } = useQuery({
    queryKey: ['accessRequests', 'badge'],
    queryFn: accessRequestService.list,
    enabled: isAdmin,
    refetchInterval: isAdmin ? 30000 : false,
  });

  const pendingAccessCount = useMemo(() => {
    if (!accessRequests) return 0;
    return accessRequests.filter(
      (request) =>
        request.status === 'PENDING' ||
        request.status === 'NEEDS_INFO' ||
        request.status === 'INFO_RECEIVED'
    ).length;
  }, [accessRequests]);

  const pendingAccessRequests = useMemo(() => {
    if (!accessRequests) return [];
    return accessRequests
      .filter(
        (request) =>
          request.status === 'PENDING' ||
          request.status === 'NEEDS_INFO' ||
          request.status === 'INFO_RECEIVED'
      )
      .slice(0, 5);
  }, [accessRequests]);

  const infoReceivedCount = useMemo(() => {
    if (!accessRequests) return 0;
    return accessRequests.filter((request) => request.status === 'INFO_RECEIVED').length;
  }, [accessRequests]);

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

  const NavItem = ({ item, onClick }: { item: NavigationItem; onClick?: () => void }) => {
    const isActive = location.pathname === item.href ||
      (item.href !== '/' && location.pathname.startsWith(item.href));

    return (
      <NavLink
        to={item.href}
        onClick={onClick}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-primary-500 text-slate-900 shadow-sm'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        {item.icon}
        <span className="flex-1">{item.name}</span>
        {item.badge ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-medium text-white">
            {item.badge}
          </span>
        ) : null}
        {item.expandable && (
          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </NavLink>
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
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
          <div className="flex h-16 items-center gap-3 px-5 border-b border-slate-100">
            <img
              src="/laflo-logo.png"
              alt="Laflo - Hotel Management System"
              className="h-9 w-9 rounded-lg bg-white object-contain"
            />
            <div>
              <span className="text-lg font-bold text-slate-900">Laflo</span>
              <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">V 1.0</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1" aria-label="Application navigation">
            {navigation.map((item) =>
              hasAccess(item.permission) ? (
                <NavItem key={item.name} item={item} onClick={() => setSidebarOpen(false)} />
              ) : null
            )}

            <div className="my-4 border-t border-slate-100" role="presentation" />

            {bottomNavigation.map((item) => {
              if (item.roles && !item.roles.includes((user?.role || '') as UserRole)) {
                return null;
              }
              if (!hasAccess(item.permission)) {
                return null;
              }
              return <NavItem key={item.name} item={item} onClick={() => setSidebarOpen(false)} />;
            })}

            {(isAdmin || hasAccess('settings') || hasAccess('users')) && (
              <>
                <div className="my-4 border-t border-slate-100" role="presentation" />
                {adminNavigation.map((item) => {
                  if (!hasAccess(item.permission)) return null;
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

          {/* User menu */}
          <div className="border-t border-slate-100 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-800">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="truncate text-xs text-slate-500">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex flex-col items-center rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Log out"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="mt-1 text-[10px] text-slate-500">Log out</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 bg-white border-b border-slate-200 px-4 lg:px-6" role="banner">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Open navigation menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Search */}
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <label htmlFor="global-search" className="sr-only">Search</label>
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                id="global-search"
                type="text"
                placeholder="Search room, guest, book, etc"
                className="w-full rounded-xl border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm placeholder-slate-400 focus:bg-white focus:border-primary-500 focus:ring-primary-500 transition-colors"
              />
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications((prev) => !prev)}
                className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Notifications"
              >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {isAdmin && pendingAccessCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
                  {pendingAccessCount}
                </span>
              )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Notifications</p>
                    <p className="text-xs text-slate-500">
                      {pendingAccessCount > 0
                        ? `${pendingAccessCount} pending access requests`
                        : 'No new access requests'}
                    </p>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {pendingAccessRequests.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {pendingAccessRequests.map((request) => (
                          <button
                            key={request.id}
                            onClick={() => {
                              setShowNotifications(false);
                              navigate('/settings?tab=access-requests');
                            }}
                            className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                          >
                            <div className="mt-1 h-2 w-2 rounded-full bg-amber-400" />
                            <div>
                              <p className="text-sm font-medium text-slate-900">{request.fullName}</p>
                              <p className="text-xs text-slate-500">{request.email}</p>
                              <p className="text-xs text-slate-500">
                                Company: {request.company || '-'}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                        You are all caught up.
                      </div>
                    )}
                  </div>
                  <div className="border-t border-slate-100 px-4 py-3">
                    <button
                      onClick={() => {
                        setShowNotifications(false);
                        navigate('/settings?tab=access-requests');
                      }}
                      className="w-full text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                      View access requests
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Settings */}
            <button
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition-colors"
              onClick={() => navigate('/settings')}
              title="Settings"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {/* User avatar */}
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-slate-900">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-slate-500">{user?.role}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center overflow-hidden">
                <span className="text-sm font-medium text-amber-700">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </span>
              </div>
            </div>
          </div>
        </header>

          {/* Page content */}
        <main id="main-content" className="flex-1 p-4 lg:p-6" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
