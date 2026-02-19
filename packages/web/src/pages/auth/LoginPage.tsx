import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { authService, getApiError } from '@/services';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(() => searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpMode, setOtpMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpPurpose, setOtpPurpose] = useState<'LOGIN' | 'ACCESS_REVALIDATION'>('LOGIN');
  const [otpChannel, setOtpChannel] = useState<'EMAIL' | 'SMS'>('EMAIL');
  const [otpPhone, setOtpPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login, loginWithOtp } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || (!otpMode && !password)) {
      toast.error('Please enter your email and password');
      return;
    }
    if (otpMode && !otpCode) {
      toast.error('Enter the verification code');
      return;
    }

    setIsLoading(true);

    try {
      if (otpMode) {
        const response = await loginWithOtp(email, otpCode, otpPurpose);
        if (response.requiresTwoFactor) {
          navigate('/2fa');
        } else {
          toast.success('Welcome back!');
          navigate('/');
        }
      } else {
        const response = await login({ email, password });

        if (response.requiresPasswordChange) {
          toast.error('Password reset required. Use "Forgot password" to continue.');
          return;
        }

        if (response.requiresTwoFactor) {
          navigate('/2fa');
        } else if (response.requiresOtpRevalidation) {
          setOtpMode(true);
          setOtpPurpose('ACCESS_REVALIDATION');
          setOtpCode('');
          setOtpSent(false);
          toast('Security check required. Request a code to continue.');
        } else {
          toast.success('Welcome back!');
          navigate('/');
        }
      }
    } catch (error) {
      const apiError = getApiError(error);
      toast.error(apiError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!email) {
      toast.error('Enter your email to receive a code');
      return;
    }

    setIsSendingOtp(true);
    try {
      if (otpPurpose === 'ACCESS_REVALIDATION') {
        await authService.requestOtpForPurpose(email, 'ACCESS_REVALIDATION', otpChannel, otpPhone || undefined);
      } else {
        await authService.requestOtpForPurpose(email, 'LOGIN', otpChannel, otpPhone || undefined);
      }
      setOtpSent(true);
      toast.success(
        otpChannel === 'SMS'
          ? 'Verification code requested for SMS (email fallback may be used).'
          : 'Verification code sent'
      );
    } catch (error) {
      const apiError = getApiError(error);
      toast.error(apiError.message);
    } finally {
      setIsSendingOtp(false);
    }
  };

  return (
    <main>
      {/* Mobile logo */}
      <div className="mb-8 flex items-center gap-3 lg:hidden">
        <img
          src="/laflo-logo.png"
          alt="LaFlo - Hotel Management System"
          className="h-10 w-10 rounded-xl bg-primary-600/10 p-1.5 object-contain"
        />
        <span className="text-2xl font-bold text-slate-900">LaFlo</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in to your account to continue
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
        <div>
          <label htmlFor="email" className="label">
            Email address <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-required="true"
            aria-describedby="email-error"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="you@hotel.com"
          />
        </div>

        {!otpMode ? (
          <div>
            <label htmlFor="password" className="label">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                aria-required="true"
                aria-describedby="password-error"
                aria-label={`Password${showPassword ? ' (visible)' : ' (hidden)'}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pr-10"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded p-1"
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor="otp-code" className="label">
              Verification code <span className="text-red-500">*</span>
            </label>
            <div className="mb-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOtpChannel('EMAIL')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${otpChannel === 'EMAIL' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600'}`}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => setOtpChannel('SMS')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${otpChannel === 'SMS' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600'}`}
              >
                Phone (SMS)
              </button>
            </div>
            {otpChannel === 'SMS' && (
              <input
                value={otpPhone}
                onChange={(e) => setOtpPhone(e.target.value)}
                className="input mb-2"
                placeholder="+1 555 123 4567"
              />
            )}
            <div className="flex gap-2">
              <input
                id="otp-code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                required
                aria-required="true"
                aria-describedby="otp-error"
                maxLength={6}
                className="input"
                placeholder="Enter 6-digit code"
                type="text"
                inputMode="numeric"
              />
              <button
                type="button"
                onClick={handleSendOtp}
                className="btn-outline"
                disabled={isSendingOtp}
                aria-busy={isSendingOtp}
              >
                {isSendingOtp ? 'Sending...' : otpSent ? 'Resend' : 'Send code'}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label htmlFor="remember-me" className="flex items-center gap-2">
            <input
              id="remember-me"
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-slate-600">Remember me</span>
          </label>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/reset-password" className="font-medium text-primary-600 hover:text-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-1">
              Forgot password?
            </Link>
            <button
              type="button"
              onClick={() => {
                const next = !otpMode;
                setOtpMode(next);
                setOtpPurpose('LOGIN');
                setOtpCode('');
                setOtpSent(false);
              }}
              className="font-medium text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-1"
              aria-label={otpMode ? 'Switch to password login' : 'Switch to email code login'}
            >
              {otpMode ? 'Use password' : 'Use verification code'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full py-2.5"
        >
          {isLoading ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      {/* Demo credentials */}
      <section className="mt-8 rounded-lg bg-slate-50 p-4" aria-label="Demo credentials">
        <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide">Demo credentials</h2>
        <div className="mt-2 space-y-1 text-sm text-slate-600">
          <p>
            <span className="font-medium">Admin:</span> <code>admin@demo.hotel</code> / <code>Demo123!</code>
          </p>
          <p>
            <span className="font-medium">Manager:</span> <code>manager@demo.hotel</code> / <code>Demo123!</code>
          </p>
          <p>
            <span className="font-medium">Receptionist:</span> <code>reception@demo.hotel</code> / <code>Demo123!</code>
          </p>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <span>Need access to LaFlo?</span>
        <Link to="/request-access" className="font-medium text-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-1">
          Request access
        </Link>
      </div>
    </main>
  );
}
