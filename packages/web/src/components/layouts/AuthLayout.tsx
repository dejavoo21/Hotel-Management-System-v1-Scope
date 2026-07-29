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
      <aside className="relative hidden min-h-dvh overflow-x-hidden overflow-y-auto bg-gradient-to-br from-[#edf9f3] via-[#ccefe2] to-[#69cfad] lg:flex lg:flex-col" aria-label="LaFlo hotel operations overview">
        <div className="relative z-10 flex min-h-dvh flex-col px-10 py-6 xl:px-14 xl:py-8">
          <img
            src="/laflo-logo.png"
            alt="LaFlo"
            className="h-9 w-auto max-w-[132px] object-contain object-left xl:h-10 xl:max-w-[148px]"
          />
          <h1 className="mt-6 max-w-lg text-[2rem] font-bold leading-[1.08] tracking-[-0.035em] text-slate-950 xl:text-[2.55rem]">
            Modern Hotel Management,{' '}
            <span className="text-emerald-700">Simplified.</span>
          </h1>
          <div className="relative mt-6 grid grid-cols-2 gap-3 xl:gap-4" aria-label="Hotel operations preview">
            {operationCards.map(({ label, value, detail, icon: Icon, tone }) => (
              <article key={label} className="rounded-2xl border border-white/60 bg-white/45 p-3.5 shadow-[0_16px_36px_rgba(12,91,72,0.10)] backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white/60 xl:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-emerald-950/60 xl:text-xs">{label}</p><p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-950 xl:text-[1.7rem]">{value}</p><p className="mt-1 text-xs text-emerald-950/65 xl:text-sm">{detail}</p></div>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl xl:h-10 xl:w-10 ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-auto flex items-center justify-between gap-4 pt-5 text-xs text-emerald-950/65"><p>© {new Date().getFullYear()} LaFlo. All rights reserved.</p><div className="flex items-center gap-2" aria-label="Live operations status"><span className="h-2 w-2 rounded-full bg-emerald-600 shadow-[0_0_0_4px_rgba(5,150,105,0.12)]" /><span>Operations online</span></div></div>
        </div>
      </aside>
      <section className="flex min-h-dvh w-full items-center justify-center bg-white px-7 py-10 lg:items-start lg:px-12 lg:pb-12 lg:pt-[92px] xl:px-20 xl:pt-[108px]" aria-label="Authentication"><div className="w-full max-w-[600px]"><Outlet /></div></section>
    </div>
  );
}
