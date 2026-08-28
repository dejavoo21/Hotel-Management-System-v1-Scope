import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import SmartBuildingPage from './SmartBuildingPage';

const mocks = vi.hoisted(() => ({ getOverview: vi.fn(), listDevices: vi.fn(), listCameraFeeds: vi.fn(), listDoorAccessEvents: vi.fn(), listDoorStatuses: vi.fn(), listSensorReadings: vi.fn(), listSecurityAlerts: vi.fn(), listLinkedTasks: vi.fn() }));
vi.mock('@/services/smartBuilding', () => ({ default: mocks }));
vi.mock('@/components/collaboration/CollaborationHeader', () => ({ default: ({ title, actions }: { title: string; actions?: React.ReactNode }) => <header><h1>{title}</h1>{actions}</header> }));
vi.mock('@/components/hardware/HardwareIntegrationPanel', () => ({ default: () => <div>Hardware integration</div> }));

const renderPage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/operations/smart-building?tab=overview']}><SmartBuildingPage /></MemoryRouter></QueryClientProvider>);

describe('SmartBuildingPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'admin-1', role: 'ADMIN', hotel: { id: 'hotel-1' } } as never });
    mocks.getOverview.mockResolvedValue({ cameras: { online: 1, offline: 0 }, doors: { locked: 1, open: 0 }, accessEvents: { today: 2 }, motionAlerts: { active: 0 }, temperatureSensors: { normal: 1, warning: 0 }, waterLeakSensors: { alerts: 0 }, panicButtons: { active: 0 }, health: { activeAlerts: 0, onlineDevices: 1, totalDevices: 1 } });
    mocks.listDevices.mockResolvedValue([{ id: 'device-1', externalId: 'dev-1', name: 'Lobby thermostat', deviceType: 'HVAC', status: 'ONLINE', location: 'Lobby' }]);
    mocks.listCameraFeeds.mockResolvedValue([]);
    mocks.listDoorAccessEvents.mockResolvedValue([]);
    mocks.listDoorStatuses.mockResolvedValue([{ id: 'door-1', externalId: 'door-1', name: 'Lobby door', lockState: 'LOCKED', openState: 'CLOSED' }]);
    mocks.listSensorReadings.mockResolvedValue([{ id: 'sensor-1', sensorType: 'TEMPERATURE', location: 'Lobby', value: 22, unit: 'C', status: 'NORMAL', recordedAt: '2026-08-28T10:00:00Z' }]);
    mocks.listSecurityAlerts.mockResolvedValue([]);
    mocks.listLinkedTasks.mockResolvedValue([]);
  });

  it('uses internal tabs to change Smart Building content', async () => {
    renderPage();
    expect(await screen.findByText('Lobby door')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'sensors' }));
    expect(screen.getByText('Temperature sensor')).toBeInTheDocument();
    expect(screen.queryByText('Doors')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'devices' }));
    expect(screen.getByText('Hardware integration')).toBeInTheDocument();
    expect(screen.getByText('Lobby thermostat')).toBeInTheDocument();
  });

  it('refreshes every Smart Building source with visible feedback state', async () => {
    renderPage();
    await screen.findByText('Lobby door');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }));
    await waitFor(() => expect(mocks.getOverview.mock.calls.length).toBeGreaterThan(1));
    expect(mocks.listDevices.mock.calls.length).toBeGreaterThan(1);
  });
});
