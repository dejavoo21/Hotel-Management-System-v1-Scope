import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AuditTrailPanel from './AuditTrailPanel';
import type { AuditLogEntry, AuditSettings } from '@/utils/auditLog';

const settings: AuditSettings = {
  retentionDays: 90,
  forwardingEnabled: false,
  forwardingUrl: '',
  forwardingApiKey: '',
};

const logs: AuditLogEntry[] = [
  {
    id: 'audit-1',
    action: 'ACCESS_REQUEST_APPROVED',
    actorId: 'admin-1',
    actorName: 'Onboarding User',
    targetId: 'request-1',
    targetLabel: 'Access request',
    details: { role: 'RECEPTIONIST', setupToken: 'must-not-render' },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'audit-2',
    action: 'USER_DELETED',
    actorId: 'admin-1',
    actorName: 'Onboarding User',
    targetId: 'user-2',
    targetLabel: 'Former user',
    details: { reason: 'Duplicate account' },
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
  {
    id: 'audit-3',
    action: 'AUDIT_EXPORT_GENERATED',
    actorId: 'admin-2',
    actorName: 'Compliance Admin',
    targetId: 'export-1',
    targetLabel: 'Audit export (CSV)',
    details: { format: 'CSV', recordCount: 2, apiKey: 'must-not-render' },
    createdAt: new Date(Date.now() - 172_800_000).toISOString(),
  },
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof AuditTrailPanel>> = {}) {
  const props: React.ComponentProps<typeof AuditTrailPanel> = {
    settings,
    logs,
    onSettingsChange: vi.fn(),
    onSave: vi.fn(),
    onExportJson: vi.fn(),
    onExportCsv: vi.fn(),
    onGenerateReport: vi.fn(),
    ...overrides,
  };
  render(<AuditTrailPanel {...props} />);
  return props;
}

describe('AuditTrailPanel', () => {
  it('renders the enterprise header, status summary, metrics, configuration, and recent activity', () => {
    renderPanel();
    expect(screen.getByRole('heading', { name: 'Audit Trail' })).toBeInTheDocument();
    expect(screen.getByText('Total audit events')).toBeInTheDocument();
    expect(screen.getByText('Events today')).toBeInTheDocument();
    expect(screen.getByText('High-impact changes')).toBeInTheDocument();
    expect(screen.getByText('Access events')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Retention policy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeInTheDocument();
    expect(screen.getByText('Access Request Approved')).toBeInTheDocument();
  });

  it('supports retention presets, forwarding toggle, save, exports, and compliance report actions', async () => {
    const props = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: '180 days' }));
    expect(props.onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ retentionDays: 180 }));
    fireEvent.click(screen.getByRole('switch', { name: 'External log forwarding' }));
    expect(props.onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ forwardingEnabled: true }));
    fireEvent.click(screen.getByRole('button', { name: /save audit settings/i }));
    fireEvent.click(screen.getByRole('button', { name: /export json/i }));
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));
    fireEvent.click(screen.getByRole('button', { name: /generate compliance report/i }));

    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onExportJson).toHaveBeenCalledWith(logs);
    expect(props.onExportCsv).toHaveBeenCalledWith(logs);
    expect(props.onGenerateReport).toHaveBeenCalledWith(logs);
  });

  it('filters by search, category, actor, and severity and clears filters', async () => {
    renderPanel();
    const search = screen.getByPlaceholderText('Search events...');

    fireEvent.change(search, { target: { value: 'Former user' } });
    expect(screen.getByText('User Deleted')).toBeInTheDocument();
    expect(screen.queryByText('Access Request Approved')).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'Filter by event type' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Export' }));
    expect(screen.getByText('Audit Export Generated')).toBeInTheDocument();
    expect(screen.queryByText('User Deleted')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('User Deleted')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Filter by actor' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Compliance Admin' }));
    expect(screen.getByText('Audit Export Generated')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Filter by severity' }));
    fireEvent.click(await screen.findByRole('option', { name: 'High' }));
    expect(screen.getByText('No audit events match your filters.')).toBeInTheDocument();
  });

  it('expands a compact event row and removes secrets from the visible JSON payload', async () => {
    renderPanel();
    const expand = screen.getByRole('button', { name: 'Expand details for Access Request Approved' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(expand);

    expect(screen.getByRole('button', { name: 'Collapse details for Access Request Approved' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Event payload')).toBeInTheDocument();
    expect(screen.getByText(/"role": "RECEPTIONIST"/)).toBeInTheDocument();
    expect(screen.queryByText(/must-not-render/)).not.toBeInTheDocument();
    expect(screen.queryByText(/setupToken/)).not.toBeInTheDocument();
  });

  it('renders forwarding fields only when enabled and masks the API key field', () => {
    renderPanel({ settings: { ...settings, forwardingEnabled: true, forwardingApiKey: 'secret-value' } });
    expect(screen.getByLabelText('Destination URL')).toBeInTheDocument();
    const keyField = screen.getByLabelText('API key');
    expect(keyField).toHaveAttribute('type', 'password');
    expect(keyField).toHaveAttribute('autocomplete', 'new-password');
  });

  it('renders a clear empty state', () => {
    renderPanel({ logs: [] });
    const recentActivity = screen.getByRole('heading', { name: 'Recent Activity' }).closest('section');
    expect(recentActivity).not.toBeNull();
    expect(within(recentActivity as HTMLElement).getByText('No audit events yet.')).toBeInTheDocument();
    expect(screen.getByText('Showing 0 to 0 of 0 events')).toBeInTheDocument();
  });
});
