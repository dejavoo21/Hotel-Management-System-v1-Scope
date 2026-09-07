import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import ConciergePage from './ConciergePage';

describe('ConciergePage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: { id: 'admin-1', email: 'admin@laflo.test', firstName: 'Admin', lastName: 'User', role: 'ADMIN' } as never });
  });

  it('renders the operational summary, staff table, and working filters', async () => {
    render(<ConciergePage />);

    expect(screen.getByRole('heading', { name: 'Concierge' })).toBeInTheDocument();
    expect(screen.getByText('Total Concierge Staff')).toBeInTheDocument();
    expect(screen.getByText('Open Guest Requests')).toBeInTheDocument();
    expect(screen.getByText('Bebe W. Cullen')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search concierge staff' }), { target: { value: 'ELC003' } });
    expect(screen.getByText('Sofia Reed')).toBeInTheDocument();
    expect(screen.queryByText('Bebe W. Cullen')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Bebe W. Cullen')).toBeInTheDocument();
  });

  it('switches to card view and supports adding a validated team member', async () => {
    render(<ConciergePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Card view' }));
    expect(screen.getByRole('button', { name: 'Card view' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Add Concierge' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Full Name *'), { target: { value: 'Maya Patel' } });
    fireEvent.change(within(dialog).getByLabelText('Employee ID *'), { target: { value: 'ELC004' } });
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'maya@example.com' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add team member' }));
    expect(screen.getByText('Maya Patel')).toBeInTheDocument();
  });

  it('requires confirmation before deactivation and hides management actions for read-only users', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { rerender } = render(<ConciergePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Actions for Bebe W. Cullen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    expect(confirm).toHaveBeenCalled();

    act(() => useAuthStore.setState({ user: { id: 'viewer-1', email: 'viewer@laflo.test', firstName: 'View', lastName: 'Only', role: 'RECEPTIONIST' } as never }));
    rerender(<ConciergePage />);
    expect(screen.queryByRole('button', { name: 'Add Concierge' })).not.toBeInTheDocument();
    confirm.mockRestore();
  });
});
