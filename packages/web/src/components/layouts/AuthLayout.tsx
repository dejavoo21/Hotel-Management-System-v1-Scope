import { Outlet } from 'react-router-dom';
import {
  ArrowLeftOnRectangleIcon,
  ArrowRightOnRectangleIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  HomeModernIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

const operationCards = [
  { label: 'Reservations', value: '42', detail: 'Today', icon: CalendarDaysIcon, tone: 'bg-teal-600/10 text-teal-700' },
  { label: 'Check-ins', value: '18', detail: '12 completed', icon: ArrowRightOnRectangleIcon, tone: 'bg-emerald-600/10 text-emerald-700' },
  { label: 'Check-outs', value: '11', detail: '3 remaining', icon: ArrowLeftOnRectangleIcon, tone: 'bg-teal-600/10 text-teal-700' },
  { label: 'Room occupancy', value: '86%', detail: '124 of 144 rooms', icon: HomeModernIcon, tone: 'bg-sky-600/10 text-sky-700' },
  { label: 'Room readiness', value: '31', detail: 'Ready for arrival', icon: CheckCircleIcon, tone: 'bg-lime-600/10 text-lime-700' },
  { label: 'Housekeeping', value: '9', detail: 'Rooms in progress', icon: HomeModernIcon, tone: 'bg-emerald-600/10 text-emerald-700' },
  { label: 'Guest requests', value: '6', detail: '2 high priority', icon: ChatBubbleLeftRightIcon, tone: 'bg-cyan-600/10 text-cyan-700' },
  { label: 'Maintenance alerts', value: '3', detail: 'Needs attention', icon: WrenchScrewdriverIcon, tone: 'bg-amber-500/15 text-amber-700' },
];

export default function AuthLayout() {
  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]">
      <aside className="relative hidden min-h-dvh overflow-x-hidden overflow-y-auto bg-[#dff4ea] lg:flex lg:flex-col" aria-label="LaFlo hotel operations overview">
        <img
          src="/assets/auth/laflo-hotel-login-bg.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[center_72%]"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-[#087c66]/10"
          aria-hidden="true"
        />
        <div className="relative z-10 flex min-h-dvh flex-col px-9 py-6 xl:px-12 xl:py-7">
          <img
            src="/laflo-logo.png"
            alt="LaFlo"
            className="h-9 w-auto max-w-[132px] object-contain object-left xl:h-10 xl:max-w-[148px]"
          />
          <h1 className="mt-6 max-w-lg text-[2rem] font-bold leading-[1.08] tracking-[-0.035em] text-slate-950 xl:text-[2.55rem]">
            Modern Hotel Management,{' '}
            <span className="text-emerald-700">Simplified.</span>
          </h1>
          <div className="mt-auto flex justify-end pt-5">
            <div className="relative grid w-[78%] grid-cols-2 gap-2 rounded-2xl border border-white/70 bg-white/30 p-2 shadow-[0_18px_50px_rgba(12,91,72,0.12)] backdrop-blur-sm xl:w-[74%]" aria-label="Hotel operations preview">
              {operationCards.map(({ label, value, detail, icon: Icon, tone }) => (
                <article key={label} className="rounded-xl border border-white/70 bg-white/65 p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:bg-white/80 xl:p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="text-[0.58rem] font-semibold uppercase tracking-[0.1em] text-emerald-950/60 xl:text-[0.64rem]">{label}</p><p className="mt-1 text-lg font-bold leading-none tracking-tight text-slate-950 xl:text-xl">{value}</p><p className="mt-1 text-[0.64rem] leading-tight text-emerald-950/65 xl:text-[0.7rem]">{detail}</p></div>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg xl:h-8 xl:w-8 ${tone}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 pt-4 text-xs text-emerald-950/75"><p>© {new Date().getFullYear()} LaFlo. All rights reserved.</p><div className="flex items-center gap-2" aria-label="Live operations status"><span className="h-2 w-2 rounded-full bg-emerald-600 shadow-[0_0_0_4px_rgba(5,150,105,0.12)]" /><span>Operations online</span></div></div>
        </div>
      </aside>
      <section className="flex min-h-dvh w-full items-center justify-center bg-white px-7 py-10 lg:items-start lg:px-12 lg:pb-12 lg:pt-[92px] xl:px-20 xl:pt-[108px]" aria-label="Authentication"><div className="w-full max-w-[600px]"><Outlet /></div></section>
    </div>
  );
}
