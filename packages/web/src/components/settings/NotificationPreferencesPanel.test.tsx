import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NotificationPreferencesPanel, { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from './NotificationPreferencesPanel';

function Harness({ canEdit = true, onSave = vi.fn() }: { canEdit?: boolean; onSave?: () => void }) {
  const [values, setValues] = useState<NotificationPreferences>({ ...DEFAULT_NOTIFICATION_PREFERENCES });
  const [saved, setSaved] = useState<NotificationPreferences>({ ...DEFAULT_NOTIFICATION_PREFERENCES });
  return <NotificationPreferencesPanel values={values} savedValues={saved} canEdit={canEdit} onChange={setValues} onSave={() => { onSave(); setSaved({ ...values }); }} onReset={() => setValues({ ...saved })} />;
}

describe('NotificationPreferencesPanel', () => {
  it('renders summary cards, categories, channels, and existing preference types', () => {
    render(<Harness />);
    expect(screen.getByRole('heading', { name: 'Notification Preferences' })).toBeInTheDocument();
    expect(screen.getByText('Active Preferences')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Booking & Front Desk' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rooms & Housekeeping' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'New Bookings notifications' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Check-ins notifications' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Housekeeping Updates notifications' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Daily Reports notifications' })).toBeInTheDocument();
  });

  it('enables save after a change, saves, and resets pending changes', () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    const save = screen.getByRole('button', { name: 'Save preferences' });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole('switch', { name: 'Housekeeping Updates notifications' }));
    expect(save).toBeEnabled();
    expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset changes' }));
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole('switch', { name: 'New Bookings notifications' }));
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('searches, filters, and clears notification preferences', () => {
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText('Search notifications...'), { target: { value: 'CCTV' } });
    expect(screen.getByText('CCTV Offline')).toBeInTheDocument();
    expect(screen.queryByText('New Bookings')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('New Bookings')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Notification priority'), { target: { value: 'Critical' } });
    expect(screen.getByText('Security Alerts')).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Daily Reports notifications' })).not.toBeInTheDocument();
  });

  it('prevents read-only users from changing preferences or delivery channels', () => {
    render(<Harness canEdit={false} />);
    expect(screen.getByText(/read-only access/i)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'New Bookings notifications' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'In-app notifications' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save preferences' })).toBeDisabled();
  });
});
