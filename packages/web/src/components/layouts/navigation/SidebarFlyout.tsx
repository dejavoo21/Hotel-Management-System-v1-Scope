import { memo, useMemo, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { navSections, type NavItem } from './navConfig';
import { NavIcon } from './NavIcon';
import { getUserPermissions, isSuperAdminUser, type PermissionId, type UserRole } from '@/utils/userAccess';
import { useAuthStore } from '@/stores/authStore';

type SidebarFlyoutProps = {
  openSection: string | null;
  isLocked: boolean;
  onFlyoutEnter: () => void;
  onFlyoutLeave: () => void;
  onItemClick: () => void;
  onClickOutside: () => void;
  accessRequestBadge?: number;
};

export const SidebarFlyout = memo(function SidebarFlyout({
  openSection,
  isLocked,
  onFlyoutEnter,
  onFlyoutLeave,
  onItemClick,
  onClickOutside,
  accessRequestBadge = 0,
}: SidebarFlyoutProps) {
  const { user } = useAuthStore();
  const location = useLocation();
  const flyoutRef = useRef<HTMLDivElement>(null);

  const userPermissions = useMemo(
    () => getUserPermissions(user?.id, user?.role),
    [user?.id, user?.role]
  );
  const isSuperAdmin = isSuperAdminUser(user?.id);
  
  const hasAccess = (permission?: PermissionId) =>
    !permission || isSuperAdmin || userPermissions.includes(permission);
  
  const hasRoleAccess = (roles?: UserRole[]) =>
    !roles || roles.includes((user?.role || '') as UserRole);

  // Get current section
  const currentSection = useMemo(() => {
    if (!openSection) return null;
    return navSections.find(s => s.id === openSection) || null;
  }, [openSection]);

  // Filter items user has access to
  const visibleItems = useMemo(() => {
    if (!currentSection) return [];
    return currentSection.items.filter(item =>
      hasAccess(item.permission) && hasRoleAccess(item.roles)
    );
  }, [currentSection, userPermissions, isSuperAdmin, user?.role]);

  // Click outside handler
  useEffect(() => {
    if (!openSection || !isLocked) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (flyoutRef.current && !flyoutRef.current.contains(target)) {
        // Check if click is on the rail
        const railElement = document.querySelector('[data-sidebar-rail]');
        if (railElement && railElement.contains(target)) {
          return; // Let rail handle its own clicks
        }
        onClickOutside();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openSection, isLocked, onClickOutside]);

  if (!openSection || !currentSection) {
    return null;
  }

  const isItemActive = (item: NavItem): boolean => {
    if (item.href === '/') return location.pathname === '/';
    return location.pathname.startsWith(item.href);
  };

  return (
    <div
      ref={flyoutRef}
      className={`
        absolute left-[68px] top-0 h-full w-56 bg-white
        border-r border-slate-200/80
        shadow-xl shadow-slate-200/50
        transform transition-transform duration-200 ease-out
        ${openSection ? 'translate-x-0' : '-translate-x-full'}
        z-40
      `}
      style={{
        backdropFilter: 'blur(8px)',
      }}
      onMouseEnter={onFlyoutEnter}
      onMouseLeave={onFlyoutLeave}
      role="menu"
      aria-label={`${currentSection.label} navigation`}
    >
      {/* Section header */}
      <div className="flex items-center gap-3 h-16 px-5 border-b border-slate-100">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600">
          <NavIcon name={currentSection.icon} className="h-4 w-4" />
        </div>
        <h2 className="text-sm font-semibold text-slate-800 tracking-tight">
          {currentSection.label}
        </h2>
        {isLocked && (
          <span className="ml-auto px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 rounded">
            Pinned
          </span>
        )}
      </div>

      {/* Navigation items */}
      <nav className="flex flex-col gap-0.5 p-3" aria-label={`${currentSection.label} menu`}>
        {visibleItems.map((item) => {
          const isActive = isItemActive(item);
          const showBadge = item.id === 'settings' && accessRequestBadge > 0;

          return (
            <NavLink
              key={item.id}
              to={item.href}
              onClick={onItemClick}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg
                text-sm font-medium
                transition-all duration-150
                focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400
                ${isActive
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }
              `}
              role="menuitem"
            >
              <NavIcon 
                name={item.icon} 
                className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} 
              />
              <span className="flex-1">{item.label}</span>
              
              {/* Active indicator */}
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
              
              {/* Badge for settings */}
              {showBadge && !isActive && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
                  {accessRequestBadge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Section-specific quick actions */}
      {currentSection.id === 'operations' && (
        <div className="mx-3 mt-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
          <p className="text-xs font-medium text-slate-500 mb-2">Quick Stats</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center">
              <p className="text-lg font-semibold text-slate-800">—</p>
              <p className="text-[10px] text-slate-500">Arrivals</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-slate-800">—</p>
              <p className="text-[10px] text-slate-500">Departures</p>
            </div>
          </div>
        </div>
      )}

      {currentSection.id === 'guest' && (
        <div className="mx-3 mt-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
          <p className="text-xs font-medium text-slate-500 mb-2">Support Queue</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs text-slate-600">Online and ready</p>
          </div>
        </div>
      )}
    </div>
  );
});
