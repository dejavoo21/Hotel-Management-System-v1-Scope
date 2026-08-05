import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Laptop,
  LockKeyhole,
  MapPin,
  MessageSquareText,
  MoreVertical,
  Shield,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import type { ActiveSession } from '@/types';

type SecurityPanelProps = {
  twoFactorEnabled: boolean;
  passwordLoading: boolean;
  twoFactorLoading: boolean;
  sessions: ActiveSession[];
  sessionsLoading: boolean;
  sessionsError: boolean;
  sessionActionLoading: boolean;
  onPasswordChange: (currentPassword: string, newPassword: string) => Promise<void>;
  onEnableTwoFactor: () => void;
  onRetrySessions: () => void;
  onRevokeOtherSessions: () => Promise<unknown>;
  onRevokeSession: (sessionId: string) => Promise<unknown>;
};

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  visible: boolean;
  autoComplete: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onToggle: () => void;
};

const PASSWORD_UPDATED_KEY = 'laflo:password-updated-at';

function PasswordField({ id, label, value, placeholder, visible, autoComplete, error, onChange, onBlur, onToggle }: PasswordFieldProps) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <span className="relative block">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`input pr-11 ${error ? 'border-danger focus:border-danger focus:ring-danger' : ''}`}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-text-muted hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
      {error ? <span id={`${id}-error`} role="alert" className="mt-1 block text-xs text-danger">{error}</span> : null}
    </div>
  );
}

function formatPasswordUpdated(value: string | null) {
  if (!value) return 'Not recorded';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Not recorded';
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function parseDevice(userAgent: string | null) {
  if (!userAgent) return { device: 'Unknown device · Browser', type: 'Desktop' as const };
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /Firefox\//.test(userAgent) ? 'Firefox' : /Chrome\//.test(userAgent) ? 'Chrome' : /Safari\//.test(userAgent) ? 'Safari' : 'Browser';
  const operatingSystem = /Windows/.test(userAgent) ? 'Windows' : /Mac OS/.test(userAgent) ? 'macOS' : /Android/.test(userAgent) ? 'Android' : /iPhone|iPad/.test(userAgent) ? 'iOS' : 'Device';
  return { device: `${operatingSystem} · ${browser}`, type: /Android|iPhone|iPad/.test(userAgent) ? 'Mobile' as const : 'Desktop' as const };
}

function formatLastActive(value: string, isCurrent: boolean) {
  if (isCurrent) return 'Just now';
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 60_000) return 'Just now';
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

function formatIp(value: string | null) {
  if (!value) return 'IP not available';
  const cleaned = value.replace(/^::ffff:/, '');
  if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    return `IP ${parts.slice(0, 3).join('.')}.•••`;
  }
  return `IP ${cleaned.slice(0, 12)}…`;
}

export default function SecurityPanel({ twoFactorEnabled, passwordLoading, twoFactorLoading, sessions, sessionsLoading, sessionsError, sessionActionLoading, onPasswordChange, onEnableTwoFactor, onRetrySessions, onRevokeOtherSessions, onRevokeSession }: SecurityPanelProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visible, setVisible] = useState({ current: false, next: false, confirm: false });
  const [touched, setTouched] = useState({ current: false, next: false, confirm: false });
  const [formError, setFormError] = useState('');
  const [passwordUpdatedAt, setPasswordUpdatedAt] = useState(() => {
    try { return localStorage.getItem(PASSWORD_UPDATED_KEY); } catch { return null; }
  });

  const requirements = {
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /\d/.test(newPassword),
    symbol: /[^A-Za-z0-9]/.test(newPassword),
  };
  const validPassword = requirements.length && requirements.upper && requirements.lower && requirements.number;
  const strengthScore = Object.values(requirements).filter(Boolean).length;
  const strength = strengthScore <= 2 ? 'Weak' : strengthScore <= 4 ? 'Medium' : 'Strong';
  const strengthColor = strength === 'Weak' ? 'bg-danger' : strength === 'Medium' ? 'bg-warning' : 'bg-success';
  const isValid = Boolean(currentPassword && validPassword && confirmPassword === newPassword);

  const errors = {
    current: touched.current && !currentPassword ? 'Current password is required.' : '',
    next: touched.next && !newPassword ? 'New password is required.' : touched.next && !validPassword ? 'Use at least 8 characters with uppercase, lowercase, and a number.' : '',
    confirm: touched.confirm && !confirmPassword ? 'Please confirm your new password.' : touched.confirm && confirmPassword !== newPassword ? 'Confirmation password must match.' : '',
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ current: true, next: true, confirm: true });
    setFormError('');
    if (!isValid) return;
    try {
      await onPasswordChange(currentPassword, newPassword);
      const updatedAt = new Date().toISOString();
      try { localStorage.setItem(PASSWORD_UPDATED_KEY, updatedAt); } catch { /* storage is optional */ }
      setPasswordUpdatedAt(updatedAt);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTouched({ current: false, next: false, confirm: false });
    } catch {
      setFormError('Password could not be updated. Check your current password and try again.');
    }
  };

  return (
    <div className="space-y-4 pb-24 xl:pb-16">
      <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(22rem,1.25fr)_repeat(3,minmax(10rem,.7fr))] xl:items-center">
          <div className="flex items-center gap-4">
            <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border border-primary-200 bg-primary-50 text-primary-700 sm:h-24 sm:w-24">
              <ShieldCheck className="h-11 w-11" strokeWidth={1.6} />
            </span>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-text-main">Security</h2>
              <p className="mt-1 max-w-md text-sm leading-6 text-text-muted">Protect your account, authentication methods, and session access.</p>
            </div>
          </div>
          <SummaryCard icon={<Clock3 className="h-5 w-5" />} tone="success" label="Password updated" value={formatPasswordUpdated(passwordUpdatedAt)} />
          <SummaryCard icon={<Shield className="h-5 w-5" />} tone={twoFactorEnabled ? 'success' : 'warning'} label="2FA Status" value={twoFactorEnabled ? 'Enabled' : 'Disabled'} />
          <SummaryCard icon={<Users className="h-5 w-5" />} tone="primary" label="Active sessions" value={sessionsLoading ? '—' : String(sessions.length)} />
        </div>
      </section>

      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(20rem,.8fr)_minmax(32rem,1.2fr)]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card" aria-labelledby="change-password-title">
          <CardHeading icon={<LockKeyhole className="h-5 w-5" />} title="Change Password" subtitle="Keep your account secure with a strong password." id="change-password-title" />
          <form className="mt-5 space-y-3.5" onSubmit={submit} noValidate>
            <PasswordField id="current-password" label="Current Password" value={currentPassword} placeholder="Enter current password" autoComplete="current-password" visible={visible.current} error={errors.current} onChange={setCurrentPassword} onBlur={() => setTouched((value) => ({ ...value, current: true }))} onToggle={() => setVisible((value) => ({ ...value, current: !value.current }))} />
            <PasswordField id="new-password" label="New Password" value={newPassword} placeholder="Enter new password" autoComplete="new-password" visible={visible.next} error={errors.next} onChange={setNewPassword} onBlur={() => setTouched((value) => ({ ...value, next: true }))} onToggle={() => setVisible((value) => ({ ...value, next: !value.next }))} />
            <div aria-live="polite">
              <div className="flex items-center justify-between text-xs"><span className="text-text-muted">Password strength</span><span className={`font-semibold ${strength === 'Weak' ? 'text-danger' : strength === 'Medium' ? 'text-warning' : 'text-success'}`}>{newPassword ? strength : '—'}</span></div>
              <div className="mt-1.5 grid grid-cols-5 gap-1" aria-label={`Password strength: ${newPassword ? strength : 'not entered'}`}>
                {[1, 2, 3, 4, 5].map((step) => <span key={step} className={`h-1 rounded-full ${newPassword && step <= Math.max(1, strengthScore) ? strengthColor : 'bg-border'}`} />)}
              </div>
            </div>
            <PasswordField id="confirm-password" label="Confirm New Password" value={confirmPassword} placeholder="Confirm new password" autoComplete="new-password" visible={visible.confirm} error={errors.confirm} onChange={setConfirmPassword} onBlur={() => setTouched((value) => ({ ...value, confirm: true }))} onToggle={() => setVisible((value) => ({ ...value, confirm: !value.confirm }))} />
            {formError ? <p role="alert" className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p> : null}
            <button type="submit" className="btn-primary mt-1" disabled={!isValid || passwordLoading}>{passwordLoading ? 'Updating...' : 'Update Password'}</button>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-card" aria-labelledby="two-factor-title">
          <CardHeading icon={<Shield className="h-5 w-5" />} title="Two-Factor Authentication" subtitle="Add an extra layer of security to your account." id="two-factor-title" />
          <div className={`mt-5 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${twoFactorEnabled ? 'border-success/25 bg-success/10' : 'border-warning/25 bg-warning/10'}`}>
            <div className="flex gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${twoFactorEnabled ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>{twoFactorEnabled ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}</span>
              <div><p className="font-semibold text-text-main">2FA is {twoFactorEnabled ? 'enabled' : 'not enabled'}</p><p className="mt-0.5 max-w-xl text-sm text-text-muted">{twoFactorEnabled ? 'Your account is protected with two-factor authentication.' : 'Enable two-factor authentication to protect your account from unauthorized access.'}</p></div>
            </div>
            {!twoFactorEnabled ? <button type="button" className="btn-primary shrink-0" onClick={onEnableTwoFactor} disabled={twoFactorLoading}>{twoFactorLoading ? 'Setting up...' : 'Enable 2FA'}</button> : <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-success/15 px-3 py-1.5 text-sm font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> Protected</span>}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Feature icon={<Smartphone className="h-5 w-5" />} title="Authenticator App" text="Use apps like Google Authenticator or Microsoft Authenticator." />
            <Feature icon={<MessageSquareText className="h-5 w-5" />} title="SMS Backup" text="Receive a code via SMS if you can't access your authenticator app." />
            <Feature icon={<KeyRound className="h-5 w-5" />} title="Recovery Codes" text="Get backup codes to sign in if you lose your device." />
          </div>
        </section>
      </div>

      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(20rem,.8fr)_minmax(32rem,1.2fr)]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card" aria-labelledby="authentication-options-title">
          <CardHeading icon={<Fingerprint className="h-5 w-5" />} title="Authentication Options" subtitle="Additional sign-in methods to make access easier and more secure." id="authentication-options-title" />
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-dashed border-border p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-bg text-text-muted"><Fingerprint className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><p className="font-semibold text-text-main">Passkey (Biometric)</p><p className="mt-0.5 text-sm text-text-muted">Sign in with Face ID, Touch ID, or Windows Hello.</p></div>
            <span className="shrink-0 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">Coming soon</span>
          </div>
          <p className="mt-4 flex items-start gap-2 text-xs text-text-muted"><Shield className="mt-0.5 h-4 w-4 shrink-0" /> Passkeys will be available after 2FA is enabled.</p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-card" aria-labelledby="session-security-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <CardHeading icon={<Laptop className="h-5 w-5" />} title="Session Security" subtitle="Manage your active sessions and sign out devices you don't recognize." id="session-security-title" />
            <button
              type="button"
              className="btn-outline shrink-0 border-danger/30 text-danger hover:bg-danger/10"
              disabled={sessions.length < 2 || sessionsLoading || sessionActionLoading}
              title={sessions.length < 2 ? 'No other active sessions' : undefined}
              onClick={async () => {
                if (!window.confirm('Sign out every other active session? Your current session will stay signed in.')) return;
                try { await onRevokeOtherSessions(); } catch { /* feedback is shown by the mutation */ }
              }}
            >
              {sessionActionLoading ? 'Signing out...' : 'Sign out all other sessions'}
            </button>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            {sessionsLoading ? <p className="px-4 py-8 text-center text-sm text-text-muted">Loading active sessions…</p> : null}
            {sessionsError ? <div className="flex items-center justify-between gap-3 px-4 py-5"><p className="text-sm text-danger">Active sessions could not be loaded.</p><button type="button" className="btn-outline" onClick={onRetrySessions}>Try again</button></div> : null}
            {!sessionsLoading && !sessionsError && sessions.length === 0 ? <p className="px-4 py-8 text-center text-sm text-text-muted">No active sessions were found.</p> : null}
            {!sessionsLoading && !sessionsError ? sessions.map((session) => <SessionRow key={session.id} session={session} actionLoading={sessionActionLoading} onRevoke={onRevokeSession} />) : null}
          </div>
          <p className="mt-3 text-xs text-text-muted">IP addresses are masked and precise device location is not collected by LaFlo.</p>
        </section>
      </div>
    </div>
  );
}

function SessionRow({ session, actionLoading, onRevoke }: { session: ActiveSession; actionLoading: boolean; onRevoke: (sessionId: string) => Promise<unknown> }) {
  const device = parseDevice(session.userAgent);
  return (
    <article className={`grid gap-3 border-b border-border px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(12rem,1.25fr)_minmax(10rem,1fr)_minmax(7rem,.65fr)_auto] sm:items-center ${session.isCurrent ? 'bg-success/10' : 'bg-card'}`}>
      <div className="flex items-center gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${session.isCurrent ? 'bg-success/15 text-success' : 'bg-bg text-text-muted'}`}>{device.type === 'Mobile' ? <Smartphone className="h-5 w-5" /> : <Laptop className="h-5 w-5" />}</span><div><p className="text-sm font-semibold text-text-main">{device.device}</p><p className={`text-xs font-medium ${session.isCurrent ? 'text-success' : 'text-text-muted'}`}>{session.isCurrent ? 'Current session' : device.type}</p></div></div>
      <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" /><div><p className="text-sm font-medium text-text-main">Location not collected</p><p className="text-xs text-text-muted">{formatIp(session.ipAddress)}</p></div></div>
      <div className="flex items-center gap-2 text-sm text-text-muted"><Clock3 className="h-4 w-4" /><span>{formatLastActive(session.lastActiveAt, session.isCurrent)}</span></div>
      <button
        type="button"
        className="btn-ghost h-9 w-9 p-0"
        aria-label={session.isCurrent ? 'Current session options' : `Sign out ${device.device}`}
        disabled={session.isCurrent || actionLoading}
        title={session.isCurrent ? 'Use the account menu to sign out this session' : 'Sign out this device'}
        onClick={async () => {
          if (!window.confirm(`Sign out ${device.device}?`)) return;
          try { await onRevoke(session.id); } catch { /* feedback is shown by the mutation */ }
        }}
      ><MoreVertical className="h-4 w-4" /></button>
    </article>
  );
}

function SummaryCard({ icon, tone, label, value }: { icon: React.ReactNode; tone: 'primary' | 'success' | 'warning'; label: string; value: string }) {
  const styles = tone === 'success' ? 'bg-success/10 text-success' : tone === 'warning' ? 'bg-warning/10 text-warning' : 'bg-primary-50 text-primary-700';
  return <article className="flex min-h-20 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${styles}`}>{icon}</span><div><p className="text-xs font-medium text-text-muted">{label}</p><p className="mt-1 font-semibold text-text-main">{value}</p></div></article>;
}

function CardHeading({ icon, title, subtitle, id }: { icon: React.ReactNode; title: string; subtitle: string; id: string }) {
  return <div className="flex items-start gap-3"><span className="mt-0.5 text-text-main">{icon}</span><div><h3 id={id} className="font-semibold text-text-main">{title}</h3><p className="mt-0.5 text-sm text-text-muted">{subtitle}</p></div></div>;
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <article className="flex gap-3 border-border p-2 md:border-r md:last:border-r-0"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-50 text-primary-700">{icon}</span><div><h4 className="text-sm font-semibold text-text-main">{title}</h4><p className="mt-1 text-xs leading-5 text-text-muted">{text}</p></div></article>;
}
