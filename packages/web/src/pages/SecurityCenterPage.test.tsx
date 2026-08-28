import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import SecurityCenterPage from './SecurityCenterPage';

const mocks = vi.hoisted(() => ({ getOverview: vi.fn(), listCctv: vi.fn(), listAccessLogs: vi.fn(), listVisitors: vi.fn(), createVisitor: vi.fn(), checkoutVisitor: vi.fn(), listAlerts: vi.fn(), listTasks: vi.fn(), acknowledgeAlert: vi.fn(), resolveAlert: vi.fn() }));
vi.mock('@/services/securityCenter', () => ({ default: mocks }));
vi.mock('@/components/collaboration/CollaborationHeader', () => ({ default: ({ title, actions }: { title: string; actions?: React.ReactNode }) => <header><h1>{title}</h1>{actions}</header> }));
vi.mock('@/components/operations/DepartmentIntelligenceCard', () => ({ default: () => <div>Security intelligence</div> }));
vi.mock('@/components/hardware/HardwareIntegrationPanel', () => ({ default: () => <div>Hardware integration</div> }));

const renderPage = (route = '/security-center/alerts') => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[route]}><Routes><Route path="/security-center" element={<SecurityCenterPage />} /><Route path="/security-center/:tab" element={<SecurityCenterPage />} /></Routes></MemoryRouter></QueryClientProvider>);

describe('SecurityCenterPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'admin-1', role: 'ADMIN', hotel: { id: 'hotel-1' } } as never });
    mocks.getOverview.mockResolvedValue({ cctv: { total: 2, online: 1, offline: 1 }, accessEvents: { today: 3 }, visitors: { onsite: 1 }, alerts: { open: 1 }, smartBuildingTasks: { security: 0 }, recentActivity: [] });
    mocks.listCctv.mockResolvedValue([]);
    mocks.listAccessLogs.mockResolvedValue([]);
    mocks.listVisitors.mockResolvedValue([]);
    mocks.listTasks.mockResolvedValue([]);
    mocks.listAlerts.mockResolvedValue([{ id: 'alert-1', alertType: 'FORCED_DOOR', severity: 'HIGH', status: 'ACTIVE', title: 'Forced door', occurredAt: '2026-08-28T10:00:00Z' }]);
    mocks.acknowledgeAlert.mockResolvedValue({ id: 'alert-1', status: 'ACKNOWLEDGED' });
    mocks.resolveAlert.mockResolvedValue({ id: 'alert-1', status: 'RESOLVED' });
  });

  it('uses internal security tabs and the single Ask LaFlo assistant', async () => {
    const openAssistant = vi.fn();
    window.addEventListener('laflo:open-assistant', openAssistant);
    renderPage();
    expect(await screen.findByText('Forced door')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Security Center tabs' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'CCTV' })).toBeInTheDocument();
    expect(screen.queryByText('Security Copilot')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ask LaFlo' }));
    expect(openAssistant).toHaveBeenCalledTimes(1);
    window.removeEventListener('laflo:open-assistant', openAssistant);
  });

  it('updates alerts and exposes refresh feedback state', async () => {
    renderPage();
    await screen.findByText('Forced door');
    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));
    await waitFor(() => expect(mocks.acknowledgeAlert.mock.calls[0]?.[0]).toBe('alert-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh security' }));
    await waitFor(() => expect(mocks.getOverview.mock.calls.length).toBeGreaterThan(1));
  });

  it('exposes required alert actions and clear unavailable states', async () => {
    renderPage();
    await screen.findByText('Forced door');
    expect(screen.getByRole('button', { name: 'View details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create task unavailable' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Assign unavailable' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'View details' }));
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });
});
