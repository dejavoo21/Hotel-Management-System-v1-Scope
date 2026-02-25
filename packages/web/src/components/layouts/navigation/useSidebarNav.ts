import { useState, useCallback, useRef, useEffect } from 'react';

export type SidebarNavState = {
  openSection: string | null;
  lockedSection: string | null;
  hoveredSection: string | null;
  isMobileOpen: boolean;
};

export function useSidebarNav() {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [lockedSection, setLockedSection] = useState<string | null>(null);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The effective open section: locked takes priority, then hovered
  const effectiveOpenSection = lockedSection || hoveredSection;

  // Handle hover on icon - opens flyout as preview (unless locked to another section)
  const handleIconHover = useCallback((sectionId: string) => {
    // Clear any pending leave timeout
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    
    // If locked to a different section, don't change on hover
    if (lockedSection && lockedSection !== sectionId) {
      return;
    }
    
    // Small delay before showing flyout on hover
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredSection(sectionId);
      if (!lockedSection) {
        setOpenSection(sectionId);
      }
    }, 100);
  }, [lockedSection]);

  // Handle hover leave
  const handleIconLeave = useCallback(() => {
    // Clear pending hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    // If locked, don't close on leave
    if (lockedSection) {
      return;
    }
    
    // Small delay before closing to allow moving to flyout
    leaveTimeoutRef.current = setTimeout(() => {
      setHoveredSection(null);
      setOpenSection(null);
    }, 150);
  }, [lockedSection]);

  // Handle click on icon - toggles lock
  const handleIconClick = useCallback((sectionId: string) => {
    if (lockedSection === sectionId) {
      // Already locked to this section, unlock
      setLockedSection(null);
      setOpenSection(null);
    } else {
      // Lock to this section
      setLockedSection(sectionId);
      setOpenSection(sectionId);
    }
  }, [lockedSection]);

  // Handle flyout hover - keep it open
  const handleFlyoutEnter = useCallback(() => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  }, []);

  // Handle flyout leave
  const handleFlyoutLeave = useCallback(() => {
    if (lockedSection) return;
    
    leaveTimeoutRef.current = setTimeout(() => {
      setHoveredSection(null);
      setOpenSection(null);
    }, 150);
  }, [lockedSection]);

  // Close flyout (e.g., clicking outside or pressing Escape)
  const closeFlyout = useCallback(() => {
    setLockedSection(null);
    setHoveredSection(null);
    setOpenSection(null);
  }, []);

  // Handle keyboard
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closeFlyout();
    }
  }, [closeFlyout]);

  // Toggle mobile sidebar
  const toggleMobile = useCallback(() => {
    setIsMobileOpen(prev => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    };
  }, []);

  // Global keyboard listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    openSection: effectiveOpenSection,
    lockedSection,
    hoveredSection,
    isMobileOpen,
    isLocked: Boolean(lockedSection),
    handleIconHover,
    handleIconLeave,
    handleIconClick,
    handleFlyoutEnter,
    handleFlyoutLeave,
    closeFlyout,
    toggleMobile,
    closeMobile,
  };
}
