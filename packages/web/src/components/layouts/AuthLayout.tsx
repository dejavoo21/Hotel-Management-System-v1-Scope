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
  { label: 'Reservations', value: '42', detail: 'Today', icon: CalendarDaysIcon, tone: 'bg-cyan-300/20 text-cyan-100' },
  { label: 'Check-ins', value: '18', detail: '12 completed', icon: ArrowRightOnRectangleIcon, tone: 'bg-emerald-300/20 text-emerald-100' },
  { label: 'Check-outs', value: '11', detail: '3 remaining', icon: ArrowLeftOnRectangleIcon, tone: 'bg-teal-300/20 text-teal-100' },
  { label: 'Room occupancy', value: '86%', detail: '124 of 144 rooms', icon: HomeModernIcon, tone: 'bg-sky-300/20 text-sky-100' },
  { label: 'Room readiness', value: '31', detail: 'Ready for arrival', icon: CheckCircleIcon, tone: 'bg-lime-300/20 text-lime-100' },
  { label: 'Housekeeping', value: '9', detail: 'Rooms in progress', icon: HomeModernIcon, tone: 'bg-emerald-300/20 text-emerald-100' },
  { label: 'Guest requests', value: '6', detail: '2 high priority', icon: ChatBubbleLeftRightIcon, tone: 'bg-cyan-300/20 text-cyan-100' },
  { label: 'Maintenance alerts', value: '3', detail: 'Needs attention', icon: WrenchScrewdriverIcon, tone: 'bg-amber-300/20 text-amber-100' },
];

export default function AuthLayout() {
  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]">
      <aside className="relative hidden min-h-dvh overflow-x-hidden overflow-y-auto bg-gradient-to-br from-[#063d3a] via-[#075f58] to-[#078c7d] lg:flex lg:flex-col" aria-label="LaFlo hotel operations overview">
        <div className="absolute -left-24 top-[26%] h-80 w-80 rounded-full bg-emerald-300/10 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-cyan-200/10 blur-3xl" aria-hidden="true" />
        <div className="relative z-10 flex min-h-dvh flex-col px-10 py-6 xl:px-14 xl:py-8">
          <img
            src="/laflo-logo.png"
            alt="LaFlo"
            className="h-14 w-auto max-w-[180px] object-contain object-left invert hue-rotate-180 xl:h-16 xl:max-w-[200px]"
          />
          <h1 className="mt-6 max-w-xl text-4xl font-bold leading-[1.06] tracking-[-0.035em] text-white xl:text-[3.15rem]">Modern Hotel Management, Simplified.</h1>
          <div className="relative mt-6 grid grid-cols-2 gap-3 xl:gap-4" aria-label="Hotel operations preview">
            {operationCards.map(({ label, value, detail, icon: Icon, tone }) => (
              <article key={label} className="rounded-2xl border border-white/15 bg-white/[0.09] p-3.5 shadow-[0_18px_45px_rgba(0,35,32,0.16)] backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white/[0.13] xl:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-emerald-50/70 xl:text-xs">{label}</p><p className="mt-1.5 text-2xl font-bold tracking-tight text-white xl:text-[1.7rem]">{value}</p><p className="mt-1 text-xs text-emerald-50/70 xl:text-sm">{detail}</p></div>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl xl:h-10 xl:w-10 ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-auto flex items-center justify-between gap-4 pt-5 text-xs text-emerald-50/65"><p>© {new Date().getFullYear()} LaFlo. All rights reserved.</p><div className="flex items-center gap-2" aria-label="Live operations status"><span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_0_4px_rgba(110,231,183,0.12)]" /><span>Operations online</span></div></div>
        </div>
      </aside>
      <section className="flex min-h-dvh w-full items-center justify-center bg-white px-7 py-10 lg:items-start lg:px-12 lg:pb-12 lg:pt-[92px] xl:px-20 xl:pt-[108px]" aria-label="Authentication"><div className="w-full max-w-[600px]"><Outlet /></div></section>
    </div>
  );
}
