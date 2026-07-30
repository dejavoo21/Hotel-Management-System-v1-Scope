import { useEffect, useState } from 'react';
import {
  ArrowLeftOnRectangleIcon,
  ArrowRightOnRectangleIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

export const authInsights = [
  {
    group: "Today's Flow",
    cards: [
      {
        label: 'Reservations',
        value: '18 today',
        detail: 'Expected hotel flow',
        icon: CalendarDaysIcon,
        tone: 'bg-teal-100/90 text-teal-700',
      },
      {
        label: 'Check-ins',
        value: '12 today',
        detail: 'Arrivals scheduled',
        icon: ArrowRightOnRectangleIcon,
        tone: 'bg-sky-100/90 text-sky-700',
      },
    ],
  },
  {
    group: 'Departures',
    cards: [
      {
        label: 'Check-outs',
        value: '8 today',
        detail: 'Departures scheduled',
        icon: ArrowLeftOnRectangleIcon,
        tone: 'bg-cyan-100/90 text-cyan-700',
      },
      {
        label: 'Room readiness',
        value: '86%',
        detail: '154 / 179 rooms',
        icon: CheckCircleIcon,
        tone: 'bg-emerald-100/90 text-emerald-700',
      },
    ],
  },
  {
    group: 'Service Attention',
    cards: [
      {
        label: 'Guest requests',
        value: '12 open',
        detail: '↑ 3 vs yesterday',
        icon: ChatBubbleLeftRightIcon,
        tone: 'bg-teal-100/90 text-teal-700',
      },
      {
        label: 'Maintenance alerts',
        value: '7 open',
        detail: '↑ 2 vs yesterday',
        icon: WrenchScrewdriverIcon,
        tone: 'bg-amber-100/90 text-amber-700',
      },
    ],
  },
];

const ROTATION_INTERVAL_MS = 5000;

export default function AuthInsightsCarousel() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return undefined;

    const interval = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % authInsights.length);
    }, ROTATION_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [isPaused]);

  const showPrevious = () => {
    setActiveSlide((current) => (current - 1 + authInsights.length) % authInsights.length);
  };

  const showNext = () => {
    setActiveSlide((current) => (current + 1) % authInsights.length);
  };

  return (
    <section
      className="w-full max-w-[500px] rounded-2xl border border-white/50 bg-white/30 p-2 shadow-[0_10px_24px_rgba(12,91,72,0.07)] backdrop-blur-xl"
      aria-label="Hotel operations insights"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <div className="mb-1.5 flex items-center justify-between gap-3 px-1">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#294b58]">
          {authInsights[activeSlide].group}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={showPrevious}
            aria-label="Show previous hotel insight"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/55 text-[#245864] transition hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-[#079887]"
          >
            <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={showNext}
            aria-label="Show next hotel insight"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/55 text-[#245864] transition hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-[#079887]"
          >
            <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden">
        <div
          className="auth-insights-track flex"
          style={{ transform: `translate3d(-${activeSlide * 100}%, 0, 0)` }}
        >
          {authInsights.map((slide, index) => (
            <div
              key={slide.group}
              className={`w-full shrink-0 transition-opacity duration-700 ease-in-out motion-reduce:transition-none ${
                index === activeSlide ? 'opacity-100' : 'opacity-55'
              }`}
            >
              <div className="grid grid-cols-2 gap-2">
                {slide.cards.map(({ label, value, detail, icon: Icon, tone }) => (
                  <article
                    key={label}
                    className="h-[68px] min-w-0 rounded-xl border border-white/55 bg-white/65 p-2.5 shadow-[0_4px_12px_rgba(15,91,75,0.05)]"
                  >
                    <div className="flex h-full items-center gap-2.5">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[0.64rem] font-medium text-[#41556f]">{label}</p>
                        <p className="truncate text-base font-bold leading-tight text-[#07132b]">{value}</p>
                        <p className="truncate text-[0.62rem] text-[#607089]">{detail}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-1.5 flex items-center justify-center gap-1.5">
        {authInsights.map((slide, index) => (
          <button
            key={slide.group}
            type="button"
            onClick={() => setActiveSlide(index)}
            aria-label={`Show ${slide.group}`}
            aria-current={index === activeSlide ? 'true' : undefined}
            className={`h-1.5 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-[#079887] focus:ring-offset-1 ${
              index === activeSlide ? 'w-5 bg-[#079887]' : 'w-1.5 bg-white/80 hover:bg-white'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
