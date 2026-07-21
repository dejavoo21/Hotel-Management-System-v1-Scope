import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { authService, getApiError } from '@/services';
import toast from 'react-hot-toast';
import {
  CheckIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(() => {
    const fromQuery = searchParams.get('email');
    if (fromQuery) return fromQuery;
    try {
      return localStorage.getItem('laflo:remembered-email') || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpMode, setOtpMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpPurpose, setOtpPurpose] = useState<'LOGIN' | 'ACCESS_REVALIDATION'>('LOGIN');
  const [otpChannel, setOtpChannel] = useState<'EMAIL' | 'SMS'>('EMAIL');
  const [otpPhone, setOtpPhone] = useState('');
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      const stored = localStorage.getItem('laflo:remember-me');
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });
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
      try {
        if (rememberMe) {
          localStorage.setItem('laflo:remember-me', 'true');
          localStorage.setItem('laflo:remembered-email', email.trim());
        } else {
          localStorage.removeItem('laflo:remember-me');
          localStorage.removeItem('laflo:remembered-email');
        }
      } catch {
        // ignore storage failures
      }

      if (otpMode) {
        const response = await loginWithOtp(
          email,
          otpCode,
          otpPurpose,
          otpPurpose === 'ACCESS_REVALIDATION' && rememberMe
        );
        if (response.requiresTwoFactor) {
          navigate('/2fa');
        } else {
          toast.success('Welcome back!');
          navigate('/');
        }
      } else {
        const response = await login({ email, password });

        if (response.requiresPasswordChange) {
          toast('Account approved. Set your password with a verification code to continue.');
          navigate(`/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`);
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
      if (
        apiError.message.includes('password not set') ||
        apiError.message.includes('password has not been set') ||
        apiError.message.includes('Password change required') ||
        apiError.message.includes('setup email')
      ) {
        toast('Account approved. Set your password with a verification code to continue.');
        navigate(`/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`);
        return;
      }
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
          alt="LaFlo"
          className="h-12 w-auto max-w-[170px] object-contain object-left"
        />
      </div>

      <div>
        <h1 className="text-[2.45rem] font-extrabold leading-tight tracking-[-0.04em] text-[#07132b]">
          Welcome back
        </h1>
        <p className="mt-3 text-[1.35rem] font-medium leading-8 text-[#3d4c73]">
          Sign in to your account to continue
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-12 space-y-9" noValidate>
        <div>
          <label htmlFor="email" className="mb-3 block text-[1.12rem] font-bold text-[#111a35]">
            Email address <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <EnvelopeIcon className="pointer-events-none absolute left-5 top-1/2 h-7 w-7 -translate-y-1/2 text-[#66769d]" aria-hidden="true" />
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
              className="h-[68px] w-full rounded-xl border border-[#c6cfdf] bg-white pl-16 pr-5 text-[1.08rem] font-medium text-[#39476f] shadow-sm outline-none transition placeholder:text-[#5b688c] focus:border-[#0a9f8c] focus:ring-4 focus:ring-[#0a9f8c]/10"
              placeholder="you@hotel.com"
            />
          </div>
        </div>

        {!otpMode ? (
          <div>
            <label htmlFor="password" className="mb-3 block text-[1.12rem] font-bold text-[#111a35]">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <LockClosedIcon className="pointer-events-none absolute left-5 top-1/2 h-7 w-7 -translate-y-1/2 text-black" aria-hidden="true" />
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
                className="h-[68px] w-full rounded-xl border border-[#c6cfdf] bg-white pl-16 pr-16 text-[1.08rem] font-medium text-[#111a35] shadow-sm outline-none transition placeholder:text-[#5b688c] focus:border-[#0a9f8c] focus:ring-4 focus:ring-[#0a9f8c]/10"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-5 top-1/2 -translate-y-1/2 rounded p-1 text-[#65749a] transition hover:text-[#273252] focus:outline-none focus:ring-2 focus:ring-[#0a9f8c]"
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-7 w-7" aria-hidden="true" />
                ) : (
                  <EyeIcon className="h-7 w-7" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor="otp-code" className="mb-3 block text-[1.12rem] font-bold text-[#111a35]">
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
                className="h-[58px] w-full rounded-xl border border-[#c6cfdf] bg-white px-5 text-[1.08rem] font-medium text-[#111a35] shadow-sm outline-none transition placeholder:text-[#5b688c] focus:border-[#0a9f8c] focus:ring-4 focus:ring-[#0a9f8c]/10"
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

        <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
          <label htmlFor="remember-me" className="flex items-center gap-3">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="peer sr-only"
            />
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[#cbd5e1] bg-white text-white shadow-sm peer-checked:border-[#0aa391] peer-checked:bg-[#0aa391]">
              <CheckIcon className="h-5 w-5 stroke-[3]" aria-hidden="true" />
            </span>
            <span className="text-[1.08rem] font-medium text-[#334163]">
              Remember me
              {otpMode && otpPurpose === 'ACCESS_REVALIDATION' ? ' (includes device trust for 30 days)' : ''}
            </span>
          </label>
          <Link to={`/reset-password${email ? `?email=${encodeURIComponent(email.trim().toLowerCase())}` : ''}`} className="justify-self-start rounded px-1 text-center text-[1.05rem] font-semibold text-[#087b70] hover:text-[#056158] focus:outline-none focus:ring-2 focus:ring-[#0a9f8c] sm:justify-self-center">
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
              className="justify-self-start rounded px-1 text-[1.05rem] font-medium text-[#334163] hover:text-[#0f1a35] focus:outline-none focus:ring-2 focus:ring-[#0a9f8c] sm:justify-self-end"
              aria-label={otpMode ? 'Switch to password login' : 'Switch to email code login'}
            >
              {otpMode ? 'Use password' : 'Use verification code'}
          </button>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="mt-3 flex h-[68px] w-full items-center justify-center rounded-xl bg-[#009b8f] text-[1.3rem] font-bold text-white shadow-[0_10px_24px_rgba(0,155,143,0.22)] transition hover:bg-[#00897d] focus:outline-none focus:ring-4 focus:ring-[#009b8f]/20 disabled:cursor-not-allowed disabled:opacity-70"
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

      <div className="mt-11 flex flex-wrap items-center justify-between gap-3 text-[1.05rem] font-medium text-[#334163]">
        <span>Need access to LaFlo?</span>
        <Link to="/request-access" className="rounded px-1 font-bold text-[#07811d] focus:outline-none focus:ring-2 focus:ring-[#0a9f8c]">
          Request access
        </Link>
      </div>
    </main>
  );
}
