import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuditSettings, sanitizeAuditEntry, saveAuditSettings } from './auditLog';

describe('audit log security', () => {
  beforeEach(() => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it('removes nested secrets from event payloads', () => {
    const safe = sanitizeAuditEntry({
      id: 'audit-1',
      action: 'SYSTEM_UPDATED',
      createdAt: new Date().toISOString(),
      details: {
        destination: 'Splunk Audit Index',
        nested: { authorization: 'Bearer secret', status: 'enabled' },
      },
    });

    expect(safe.details).toEqual({
      destination: 'Splunk Audit Index',
      nested: { status: 'enabled' },
    });
  });

  it('never persists forwarding credentials in browser storage', () => {
    saveAuditSettings({
      retentionDays: 90,
      forwardingEnabled: true,
      forwardingUrl: 'https://logs.example.com/ingest',
      forwardingApiKey: 'must-not-persist',
    });

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'laflo:auditSettings',
      JSON.stringify({
        retentionDays: 90,
        forwardingEnabled: true,
        forwardingUrl: 'https://logs.example.com/ingest',
      })
    );
  });

  it('drops legacy stored credentials when settings are loaded', () => {
    vi.mocked(localStorage.getItem).mockImplementation((key) =>
      key === 'laflo:auditSettings'
        ? JSON.stringify({
            retentionDays: 180,
            forwardingEnabled: true,
            forwardingUrl: 'https://logs.example.com/ingest',
            forwardingApiKey: 'legacy-secret',
          })
        : null
    );

    expect(getAuditSettings()).toEqual({
      retentionDays: 180,
      forwardingEnabled: true,
      forwardingUrl: 'https://logs.example.com/ingest',
      forwardingApiKey: '',
    });
  });
});
