import { describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import {
  PLATFORM_INTERFACES,
  findPlatformInterface,
  getAuthorisedInterfaces,
} from './platformKnowledge.js';

describe('platform assistant knowledge', () => {
  it('covers every major LaFlo interface family', () => {
    const ids = new Set(PLATFORM_INTERFACES.map((item) => item.id));
    [
      'dashboard', 'bookings', 'guests', 'rooms', 'housekeeping', 'inventory',
      'calendar', 'financials', 'reports', 'messages', 'calls', 'search',
      'hotel-brain', 'security', 'cctv', 'incidents', 'smart-building',
      'maintenance', 'users', 'settings', 'integrations',
    ].forEach((id) => expect(ids.has(id)).toBe(true));
  });

  it('finds interfaces from natural platform questions', () => {
    expect(findPlatformInterface('How do I review CCTV cameras?')?.id).toBe('cctv');
    expect(findPlatformInterface('Where can I approve a staff access request?')?.id).toBe('users');
    expect(findPlatformInterface('Show me preventive maintenance')?.id).toBe('maintenance');
  });

  it('only exposes interfaces permitted for a non-admin user', () => {
    const items = getAuthorisedInterfaces(Role.RECEPTIONIST, ['dashboard', 'bookings', 'guests']);
    const ids = items.map((item) => item.id);
    expect(ids).toContain('bookings');
    expect(ids).toContain('guests');
    expect(ids).not.toContain('financials');
    expect(ids).not.toContain('security');
    expect(ids).not.toContain('users');
  });

  it('allows administrators to receive the complete interface catalogue', () => {
    expect(getAuthorisedInterfaces(Role.ADMIN, [])).toHaveLength(PLATFORM_INTERFACES.length);
  });
});
