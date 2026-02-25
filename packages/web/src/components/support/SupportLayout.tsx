import { useState, useCallback, memo, ReactNode } from 'react';
import { PresenceDot } from '@/components/presence';
import { usePresenceStore } from '@/stores/presenceStore';
import { useAuthStore } from '@/stores/authStore';

type SupportRailItem = 'activity' | 'chat' | 'calls' | 'files';

interface SupportLayoutProps {
  children: ReactNode;
  activeRailItem?: SupportRailItem;
  onRailItemChange?: (item: SupportRailItem) => void;
  rightPanelContent?: ReactNode;
  rightPanelTitle?: string;
  rightPanelOpen?: boolean;
  onRightPanelClose?: () => void;
}

const railItems: { id: SupportRailItem; label: string; icon: ReactNode }[] = [
  {
    id: 'activity',
    label: 'Activity',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    id: 'calls',
    label: 'Calls',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
  },
  {
    id: 'files',
    label: 'Files',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

/**
 * Left vertical rail for Teams-style navigation
 */
const SupportRail = memo(function SupportRail({
  activeItem,
  onItemClick,
}: {
  activeItem: SupportRailItem;
  onItemClick: (item: SupportRailItem) => void;
}) {
  const { user } = useAuthStore();
  const { getEffectiveStatus, isConnected } = usePresenceStore();
  const userStatus = user ? getEffectiveStatus(user.id, true) : 'OFFLINE';
  const effectiveStatus = isConnected ? userStatus : 'OFFLINE';

  return (
    <div className="flex flex-col h-full w-16 bg-slate-800 border-r border-slate-700">
      {/* Logo/Brand */}
      <div className="flex items-center justify-center h-14 border-b border-slate-700">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center">
          <span className="text-white font-bold text-lg">L</span>
        </div>
      </div>

      {/* Rail Navigation Items */}
      <nav className="flex-1 py-3 flex flex-col">
        {railItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onItemClick(item.id)}
            className={`
              relative flex flex-col items-center justify-center py-3 mx-2 rounded-lg
              transition-colors group
              ${activeItem === item.id 
                ? 'bg-slate-700 text-white' 
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }
            `}
            title={item.label}
          >
            {/* Active indicator */}
            {activeItem === item.id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-sky-500 rounded-r-full" />
            )}
            {item.icon}
            <span className="text-[10px] mt-1 font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* User Avatar with Presence at Bottom */}
      <div className="p-3 border-t border-slate-700">
        <div className="relative flex items-center justify-center">
          <div className="w-9 h-9 rounded-full bg-slate-600 flex items-center justify-center">
            <span className="text-xs font-semibold text-white">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          <div className="absolute -bottom-0.5 -right-0.5">
            <PresenceDot status={effectiveStatus} size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * Right slide-out panel with animation
 */
const RightPanel = memo(function RightPanel({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 bg-slate-900/20 z-40
          transition-opacity duration-200
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`
          fixed right-0 top-0 h-full w-80 bg-white shadow-2xl z-50
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-52px)]">
          {children}
        </div>
      </div>
    </>
  );
});

/**
 * Teams-style Support Layout
 * 
 * Structure:
 * - Left rail (64px): Icon navigation
 * - Main content area (flex): Children content
 * - Right panel (320px, slide-out): Context details
 */
export function SupportLayout({
  children,
  activeRailItem = 'chat',
  onRailItemChange,
  rightPanelContent,
  rightPanelTitle = 'Details',
  rightPanelOpen = false,
  onRightPanelClose,
}: SupportLayoutProps) {
  const [localActiveItem, setLocalActiveItem] = useState<SupportRailItem>(activeRailItem);

  const handleRailItemClick = useCallback((item: SupportRailItem) => {
    setLocalActiveItem(item);
    onRailItemChange?.(item);
  }, [onRailItemChange]);

  const handlePanelClose = useCallback(() => {
    onRightPanelClose?.();
  }, [onRightPanelClose]);

  return (
    <div className="flex h-[calc(100vh-72px)]">
      {/* Left Rail */}
      <SupportRail
        activeItem={onRailItemChange ? activeRailItem : localActiveItem}
        onItemClick={handleRailItemClick}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {children}
      </div>

      {/* Right Panel */}
      <RightPanel
        isOpen={rightPanelOpen}
        onClose={handlePanelClose}
        title={rightPanelTitle}
      >
        {rightPanelContent}
      </RightPanel>
    </div>
  );
}

export default SupportLayout;
