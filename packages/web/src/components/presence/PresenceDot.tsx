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
  xs: 'h-1.5 w-1.5',
  sm: 'h-2 w-2',
  md: 'h-3 w-3',
  lg: 'h-4 w-4',
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
        inline-block rounded-full
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
