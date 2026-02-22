import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authService } from '@/services';
import { useAuthStore } from '@/stores/authStore';

export default function ForcePasswordChangePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordRuleError = useMemo(() => {
    if (!newPassword) return null;
    if (newPassword.length < 8) return 'Password must be at least 8 characters';
    if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return 'Password must include uppercase, lowercase, and a number';
    }
    return null;
  }, [newPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Complete all password fields');
      return;
    }
    if (passwordRuleError) {
      toast.error(passwordRuleError);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match');
      return;
    }
    if (currentPassword === newPassword) {
      toast.error('New password must be different from current password');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      toast.success('Password updated. Please sign in again.');
      await logout();
      navigate('/login', { replace: true });
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Unable to update password. Try again.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-2xl p-4 md:p-6">
      <div className="card p-6 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-main">Change your temporary password</h1>
          <p className="mt-2 text-sm text-text-muted">
            {user?.firstName ? `${user.firstName}, ` : ''}
            you must change your password before using the application.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label className="label" htmlFor="current-password">
              Temporary password
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input"
              autoComplete="current-password"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input"
              autoComplete="new-password"
              required
            />
            <p className={`mt-2 text-xs ${passwordRuleError ? 'text-red-600' : 'text-text-muted'}`}>
              {passwordRuleError || 'Use at least 8 characters with uppercase, lowercase, and a number.'}
            </p>
          </div>

          <div>
            <label className="label" htmlFor="confirm-password">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Access to other pages and APIs is restricted until the password is changed.
          </div>

          <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Updating password...' : 'Update password'}
          </button>
        </form>
      </div>
    </section>
  );
}

