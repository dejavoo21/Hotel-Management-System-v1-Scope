import { describe, expect, it } from 'vitest';
import { canAccessRoute } from './access';

describe('Operations route access', () => {
  const bookingsUser = { id: 'ops-1', role: 'STAFF', modulePermissions: ['bookings'] };
  const financeUser = { id: 'finance-1', role: 'STAFF', modulePermissions: ['financials'] };

  it('protects every canonical Operations workspace with its owning permission', () => {
    expect(canAccessRoute(bookingsUser, '/operations-center')).toBe(true);
    expect(canAccessRoute(bookingsUser, '/operations/tasks-advisories')).toBe(true);
    expect(canAccessRoute(bookingsUser, '/operations/enterprise-search')).toBe(true);
    expect(canAccessRoute(financeUser, '/operations/tasks-advisories')).toBe(false);
  });

  it('requires financial access for canonical Revenue Guidance', () => {
    expect(canAccessRoute(financeUser, '/operations/operational-intelligence/revenue-guidance')).toBe(true);
    expect(canAccessRoute(bookingsUser, '/operations/operational-intelligence/revenue-guidance')).toBe(false);
  });
});
