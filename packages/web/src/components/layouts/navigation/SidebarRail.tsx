import { memo, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { navSections, type NavSection } from './navConfig';
import { NavIcon } from './NavIcon';
import { getUserPermissions, isSuperAdminUser, type PermissionId, type UserRole } from '@/utils/userAccess';
import { useAuthStore } from '@/stores/authStore';

type SidebarRailProps = {
  openSection: string | null;
  lockedSection: string | null;
  onIconHover: (sectionId: string) => void;
  onIconLeave: () => void;
  onIconClick: (sectionId: string) => void;
  accessRequestBadge?: number;
};

export const SidebarRail = memo(function SidebarRail({
  openSection,
  lockedSection,
  onIconHover,
  onIconLeave,
  onIconClick,
  accessRequestBadge = 0,
}: SidebarRailProps) {
  const { user } = useAuthStore();
  const location = useLocation();

  const userPermissions = useMemo(
    () => getUserPermissions(user?.id, user?.role),
    [user?.id, user?.role]
  );
  const isSuperAdmin = isSuperAdminUser(user?.id);
  
  const hasAccess = (permission?: PermissionId) =>
    !permission || isSuperAdmin || userPermissions.includes(permission);
  
  const hasRoleAccess = (roles?: UserRole[]) =>
    !roles || roles.includes((user?.role || '') as UserRole);

  // Filter sections to only show those user has access to
  const visibleSections = useMemo(() => {
    return navSections.filter(section => {
      // Check if section itself has permission requirements
      if (section.permission && !hasAccess(section.permission)) return false;
      if (section.roles && !hasRoleAccess(section.roles)) return false;
      
      // Check if at least one item in section is accessible
      return section.items.some(item => 
        hasAccess(item.permission) && hasRoleAccess(item.roles)
      );
    });
  }, [userPermissions, isSuperAdmin, user?.role]);

  // Check if current route is within a section
  const isRouteInSection = (section: NavSection): boolean => {
    return section.items.some(item => {
      if (item.href === '/') return location.pathname === '/';
      return location.pathname.startsWith(item.href);
    });
  };

  // Split sections into top and bottom groups
  const topSections = visibleSections.filter(s => 
    ['dashboard', 'operations', 'guest'].includes(s.id)
  );
  const bottomSections = visibleSections.filter(s => 
    ['backoffice', 'experience', 'admin'].includes(s.id)
  );

  const renderIcon = (section: NavSection) => {
    const isActive = openSection === section.id;
    const isLocked = lockedSection === section.id;
    const hasActiveRoute = isRouteInSection(section);
    const showBadge = section.id === 'admin' && accessRequestBadge > 0;

    return (
      <button
        key={section.id}
        type="button"
        className={`
          relative flex items-center justify-center w-11 h-11 rounded-xl
          transition-all duration-200 ease-out
          focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2
          ${isActive || isLocked
            ? 'bg-slate-800 text-white shadow-lg scale-105'
            : hasActiveRoute
            ? 'bg-slate-100 text-slate-700'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          }
        `}
        onMouseEnter={() => onIconHover(section.id)}
        onMouseLeave={onIconLeave}
        onClick={() => onIconClick(section.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onIconClick(section.id);
          }
        }}
        aria-label={section.label}
        aria-expanded={isActive}
        aria-haspopup="menu"
        title={section.label}
      >
        <NavIcon name={section.icon} className="h-5 w-5" />
        
        {/* Lock indicator */}
        {isLocked && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full" />
        )}
        
        {/* Badge */}
        {showBadge && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {accessRequestBadge > 9 ? '9+' : accessRequestBadge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full w-[68px] bg-white border-r border-slate-200/80 shrink-0">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 border-b border-slate-100">
        <img 
          src="/laflo-logo.png" 
          alt="LaFlo" 
          className="h-10 w-10 object-contain"
        />
      </div>

      {/* Top navigation icons */}
      <nav className="flex-1 flex flex-col items-center gap-1.5 py-4 px-2" aria-label="Main navigation">
        {topSections.map(renderIcon)}
        
        {/* Divider */}
        <div className="w-8 h-px bg-slate-200 my-2" role="separator" />
        
        {bottomSections.map(renderIcon)}
      </nav>

      {/* Bottom spacer for user menu alignment */}
      <div className="h-16 border-t border-slate-100" />
    </div>
  );
});
