import { useMemo } from 'react';
import type { EffectiveStatus } from '@/types';
import { getPresenceDotColor } from '@/stores/presenceStore';

interface PresenceDotProps {
  status: EffectiveStatus;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showBorder?: boolean;
}

const sizeClasses = {
  xs: 'h-2 w-2',
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

/**
 * Presence status indicator dot (Teams-style)
 * - Green: Available
 * - Amber: Busy
 * - Yellow: Away
 * - Red: Do Not Disturb
 * - Gray: Offline
 */
export function PresenceDot({ 
  status, 
  size = 'md', 
  className = '',
  showBorder = true,
}: PresenceDotProps) {
  const colorClass = useMemo(() => getPresenceDotColor(status), [status]);
  
  return (
    <span
      className={`
        inline-block rounded-full shadow-sm
        ${sizeClasses[size]}
        ${colorClass}
        ${showBorder ? 'ring-2 ring-white' : ''}
        ${className}
      `}
      role="status"
      aria-label={`Status: ${status.toLowerCase()}`}
    />
  );
}

export default PresenceDot;
