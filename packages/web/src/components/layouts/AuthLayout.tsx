import { Outlet } from 'react-router-dom';
import {
  ArrowRightOnRectangleIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  GlobeAltIcon,
  MoonIcon,
} from '@heroicons/react/24/outline';

const operationCards = [
  {
    label: 'Room readiness',
    value: '31',
    detail: 'Ready for arrival',
    icon: CheckCircleIcon,
    tone: 'bg-emerald-100/90 text-emerald-700',
  },
  {
    label: 'Check-ins today',
    value: '18',
    detail: '12 completed',
    icon: ArrowRightOnRectangleIcon,
    tone: 'bg-sky-100/90 text-sky-700',
  },
  {
    label: 'Guest requests',
    value: '6',
    detail: '2 high priority',
    icon: ChatBubbleLeftRightIcon,
    tone: 'bg-teal-100/90 text-teal-700',
  },
];

export default function AuthLayout() {
  return (
    <div className="min-h-dvh bg-[#d7ece5] lg:grid lg:grid-cols-[minmax(0,58fr)_minmax(0,42fr)]">
      <aside
        className="relative hidden min-h-dvh overflow-hidden bg-[#eaf5f0] lg:flex lg:flex-col"
        aria-label="LaFlo hotel operations overview"
      >
        <img
          src="/assets/auth/laflo-hotel-login-bg-v2.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-[#5eb6a0]/10"
          aria-hidden="true"
        />

        <div className="relative z-10 flex min-h-dvh flex-col px-12 py-9 xl:px-14 xl:py-11">
          <img
            src="/laflo-logo.png"
            alt="LaFlo"
            className="h-12 w-auto max-w-[190px] object-contain object-left xl:h-14 xl:max-w-[220px]"
          />

          <div className="mt-12 max-w-[510px] xl:mt-14">
            <h1 className="text-[2.8rem] font-extrabold leading-[1.08] tracking-[-0.045em] text-[#07132b] xl:text-[3.25rem]">
              Modern Hotel
              <br />
              Management,
              <br />
              <span className="text-[#079887]">Simplified.</span>
            </h1>
            <p className="mt-6 max-w-[430px] text-lg font-medium leading-8 text-[#334568] xl:text-xl">
              Everything you need to run operations,
              <br />
              delight guests, and grow your business.
            </p>
          </div>

          <div className="mt-auto grid grid-cols-3 gap-3 pt-8 xl:gap-4" aria-label="Hotel operations preview">
            {operationCards.map(({ label, value, detail, icon: Icon, tone }) => (
              <article
                key={label}
                className="rounded-2xl border border-white/75 bg-white/70 p-4 shadow-[0_16px_36px_rgba(12,91,72,0.10)] backdrop-blur-md xl:p-5"
              >
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#3b4b6d]">{label}</p>
                    <p className="mt-0.5 text-2xl font-bold leading-none text-[#07132b]">{value}</p>
                    <p className="mt-1 truncate text-xs text-[#536482]">{detail}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </aside>

      <section className="relative min-h-dvh bg-[#d7ece5] lg:p-3 lg:pl-0" aria-label="Authentication">
        <div className="relative min-h-dvh overflow-y-auto bg-white px-7 pb-10 pt-24 lg:h-[calc(100dvh-1.5rem)] lg:min-h-0 lg:rounded-[28px] lg:px-12 lg:pb-12 lg:pt-28 xl:px-16">
          <div className="absolute right-7 top-6 flex items-center gap-4 text-sm font-semibold text-[#1f3154] lg:right-10 lg:top-8">
            <label className="relative flex items-center gap-2">
              <GlobeAltIcon className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Language</span>
              <select
                aria-label="Language"
                defaultValue="en-GB"
                className="appearance-none bg-transparent py-1 pl-0 pr-5 outline-none focus:ring-2 focus:ring-[#079887]"
              >
                <option value="en-GB">English (UK)</option>
                <option value="en-US">English (US)</option>
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-0 h-3.5 w-3.5" aria-hidden="true" />
            </label>
            <button
              type="button"
              aria-label="Theme preferences"
              className="rounded-full p-1.5 text-[#25385f] transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#079887]"
            >
              <MoonIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="mx-auto w-full max-w-[600px]">
            <Outlet />
          </div>
        </div>
      </section>
    </div>
  );
}
