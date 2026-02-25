import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { PresenceStatus, EffectiveStatus } from '@/types';
import { authService } from '@/services/auth';
import { usePresenceStore, getPresenceLabel } from '@/stores/presenceStore';
import { PresenceDot } from './PresenceDot';

interface PresenceMenuProps {
  currentStatus: EffectiveStatus;
  isConnected: boolean;
  onStatusChange?: (status: PresenceStatus) => void;
}

const PRESENCE_OPTIONS: { value: PresenceStatus; label: string; color: string }[] = [
  { value: 'AVAILABLE', label: 'Available', color: 'bg-green-500' },
  { value: 'BUSY', label: 'Busy', color: 'bg-amber-500' },
  { value: 'AWAY', label: 'Away', color: 'bg-yellow-500' },
  { value: 'DND', label: 'Do Not Disturb', color: 'bg-red-500' },
];

/**
 * Presence status dropdown menu (Teams-style)
 * Allows user to change their presence status
 */
export function PresenceMenu({ 
  currentStatus, 
  isConnected,
  onStatusChange,
}: PresenceMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const setMyPresence = usePresenceStore((s) => s.setMyPresence);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Mutation to update presence via API
  const updatePresenceMutation = useMutation({
    mutationFn: (status: PresenceStatus) => authService.updatePresence(status),
    onMutate: (status) => {
      // Optimistic update
      setMyPresence(status);
    },
    onSuccess: (data) => {
      onStatusChange?.(data.presenceStatus);
    },
    onError: (error, _status) => {
      // Revert on error
      toast.error('Failed to update status');
      console.error('Presence update failed:', error);
    },
  });

  const handleStatusSelect = (status: PresenceStatus) => {
    if (!isConnected) {
      toast.error('Cannot change status while offline');
      return;
    }
    
    updatePresenceMutation.mutate(status);
    setIsOpen(false);
  };

  const displayStatus = !isConnected ? 'OFFLINE' : currentStatus;
  const displayLabel = getPresenceLabel(displayStatus);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={!isConnected}
        className={`
          flex items-center gap-2 rounded-lg px-2 py-1 text-sm
          transition-colors
          ${isConnected 
            ? 'hover:bg-slate-100 cursor-pointer' 
            : 'cursor-not-allowed opacity-60'
          }
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Current status: ${displayLabel}. Click to change.`}
      >
        <PresenceDot status={displayStatus} size="sm" showBorder={false} />
        <span className="text-slate-600">{displayLabel}</span>
        {isConnected && (
          <svg
            className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="py-1">
            {PRESENCE_OPTIONS.map((option) => {
              const isSelected = currentStatus === option.value;
              
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleStatusSelect(option.value)}
                  className={`
                    flex w-full items-center gap-3 px-4 py-2.5 text-sm
                    transition-colors
                    ${isSelected 
                      ? 'bg-primary-50 text-primary-700' 
                      : 'text-slate-700 hover:bg-slate-50'
                    }
                  `}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${option.color}`} />
                  <span className="flex-1 text-left">{option.label}</span>
                  {isSelected && (
                    <svg className="h-4 w-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
          
          {!isConnected && (
            <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
              You appear offline to others
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PresenceMenu;
