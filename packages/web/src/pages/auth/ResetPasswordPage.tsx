import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authService, getApiError } from '@/services';
import toast from 'react-hot-toast';

const passwordRequirements = [
  'At least 8 characters',
  'One uppercase letter',
  'One lowercase letter',
  'One number',
];

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const token = searchParams.get('token') || '';

  const passwordMeetsPolicy =
    newPassword.length >= 8 &&
    /[A-Z]/.test(newPassword) &&
    /[a-z]/.test(newPassword) &&
    /\d/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const verificationCodeValid = /^\d{6}$/.test(otpCode);
  const canUpdatePassword = Boolean(
    token && email && passwordMeetsPolicy && passwordsMatch && verificationCodeValid
  );

  useEffect(() => {
    if (!token) return;
    const loadContext = async () => {
      setIsLoadingContext(true);
      try {
        const context = await authService.getPasswordResetContext(token);
        setEmail(context.email || '');
      } catch {
        toast.error('Reset link is invalid or expired');
      } finally {
        setIsLoadingContext(false);
      }
    };
    loadContext();
  }, [token]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      toast.error('Open the reset link from your email first');
      return;
    }
    if (!passwordMeetsPolicy) {
      toast.error('Password does not meet the requirements');
      return;
    }
    if (!passwordsMatch) {
      toast.error('Passwords do not match');
      return;
    }
    if (!otpCode) {
      toast.error('Enter the verification code');
      return;
    }
    if (!verificationCodeValid) {
      toast.error('Verification code must be 6 digits');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.resetPassword(token, newPassword, otpCode);
      toast.success('Password updated. Please sign in.');
      navigate('/login');
    } catch (error) {
      const apiError = getApiError(error);
      toast.error(apiError.message || 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!token) {
      if (!normalizedEmail) {
        toast.error('Enter your email address first');
        return;
      }
      setIsSendingCode(true);
      try {
        await authService.requestPasswordReset(normalizedEmail);
        toast.success('Reset link sent. Check your email and open that link to continue.');
      } catch (error) {
        const apiError = getApiError(error);
        toast.error(apiError.message || 'Failed to send reset link');
      } finally {
        setIsSendingCode(false);
      }
      return;
    }

    setIsSendingCode(true);
    try {
      await authService.requestPasswordResetOtp(token);
      setCodeSent(true);
      toast.success(`Verification code sent to ${email || 'your email'}`);
    } catch (error) {
      const apiError = getApiError(error);
      toast.error(apiError.message || 'Failed to send verification code');
    } finally {
      setIsSendingCode(false);
    }
  };

  if (!token) {
    return (
      <div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Reset your password</h2>
          <p className="mt-2 text-sm text-slate-600">
            Enter your registered email and we will send you a secure password reset link.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSendCode();
          }}
          className="mt-6 space-y-4"
        >
          <div>
            <label className="label">Email address</label>
            <input
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="input"
              placeholder="you@company.com"
            />
            <p className="mt-1 text-xs text-slate-500">
              Open the link in your email to set a new password and request a verification code.
            </p>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={isSendingCode}>
            {isSendingCode ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Remembered your password? <Link to="/login" className="text-primary-600">Sign in</Link>
        </p>
      </div>
    );
  }

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
          <label className="label">Email address</label>
          <input
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            readOnly={Boolean(token)}
            className={`input ${token ? 'bg-slate-50 text-slate-500' : ''}`}
            placeholder={isLoadingContext ? 'Loading...' : 'you@company.com'}
          />
          <p className="mt-1 text-xs text-slate-500">
            Verification code will be sent to this email.
          </p>
        </div>

        <div>
          <label className="label">New password</label>
          <input
            name="newPassword"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            minLength={8}
            pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}"
            title="Use at least 8 characters with one uppercase letter, one lowercase letter, and one number."
            autoComplete="new-password"
            className="input"
            aria-describedby="password-requirements"
          />
          <div id="password-requirements" className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold text-slate-700">Password must include:</p>
            <ul className="mt-1 space-y-1 text-xs text-slate-600">
              {passwordRequirements.map((requirement) => (
                <li key={requirement} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-500" aria-hidden="true" />
                  <span>{requirement}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <label className="label">Confirm new password</label>
          <input
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            autoComplete="new-password"
            className="input"
          />
          {confirmPassword && !passwordsMatch && (
            <p className="mt-1 text-xs text-red-600">Passwords do not match.</p>
          )}
        </div>

        <div>
          <label className="label">Verification code</label>
          <input
            name="otpCode"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            required={Boolean(token)}
            className="input"
            placeholder="Enter 6-digit code"
            disabled={!token}
          />
          <p className="mt-1 text-xs text-slate-500">
            Send the code after confirming the email above, then enter the 6-digit code here.
          </p>
          <button
            type="button"
            onClick={handleSendCode}
            className="btn-outline mt-3 w-full"
            disabled={isSendingCode || isLoadingContext}
          >
            {isSendingCode
              ? 'Sending...'
              : codeSent
                ? 'Resend verification code'
                : 'Send verification code'}
          </button>
        </div>

        <button type="submit" disabled={isSubmitting || !canUpdatePassword} className="btn-primary w-full">
          {isSubmitting ? 'Saving...' : 'Update password'}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-600">
        Remembered your password? <Link to="/login" className="text-primary-600">Sign in</Link>
      </p>
    </div>
  );
}
