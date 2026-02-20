import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authService } from '@/services';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const token = searchParams.get('token') || '';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = form.get('newPassword') as string;

    if (!token) {
      toast.error('Reset token is missing');
      return;
    }
    if (!otpCode) {
      toast.error('Enter the verification code');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.resetPassword(token, newPassword, otpCode);
      toast.success('Password updated. Please sign in.');
      navigate('/login');
    } catch {
      toast.error('Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendCode = async () => {
    if (!token) {
      toast.error('Reset token is missing');
      return;
    }

    setIsSendingCode(true);
    try {
      await authService.requestPasswordResetOtp(token);
      setCodeSent(true);
      toast.success('Verification code sent to your email');
    } catch {
      toast.error('Failed to send verification code');
    } finally {
      setIsSendingCode(false);
    }
  };

  return (
    <div>
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Set your password</h2>
        <p className="mt-2 text-sm text-slate-600">
          Create a new password to finish setup.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="label">Verification code</label>
          <div className="flex gap-2">
            <input
              name="otpCode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value)}
              required
              className="input"
              placeholder="Enter 6-digit code"
            />
            <button
              type="button"
              onClick={handleSendCode}
              className="btn-outline whitespace-nowrap"
              disabled={isSendingCode}
            >
              {isSendingCode ? 'Sending...' : codeSent ? 'Resend code' : 'Send code'}
            </button>
          </div>
        </div>

        <div>
          <label className="label">New password</label>
          <input name="newPassword" type="password" required className="input" />
        </div>

        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? 'Saving...' : 'Update password'}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-600">
        Remembered your password? <Link to="/login" className="text-primary-600">Sign in</Link>
      </p>
    </div>
  );
}
