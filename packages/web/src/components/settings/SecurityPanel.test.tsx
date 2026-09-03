import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SecurityPanel from './SecurityPanel';

const defaults = {
  twoFactorEnabled: false,
  passwordLoading: false,
  twoFactorLoading: false,
  sessions: [{ id: 'current', userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/126.0', ipAddress: '203.0.113.45', createdAt: new Date().toISOString(), lastActiveAt: new Date().toISOString(), isCurrent: true }],
  sessionsLoading: false,
  sessionsError: false,
  sessionActionLoading: false,
  onPasswordChange: vi.fn().mockResolvedValue(undefined),
  onEnableTwoFactor: vi.fn(),
  onRetrySessions: vi.fn(),
  onRevokeOtherSessions: vi.fn().mockResolvedValue(undefined),
  onRevokeSession: vi.fn().mockResolvedValue(undefined),
};

describe('SecurityPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders the target security sections and current session safely', () => {
    render(<SecurityPanel {...defaults} />);
    expect(screen.getByRole('heading', { name: 'Security' })).toBeInTheDocument();
    expect(screen.getByText('Password updated')).toBeInTheDocument();
    expect(screen.getByText('Active sessions')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Change Password' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Two-Factor Authentication' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Authentication Options' })).toBeInTheDocument();
    expect(screen.getByText('Passkey (Biometric or Device PIN)')).toBeInTheDocument();
    expect(screen.getByText('Sign in using a passkey secured by Face ID, Touch ID, Windows Hello, or your device PIN.')).toBeInTheDocument();
    expect(screen.getByText('Passphrase')).toBeInTheDocument();
    expect(screen.getByText('Use a memorable security phrase as an additional verification method where supported.')).toBeInTheDocument();
    expect(screen.getAllByText('Coming soon')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Session Security' })).toBeInTheDocument();
    expect(screen.getByText('Authenticator App')).toBeInTheDocument();
    expect(screen.getByText('SMS Backup')).toBeInTheDocument();
    expect(screen.getByText('Recovery Codes')).toBeInTheDocument();
    expect(screen.getByText('Current session')).toBeInTheDocument();
    expect(screen.getByText('Windows · Chrome')).toBeInTheDocument();
    expect(screen.getByText('IP 203.0.113.•••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out all other sessions' })).toBeDisabled();
  });

  it('confirms and revokes other active sessions', async () => {
    const onRevokeOtherSessions = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SecurityPanel {...defaults} sessions={[...defaults.sessions, { ...defaults.sessions[0], id: 'other', userAgent: 'Mozilla/5.0 (iPhone) Safari/605.1', isCurrent: false }]} onRevokeOtherSessions={onRevokeOtherSessions} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out all other sessions' }));
    await waitFor(() => expect(onRevokeOtherSessions).toHaveBeenCalledTimes(1));
    vi.restoreAllMocks();
  });

  it('toggles password visibility without exposing values by default', () => {
    render(<SecurityPanel {...defaults} />);
    const current = screen.getByLabelText('Current Password');
    expect(current).toHaveAttribute('type', 'password');
    fireEvent.change(current, { target: { value: 'Secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show current password' }));
    expect(current).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide current password' }));
    expect(current).toHaveAttribute('type', 'password');
  });

  it('validates complexity and confirmation before updating the password', async () => {
    const onPasswordChange = vi.fn().mockResolvedValue(undefined);
    render(<SecurityPanel {...defaults} onPasswordChange={onPasswordChange} />);
    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'OldPassword1' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'weak' } });
    fireEvent.blur(screen.getByLabelText('New Password'));
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update Password' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'StrongPassword1!' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'DifferentPassword1!' } });
    fireEvent.blur(screen.getByLabelText('Confirm New Password'));
    expect(screen.getByText(/must match/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'StrongPassword1!' } });
    const submit = screen.getByRole('button', { name: 'Update Password' });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => expect(onPasswordChange).toHaveBeenCalledWith('OldPassword1', 'StrongPassword1!'));
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('keeps the real 2FA setup action wired and reflects enabled state', () => {
    const onEnableTwoFactor = vi.fn();
    const { rerender } = render(<SecurityPanel {...defaults} onEnableTwoFactor={onEnableTwoFactor} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enable 2FA' }));
    expect(onEnableTwoFactor).toHaveBeenCalledTimes(1);
    rerender(<SecurityPanel {...defaults} twoFactorEnabled onEnableTwoFactor={onEnableTwoFactor} />);
    expect(screen.getByText('2FA is enabled')).toBeInTheDocument();
    expect(screen.getByText('Protected')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enable 2FA' })).not.toBeInTheDocument();
  });

  it('shows a useful error when the password API rejects the update', async () => {
    const onPasswordChange = vi.fn().mockRejectedValue(new Error('request failed'));
    render(<SecurityPanel {...defaults} onPasswordChange={onPasswordChange} />);
    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'WrongPassword1' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'StrongPassword1!' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'StrongPassword1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be updated/i);
  });
});
