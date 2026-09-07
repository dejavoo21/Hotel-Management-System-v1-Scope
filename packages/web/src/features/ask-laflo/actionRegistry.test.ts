import { describe, expect, it } from 'vitest';
import { findAskLafloActions, resolveAskLafloAction } from './actionRegistry';

const admin = { id: 'admin-1', role: 'ADMIN', modulePermissions: [] };
const frontDesk = { id: 'user-1', role: 'STAFF', modulePermissions: ['bookings'] };

describe('Ask LaFlo action registry', () => {
  it('resolves executable route actions', () => {
    expect(resolveAskLafloAction('navigate.toOperationsCenter', admin)).toMatchObject({ status: 'ready', route: '/operations-center', execution: 'navigate' });
    expect(findAskLafloActions('Open the Operations Center', admin)[0]).toMatchObject({ id: 'navigate.toOperationsCenter', status: 'ready' });
  });

  it('blocks actions when the user lacks permission', () => {
    expect(resolveAskLafloAction('alert.acknowledge', frontDesk)).toMatchObject({ status: 'restricted', permission: 'security_center' });
  });

  it('never pretends a future provider is connected', () => {
    expect(resolveAskLafloAction('integration.connectFutureProvider', admin)).toMatchObject({ status: 'unavailable', execution: 'unavailable' });
  });
});
