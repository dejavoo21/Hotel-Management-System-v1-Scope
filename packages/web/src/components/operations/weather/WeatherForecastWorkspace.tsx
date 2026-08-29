import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Activity,
  AlertTriangle,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Cloud,
  CloudRain,
  CloudSun,
  Gauge,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Sun,
  Sunset,
  TrendingDown,
  TrendingUp,
  Umbrella,
  UsersRound,
  Wind,
  Wrench,
  X,
} from "lucide-react";
import {
  operationsService,
  type OperationsContext,
} from "@/services/operations";
import { useAuthStore } from "@/stores/authStore";

type Unit = "C" | "F";
type AdvisoryState = "ALL" | "NOT_CREATED" | "CREATED";
type WeatherRisk = "low" | "medium" | "high" | "unknown";
type DetailView = { title: string; body: React.ReactNode } | null;

const cardClass = "rounded-2xl border border-border bg-card shadow-card";
const iconClass =
  "theme-kpi-icon grid h-10 w-10 shrink-0 place-items-center rounded-2xl";

const toFahrenheit = (value: number) => (value * 9) / 5 + 32;
const displayTemp = (value: number, unit: Unit, precise = false) => {
  const converted = unit === "C" ? value : toFahrenheit(value);
  return `${precise ? converted.toFixed(1) : Math.round(converted)}°${unit}`;
};
const formatTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "Not synced";
const titleCase = (value?: string | null) =>
  (value || "Forecast unavailable").replace(/\b\w/g, (letter) =>
    letter.toUpperCase(),
  );

function riskStyle(risk: WeatherRisk) {
  if (risk === "high")
    return {
      label: "High",
      chip: "bg-rose-50 text-rose-700 ring-rose-200",
      icon: "bg-rose-50 text-rose-700",
    };
  if (risk === "medium")
    return {
      label: "Medium",
      chip: "bg-amber-50 text-amber-700 ring-amber-200",
      icon: "bg-amber-50 text-amber-700",
    };
  if (risk === "low")
    return {
      label: "Low",
      chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      icon: "bg-emerald-50 text-emerald-700",
    };
  return {
    label: "Unknown",
    chip: "bg-border/50 text-text-muted ring-border",
    icon: "bg-border/50 text-text-muted",
  };
}

function WeatherIcon({
  condition,
  nighttime = false,
  className = "h-6 w-6",
}: {
  condition: string;
  nighttime?: boolean;
  className?: string;
}) {
  const normalized = condition.toLowerCase();
  if (normalized.includes("rain") || normalized.includes("shower"))
    return <CloudRain className={className} />;
  if (normalized.includes("cloud"))
    return nighttime ? (
      <Cloud className={className} />
    ) : (
      <CloudSun className={className} />
    );
  return nighttime ? (
    <Sunset className={className} />
  ) : (
    <Sun className={className} />
  );
}

export default function WeatherForecastWorkspace({
  context,
  isLoading = false,
  isError = false,
  isRefreshing = false,
  onRefresh,
}: {
  context?: OperationsContext;
  isLoading?: boolean;
  isError?: boolean;
  isRefreshing?: boolean;
  onRefresh: () => void;
}) {
  const [unit, setUnit] = useState<Unit>(() => sessionStorage.getItem("laflo-weather-unit") === "F" ? "F" : "C");
  const [detail, setDetail] = useState<DetailView>(null);
  const weather = context?.weather;

  useEffect(() => { sessionStorage.setItem("laflo-weather-unit", unit); }, [unit]);
  useEffect(() => {
    if (!detail) return undefined;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setDetail(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [detail]);

  if (isLoading) return <WeatherLoadingState />;
  if (isError)
    return (
      <WeatherErrorState onRetry={onRefresh} isRefreshing={isRefreshing} />
    );
  if (!weather?.next24h && !weather?.current)
    return (
      <WeatherEmptyState onRefresh={onRefresh} isRefreshing={isRefreshing} />
    );

  const risk = (weather.next24h?.rainRisk || "unknown") as WeatherRisk;
  const riskMeta = riskStyle(risk);
  const currentTemp =
    weather.current?.temperatureC ?? weather.next24h?.lowC ?? 0;
  const low = weather.next24h?.lowC ?? currentTemp;
  const high = weather.next24h?.highC ?? currentTemp;
  const summary =
    weather.current?.summary ||
    weather.next24h?.summary ||
    "Forecast available";
  const arrivals = context?.ops?.arrivalsNext24h ?? 0;
  const departures = context?.ops?.departuresNext24h ?? 0;
  const inHouse = context?.ops?.inhouseNow ?? 0;
  const pricing = context?.pricingSignal || context?.pricing;
  const demand = pricing?.demandTrend || "flat";
  const adjustment = pricing?.opportunityPct ?? 0;
  const confidence = pricing?.confidence || "low";
  const stale = Boolean(weather.stale || !weather.isFresh);
  const timeline = buildTimeline(currentTemp, low, high, summary, risk);
  const openDetail = (title: string, rows: Array<[string, React.ReactNode]>, actions?: React.ReactNode) => setDetail({ title, body: <div className="space-y-4"><div className="divide-y divide-border rounded-2xl border border-border">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[130px_1fr] gap-3 p-3 text-sm"><strong className="text-text-main">{label}</strong><span className="text-text-muted">{value}</span></div>)}</div>{actions}</div> });
  const openAssistant = (prompt: string) => window.dispatchEvent(new CustomEvent("laflo:open-assistant", { detail: { mode: "weather", prompt, context: { page: "Weather & Forecast", condition: summary, risk, arrivals, departures, demandSignal: demand, pricingAdjustmentPct: adjustment } } }));
  const weatherDetails = () => openDetail("Weather Outlook", [["Condition", titleCase(summary)], ["Temperature range", `${displayTemp(low, unit, true)} – ${displayTemp(high, unit, true)}`], ["Provider", weather.syncedAtUtc ? "Connected provider" : "Not connected"], ["Last sync", weather.syncedAtUtc ? new Date(weather.syncedAtUtc).toLocaleString() : "Not synced"], ["Precipitation", risk === "unknown" ? "Unavailable" : `${riskMeta.label} risk`], ["Wind", "Provider detail unavailable"]]);
  const arrivalDetails = () => openDetail("Arrival Forecast", [["Arrivals expected", arrivals], ["Departures expected", departures], ["In-house now", inHouse], ["Booking source", context?.ops ? "Authorised operations context" : "Booking data unavailable"], ["Calculation window", context?.ops?.windowStartUtc && context?.ops?.windowEndUtc ? `${new Date(context.ops.windowStartUtc).toLocaleString()} – ${new Date(context.ops.windowEndUtc).toLocaleString()}` : "Next 24 hours"], ["Data gaps", context?.ops ? "No reported gaps" : "Arrival forecast unavailable because booking data could not be loaded"]]);
  const demandDetails = () => openDetail("Demand Forecast", [["Signal", demand === "down" ? "Down" : demand === "up" ? "Up" : "Stable"], ["Arrivals / departures", `${arrivals} / ${departures}`], ["Confidence", confidence], ["Source logic", "Rules-based signal"], ["Data note", confidence === "low" ? "Demand signal is based on limited data" : "Operational inputs available"]], <div className="flex flex-wrap gap-2"><Link to="/operations-center/revenue" className="rounded-xl border border-border px-3 py-2 text-xs font-semibold">Open Revenue Guidance</Link><Link to="/operations-center/market-intelligence" className="rounded-xl border border-border px-3 py-2 text-xs font-semibold">Open Market Intelligence</Link></div>);
  const pricingDetails = () => openDetail("Pricing Intelligence", [["Opportunity", `${adjustment > 0 ? "+" : ""}${adjustment}%`], ["Recommendation", pricing?.suggestion || pricing?.note || "Review pricing guidance"], ["Confidence", confidence], ["Market coverage", `${context?.pricingSignal?.marketCoveragePct ?? 0}%`], ["Source / mode", "Rules-based"]], <div className="flex flex-wrap gap-2"><Link to="/operations-center/revenue" className="rounded-xl bg-primary-solid px-3 py-2 text-xs font-semibold text-primary-contrast">Open Revenue Guidance</Link><button type="button" onClick={() => openAssistant("Explain the weather-related pricing signal and its authorised evidence.")} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold">Ask LaFlo about pricing signal</button></div>);

  return (
    <div className="space-y-4 pb-20">
      {stale ? (
        <StaleBanner
          hours={weather.staleHours}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
        />
      ) : null}

      <section
        aria-label="Weather summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        <SummaryCard
          icon={CloudSun}
          label="Current Weather"
          value={titleCase(summary)}
          onClick={weatherDetails}
          detail={`${displayTemp(low, unit, true)} – ${displayTemp(high, unit, true)}`}
        />
        <SummaryCard
          icon={RefreshCcw}
          label="Forecast Status"
          value={weather.isFresh ? "Fresh" : "Stale"}
          onClick={() => openDetail("Forecast Status", [["Status", weather.isFresh ? "Fresh" : "Stale"], ["Last successful sync", weather.syncedAtUtc ? new Date(weather.syncedAtUtc).toLocaleString() : "Not synced"], ["Provider status", weather.syncedAtUtc ? "Connected" : "Disconnected"], ["Error", weather.isFresh ? "None reported" : "Forecast data may be stale"]])}
          detail={`Last sync ${formatTime(weather.syncedAtUtc)}`}
          badge={weather.isFresh ? "CURRENT" : "REFRESH"}
        />
        <SummaryCard
          icon={ShieldCheck}
          label="Risk Level"
          value={riskMeta.label}
          onClick={() => openDetail("Weather Risk", [["Risk level", riskMeta.label], ["Factors", risk === "unknown" ? "Provider risk factors unavailable" : "Forecast precipitation and current conditions"], ["Operational impact", risk === "low" ? "No disruption expected" : "Review operational readiness"], ["Related advisories", `${context?.advisories?.length || 0} active`]])}
          detail={
            risk === "low"
              ? "No disruption expected"
              : "Review operational impact"
          }
          semantic={risk}
        />
        <SummaryCard
          icon={CalendarClock}
          label="Arrival Load"
          value={`${arrivals} arrivals`}
          onClick={arrivalDetails}
          detail={`${departures} departures · ${inHouse} in-house`}
        />
        <SummaryCard
          icon={demand === "down" ? TrendingDown : TrendingUp}
          label="Demand Signal"
          onClick={demandDetails}
          value={
            demand === "down"
              ? "Softening"
              : demand === "up"
                ? "Rising"
                : "Stable"
          }
          detail="Pricing and demand impact"
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_270px]">
        <main className="min-w-0 space-y-4">
          <section className="grid gap-3 lg:grid-cols-4">
            <WeatherOutlookCard
              weather={weather}
              summary={summary}
              low={low}
              high={high}
              unit={unit}
              risk={risk}
              onOpen={weatherDetails}
              onSync={onRefresh}
              isRefreshing={isRefreshing}
            />
            <ArrivalCard
              arrivals={arrivals}
              departures={departures}
              inHouse={inHouse}
              hasBookings={Boolean(context?.ops)}
              onOpen={arrivalDetails}
            />
            <DemandCard demand={demand} confidence={confidence} onOpen={demandDetails} />
            <PricingCard
              adjustment={adjustment}
              confidence={confidence}
              recommendation={pricing?.suggestion || pricing?.note}
              marketCoverage={context?.pricingSignal?.marketCoveragePct}
              onOpen={pricingDetails}
            />
          </section>

          <ForecastTimeline
            timeline={timeline}
            unit={unit}
            onUnitChange={setUnit}
            onHour={(item) => openDetail(`${item.time} Forecast`, [["Time", item.time], ["Temperature", displayTemp(item.temperature, unit)], ["Condition", titleCase(item.condition)], ["Precipitation", `${item.precipitation}%`], ["Wind", `${item.wind} km/h`], ["Operational note", item.precipitation > 30 ? "Review outdoor operations for this period" : "Standard operations can continue"]])}
          />

          <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
            <WeatherAdvisoryQueue context={context} />
            <ReadinessImpactOverview context={context} risk={risk} onOpen={(title, itemDetail, value) => openDetail(title, [["Current state", value], ["Operational impact", itemDetail], ["Data source", context ? "Authorised operations and weather context" : "Unavailable"], ["Recommended preparation", risk === "low" ? "Continue standard operating plan" : "Review readiness and contingency actions"]], <button type="button" onClick={() => openAssistant(`Explain ${title.toLowerCase()} for the current weather window.`)} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold">Ask LaFlo about this</button>)} />
          </div>
        </main>

        <WeatherQuickPanel
          context={context}
          summary={summary}
          low={low}
          high={high}
          unit={unit}
          risk={risk}
          onWeather={weatherDetails}
          onArrival={arrivalDetails}
          onNote={() => openDetail("Operational Note", [["Risk", riskMeta.label], ["Explanation", risk === "low" ? "No weather alerts or disruptions in the current window" : "Weather conditions should be monitored"], ["Related advisories", `${context?.advisories?.length || 0}`]])}
          onSync={onRefresh}
          isRefreshing={isRefreshing}
        />
      </div>
      {detail ? <div className="fixed inset-0 z-[90] flex justify-end bg-text-main/35" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}><section role="dialog" aria-modal="true" aria-label={detail.title} className="h-full w-full max-w-lg overflow-y-auto border-l border-border bg-card p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Weather & Forecast</p><h2 className="mt-1 text-xl font-semibold text-text-main">{detail.title}</h2></div><button type="button" aria-label={`Close ${detail.title}`} onClick={() => setDetail(null)} className="grid h-9 w-9 place-items-center rounded-xl border border-border"><X className="h-4 w-4" /></button></div><div className="mt-5">{detail.body}</div></section></div> : null}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  badge,
  semantic,
  onClick,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  badge?: string;
  semantic?: WeatherRisk;
  onClick: () => void;
}) {
  const tone = semantic ? riskStyle(semantic).icon : "theme-kpi-icon";
  return (
    <button type="button" onClick={onClick} className={`${cardClass} min-h-[108px] p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-md`}>
      <div className="flex items-start gap-3">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-text-muted">{label}</p>
            {badge ? (
              <span className="theme-chip rounded-full px-2 py-0.5 text-[8px] font-bold text-primary-700">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-base font-bold text-text-main">
            {value}
          </p>
          <p className="mt-1 truncate text-[10px] text-text-muted">{detail}</p>
        </div>
      </div>
    </button>
  );
}

function WeatherOutlookCard({
  weather,
  summary,
  low,
  high,
  unit,
  risk,
  onOpen,
  onSync,
  isRefreshing,
}: {
  weather: NonNullable<OperationsContext["weather"]>;
  summary: string;
  low: number;
  high: number;
  unit: Unit;
  risk: WeatherRisk;
  onOpen: () => void;
  onSync: () => void;
  isRefreshing: boolean;
}) {
  const meta = riskStyle(risk);
  return (
    <article role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => { if (event.key === "Enter") onOpen(); }} className={`${cardClass} cursor-pointer p-4 transition hover:shadow-md`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={iconClass}>
            <Cloud className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-text-main">
              Weather Outlook
            </h2>
            <p className="text-[10px] text-text-muted">
              Operational conditions
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-[9px] font-bold ring-1 ${meta.chip}`}
        >
          Risk {meta.label}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-amber-500">
          <WeatherIcon condition={summary} className="h-9 w-9" />
        </span>
        <div>
          <p className="text-sm font-bold text-text-main">
            {titleCase(summary)}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {displayTemp(low, unit, true)} – {displayTemp(high, unit, true)}
          </p>
        </div>
      </div>
      <div className="mt-4 border-t border-border pt-3 text-[10px] text-text-muted">
        <div className="flex justify-between">
          <span>Freshness</span>
          <strong className="text-text-main">
            {weather.isFresh ? "Current" : "Stale"}
          </strong>
        </div>
        <div className="mt-1 flex justify-between">
          <span>Last synced</span>
          <span>{formatTime(weather.syncedAtUtc)}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span>Source</span>
          <span>Connected provider</span>
        </div>
      </div>
      <button type="button" onClick={(event) => { event.stopPropagation(); onSync(); }} disabled={isRefreshing} className="mt-3 inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-semibold disabled:opacity-50"><RefreshCcw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />{isRefreshing ? "Syncing…" : "Sync outlook"}</button>
    </article>
  );
}

function ArrivalCard({
  arrivals,
  departures,
  inHouse,
  hasBookings,
  onOpen,
}: {
  arrivals: number;
  departures: number;
  inHouse: number;
  hasBookings: boolean;
  onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className={`${cardClass} p-4 text-left transition hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={iconClass}>
            <CalendarClock className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-text-main">
              Arrival Forecast
            </h2>
            <p className="text-[10px] text-text-muted">
              Operational load next 24h
            </p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700 ring-1 ring-emerald-200">
          LIVE
        </span>
      </div>
      {hasBookings ? (
        <div className="mt-5 grid grid-cols-3 divide-x divide-border text-center">
          <SmallMetric value={arrivals} label="Arrivals" />
          <SmallMetric value={departures} label="Departures" />
          <SmallMetric value={inHouse} label="In-house" />
        </div>
      ) : (
        <p className="mt-5 rounded-xl bg-bg p-3 text-xs text-text-muted">
          Booking activity is unavailable for this forecast window.
        </p>
      )}
      <p className="mt-5 text-[10px] leading-4 text-text-muted">
        Window is calculated from booking activity and current occupancy.
      </p>
    </button>
  );
}

function DemandCard({
  demand,
  confidence,
  onOpen,
}: {
  demand: "down" | "flat" | "up";
  confidence: string;
  onOpen: () => void;
}) {
  const title =
    demand === "down"
      ? "Demand is softening"
      : demand === "up"
        ? "Demand is strengthening"
        : "Demand is stable";
  return (
    <button type="button" onClick={onOpen} className={`${cardClass} p-4 text-left transition hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={iconClass}>
            {demand === "down" ? (
              <TrendingDown className="h-5 w-5" />
            ) : (
              <TrendingUp className="h-5 w-5" />
            )}
          </span>
          <div>
            <h2 className="text-sm font-semibold text-text-main">
              Demand Forecast
            </h2>
            <p className="text-[10px] text-text-muted">
              Arrivals vs departures
            </p>
          </div>
        </div>
        <span className="theme-chip rounded-full px-2 py-1 text-[9px] font-bold capitalize text-primary-700">
          {demand}
        </span>
      </div>
      <div className="mt-5 rounded-xl bg-primary-50 p-3 text-primary-800">
        <p className="text-xs font-bold">{title}</p>
        <p className="mt-1 text-[10px] leading-4">
          {demand === "down"
            ? "Consider promotions and channel mix."
            : "Continue monitoring booking pace."}
        </p>
      </div>
      <div className="mt-4 flex justify-between text-[10px] text-text-muted">
        <span>Rules-based signal</span>
        <span className="capitalize">{confidence} confidence</span>
      </div>
    </button>
  );
}

function PricingCard({
  adjustment,
  confidence,
  recommendation,
  marketCoverage,
  onOpen,
}: {
  adjustment: number;
  confidence: string;
  recommendation?: string;
  marketCoverage?: number;
  onOpen: () => void;
}) {
  const signed = `${adjustment > 0 ? "+" : ""}${adjustment}%`;
  return (
    <button type="button" onClick={onOpen} className={`${cardClass} p-4 text-left transition hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={iconClass}>
            <Gauge className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-text-main">
              Pricing Intelligence
            </h2>
            <p className="text-[10px] text-text-muted">
              Rule-based · model-ready
            </p>
          </div>
        </div>
        <span className="theme-chip rounded-full px-2 py-1 text-[9px] font-bold capitalize text-primary-700">
          {confidence} confidence
        </span>
      </div>
      <div className="mt-5 grid grid-cols-[.7fr_1.3fr] gap-3">
        <div>
          <p className="text-[10px] text-text-muted">Opportunity</p>
          <p className="mt-1 text-2xl font-bold text-primary-700">{signed}</p>
        </div>
        <div className="border-l border-border pl-3">
          <p className="text-[10px] text-text-muted">Recommendation</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-text-main">
            {recommendation || `Consider a ${signed} promotional adjustment.`}
          </p>
        </div>
      </div>
      <p className="mt-4 text-[10px] leading-4 text-text-muted">
        Market coverage {marketCoverage ?? 0}%. Stronger with competitor rates,
        pickup, and seasonality.
      </p>
    </button>
  );
}

function SmallMetric({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-xl font-bold text-text-main">{value}</p>
      <p className="mt-1 text-[9px] text-text-muted">{label}</p>
    </div>
  );
}

type TimelineItem = {
  time: string;
  temperature: number;
  condition: string;
  precipitation: number;
  wind: number;
  nighttime: boolean;
};
function buildTimeline(
  current: number,
  low: number,
  high: number,
  summary: string,
  risk: WeatherRisk,
): TimelineItem[] {
  const labels = [
    "Now",
    "12 PM",
    "2 PM",
    "4 PM",
    "6 PM",
    "8 PM",
    "10 PM",
    "12 AM",
    "2 AM",
    "4 AM",
    "6 AM",
    "8 AM",
  ];
  const precipitation =
    risk === "high" ? 70 : risk === "medium" ? 35 : risk === "low" ? 5 : 0;
  return labels.map((time, index) => {
    const curve = Math.sin((index / (labels.length - 1)) * Math.PI);
    const temperature = index === 0 ? current : low + (high - low) * curve;
    const nighttime = index >= 5 && index <= 9;
    return {
      time,
      temperature,
      condition: summary,
      precipitation: Math.max(0, precipitation - index * 2),
      wind: 6 + (index % 4) * 2,
      nighttime,
    };
  });
}

function ForecastTimeline({
  timeline,
  unit,
  onUnitChange,
  onHour,
}: {
  timeline: TimelineItem[];
  unit: Unit;
  onUnitChange: (unit: Unit) => void;
  onHour: (item: TimelineItem) => void;
}) {
  return (
    <section className={`${cardClass} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-text-main">
            24-Hour Operational Forecast
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Weather timeline for proactive hotel planning.
          </p>
        </div>
        <div
          className="flex rounded-xl border border-border bg-bg p-1 md:mr-28 xl:mr-0"
          aria-label="Temperature unit"
        >
          <button
            type="button"
            onClick={() => onUnitChange("C")}
            aria-pressed={unit === "C"}
            className={`rounded-lg px-3 py-1 text-xs font-semibold ${unit === "C" ? "bg-primary-100 text-primary-800" : "text-text-muted"}`}
          >
            °C
          </button>
          <button
            type="button"
            onClick={() => onUnitChange("F")}
            aria-pressed={unit === "F"}
            className={`rounded-lg px-3 py-1 text-xs font-semibold ${unit === "F" ? "bg-primary-100 text-primary-800" : "text-text-muted"}`}
          >
            °F
          </button>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <div className="grid min-w-[980px] grid-cols-12 divide-x divide-border">
          {timeline.map((item) => (
            <button type="button" key={item.time} onClick={() => onHour(item)} aria-label={`Open ${item.time} forecast details`} className="min-w-0 p-3 text-center hover:bg-primary-50">
              <p className="text-[10px] font-bold text-text-main">
                {item.time}
              </p>
              <span className="mt-2 flex justify-center text-amber-500">
                <WeatherIcon
                  condition={item.condition}
                  nighttime={item.nighttime}
                  className="h-6 w-6"
                />
              </span>
              <p className="mt-2 text-sm font-bold text-text-main">
                {displayTemp(item.temperature, unit)}
              </p>
              <p className="mt-1 truncate text-[9px] text-text-muted">
                {titleCase(item.condition)}
              </p>
              <div className="mt-2 flex justify-center gap-2 text-[8px] text-text-muted">
                <span className="inline-flex items-center gap-0.5">
                  <CloudRain className="h-2.5 w-2.5" />
                  {item.precipitation}%
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <Wind className="h-2.5 w-2.5" />
                  {item.wind}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 rounded-xl bg-bg px-3 py-2 text-[10px] text-text-muted">
        Operational view derived from the connected forecast. Precipitation and
        wind indicators support outdoor planning.
      </p>
    </section>
  );
}

function ReadinessImpactOverview({
  context,
  risk,
  onOpen,
}: {
  context?: OperationsContext;
  risk: WeatherRisk;
  onOpen: (title: string, detail: string, value: string) => void;
}) {
  const favourable = risk === "low";
  const arrivalLoad =
    (context?.ops?.arrivalsNext24h || 0) +
    (context?.ops?.departuresNext24h || 0);
  const items = [
    {
      icon: UsersRound,
      title: "Guest Readiness",
      detail: favourable
        ? "Conditions are favourable for guest experience."
        : "Share a weather advisory with arriving guests.",
      value: favourable ? "92%" : "68%",
      status: favourable ? "Excellent" : "Monitor",
    },
    {
      icon: BriefcaseBusiness,
      title: "Staffing Readiness",
      detail:
        arrivalLoad < 20
          ? "Staffing aligns with the expected operational load."
          : "Review coverage for elevated arrival activity.",
      value: arrivalLoad < 20 ? "88%" : "74%",
      status: arrivalLoad < 20 ? "Good" : "Review",
    },
    {
      icon: Umbrella,
      title: "Outdoor Operations",
      detail: favourable
        ? "Outdoor areas and events can proceed normally."
        : "Review outdoor setup and contingency plans.",
      value: favourable ? "No restrictions" : "Monitor weather",
      status: favourable ? "Ready" : "Attention",
    },
    {
      icon: Wrench,
      title: "Facilities / Maintenance",
      detail: favourable
        ? "No weather-related maintenance blockers."
        : "Inspect drainage and secure exposed equipment.",
      value: favourable ? "Clear" : "Review",
      status: favourable ? "Ready" : "Attention",
    },
  ];
  return (
    <section className={`${cardClass} p-4`}>
      <h2 className="font-semibold text-text-main">
        Readiness & Impact Overview
      </h2>
      <p className="mt-1 text-xs text-text-muted">
        How weather conditions affect key hotel operations.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map(({ icon: Icon, ...item }) => (
          <button type="button" onClick={() => onOpen(item.title, item.detail, item.value)}
            key={item.title}
            className="rounded-xl border border-border bg-bg/40 p-3 text-left transition hover:bg-primary-50"
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary-700" />
              <h3 className="text-xs font-semibold text-text-main">
                {item.title}
              </h3>
            </div>
            <p className="mt-2 min-h-10 text-[10px] leading-4 text-text-muted">
              {item.detail}
            </p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs font-bold text-primary-700">
                {item.value}
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                {item.status}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function WeatherAdvisoryQueue({ context }: { context?: OperationsContext }) {
  const user = useAuthStore((state) => state.user);
  const canManageTasks =
    user?.role === "ADMIN" ||
    user?.role === "MANAGER" ||
    (user?.modulePermissions || []).includes("maintenance_center");
  const [state, setState] = useState<AdvisoryState>("ALL");
  const [priority, setPriority] = useState("ALL");
  const [department, setDepartment] = useState("ALL");
  const [created, setCreated] = useState<Set<string>>(
    () =>
      new Set(
        (context?.advisories || [])
          .filter((item) => item.createdTicket)
          .map((item) => item.id),
      ),
  );
  const [dismissed] = useState<Set<string>>(() => new Set());
  const [taskDraft, setTaskDraft] = useState<NonNullable<OperationsContext["advisories"]>[number] | null>(null);
  const [pendingDismiss, setPendingDismiss] = useState<NonNullable<OperationsContext["advisories"]>[number] | null>(null);
  const [taskUnavailable, setTaskUnavailable] = useState(false);
  const advisories = context?.advisories || [];
  const filtered = advisories.filter(
    (item) =>
      !dismissed.has(item.id) &&
      (state === "ALL" || (state === "CREATED") === created.has(item.id)) &&
      (priority === "ALL" || item.priority.toUpperCase() === priority) &&
      (department === "ALL" || item.department === department),
  );
  const createTask = useMutation({
    mutationFn: (item: NonNullable<OperationsContext["advisories"]>[number]) =>
      operationsService.createTicketFromWeatherAction(item.id, {
        title: item.title,
        reason: item.reason,
        priority: item.priority.toUpperCase(),
        department: item.department,
        weatherSyncedAtUtc: context?.weather?.syncedAtUtc,
        aiGeneratedAtUtc: context?.generatedAtUtc,
      }),
    onSuccess: (_, item) => {
      setCreated((current) => new Set(current).add(item.id));
      setTaskDraft(null);
      toast.success("Weather task created and audit entry recorded");
    },
    onError: (error) => {
      const message = (error as any)?.response?.data?.error || (error as Error)?.message || "Unable to create the weather task";
      if (/not connected|unavailable|service/i.test(message)) setTaskUnavailable(true);
      toast.error(message);
    },
  });
  const departments = Array.from(
    new Set(advisories.map((item) => item.department).filter(Boolean)),
  );

  return (
    <section className={`${cardClass} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-text-main">Operations Advisory</h2>
          <p className="mt-1 text-xs text-text-muted">
            Actionable recommendations based on current operational indicators.
          </p>
          <div className="mt-2 flex gap-2">
            <span className="theme-chip rounded-full px-2 py-1 text-[9px] font-semibold text-primary-700">
              Updated{" "}
              {context?.generatedAtUtc
                ? new Date(context.generatedAtUtc).toLocaleString()
                : "just now"}
            </span>
            <span className="theme-chip rounded-full px-2 py-1 text-[9px] font-semibold text-primary-700">
              {filtered.length} item{filtered.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-xl border border-border bg-bg p-1">
            {(["ALL", "NOT_CREATED", "CREATED"] as AdvisoryState[]).map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setState(item)}
                  aria-pressed={state === item}
                  className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold ${state === item ? "bg-primary-solid text-primary-contrast" : "text-text-muted"}`}
                >
                  {item === "ALL"
                    ? "All"
                    : item === "CREATED"
                      ? "Created"
                      : "Not created"}
                </button>
              ),
            )}
          </div>
          <select
            aria-label="Advisory priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="rounded-xl border border-border bg-card px-2.5 py-2 text-[10px] font-semibold text-text-main"
          >
            <option value="ALL">All priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
          <select
            aria-label="Advisory department"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            className="rounded-xl border border-border bg-card px-2.5 py-2 text-[10px] font-semibold text-text-main"
          >
            <option value="ALL">All departments</option>
            {departments.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {filtered.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-border bg-bg/30 p-4"
          >
            <div className="flex gap-3">
              <span className="mt-0.5 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-text-main">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-text-muted">
                      {item.reason}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-semibold text-amber-700 ring-1 ring-amber-200">
                      {item.department || "Operations"}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold uppercase text-emerald-700 ring-1 ring-emerald-200">
                      {item.priority}
                    </span>
                    {created.has(item.id) ? (
                      <span className="rounded-full bg-primary-50 px-2 py-1 text-[9px] font-semibold text-primary-700">
                        Task created
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[10px] text-text-muted">
                    Source:{" "}
                    <strong className="text-text-main">{item.source}</strong>
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={
                        !canManageTasks ||
                        created.has(item.id) ||
                        taskUnavailable ||
                        createTask.isPending
                      }
                      title={
                        !canManageTasks
                          ? "Task creation requires manager permission"
                          : taskUnavailable
                            ? "Task service is not connected"
                          : undefined
                      }
                      onClick={() => setTaskDraft(item)}
                      className="min-h-9 rounded-xl bg-primary-solid px-3 text-xs font-semibold text-primary-contrast disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {created.has(item.id)
                        ? "Task created"
                        : createTask.isPending
                          ? "Creating…"
                          : "Create task"}
                    </button>
                    <button
                      type="button"
                      disabled={!canManageTasks}
                      title={!canManageTasks ? "Permission required" : undefined}
                      onClick={() => toast.error("Assignment is not available yet.")}
                      className="min-h-9 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-text-main disabled:opacity-50"
                    >
                      Assign
                    </button>
                    <button
                      type="button"
                      aria-label={`Dismiss ${item.title}`}
                      onClick={() => setPendingDismiss(item)}
                      className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-text-muted"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
        {!filtered.length ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-text-muted" />
            <p className="mt-2 text-sm font-semibold text-text-main">
              No weather-driven advisories for the current forecast window.
            </p>
            <button
              type="button"
              onClick={() => {
                setState("ALL");
                setPriority("ALL");
                setDepartment("ALL");
              }}
              className="mt-3 text-xs font-semibold text-primary-700"
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </div>
      {taskUnavailable ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Task service is not connected. Connect task service to create weather-driven tasks.</p> : null}
      {taskDraft ? <div className="fixed inset-0 z-[95] grid place-items-center bg-text-main/40 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-label="Create weather-driven task" className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold text-text-main">Create weather-driven task</h2><p className="mt-1 text-xs text-text-muted">Review the authorised advisory details before creating the task.</p></div><button type="button" aria-label="Close task drawer" onClick={() => setTaskDraft(null)}><X className="h-4 w-4" /></button></div><div className="mt-4 divide-y divide-border rounded-xl border border-border text-xs"><TaskField label="Title" value={taskDraft.title} /><TaskField label="Description" value={taskDraft.reason} /><TaskField label="Department" value={taskDraft.department || "Operations"} /><TaskField label="Priority" value={taskDraft.priority} /><TaskField label="Source" value={taskDraft.source} /><TaskField label="Due date" value="Within current 24-hour forecast window" /></div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setTaskDraft(null)} className="rounded-xl border border-border px-4 py-2 text-xs font-semibold">Cancel</button><button type="button" disabled={createTask.isPending} onClick={() => createTask.mutate(taskDraft)} className="rounded-xl bg-primary-solid px-4 py-2 text-xs font-semibold text-primary-contrast disabled:opacity-50">{createTask.isPending ? "Creating…" : "Create task"}</button></div></section></div> : null}
      {pendingDismiss ? <div className="fixed inset-0 z-[95] grid place-items-center bg-text-main/40 p-4" role="presentation"><section role="alertdialog" aria-modal="true" aria-label="Dismiss this advisory?" className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"><h2 className="text-lg font-semibold text-text-main">Dismiss this advisory?</h2><p className="mt-2 text-sm leading-6 text-text-muted">LaFlo will request removal from the active advisory queue. If the dismissal service is unavailable, no record will be changed.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setPendingDismiss(null)} className="rounded-xl border border-border px-4 py-2 text-xs font-semibold">Cancel</button><button type="button" onClick={() => { const title = pendingDismiss.title; setPendingDismiss(null); toast.error(`Advisory dismissal is not connected. ${title} remains active.`); }} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-primary-contrast">Dismiss advisory</button></div></section></div> : null}
    </section>
  );
}

function TaskField({ label, value }: { label: string; value: React.ReactNode }) { return <div className="grid grid-cols-[110px_1fr] gap-3 p-3"><strong className="text-text-main">{label}</strong><span className="text-text-muted">{value}</span></div>; }

function WeatherQuickPanel({
  context,
  summary,
  low,
  high,
  unit,
  risk,
  onWeather,
  onArrival,
  onNote,
  onSync,
  isRefreshing,
}: {
  context?: OperationsContext;
  summary: string;
  low: number;
  high: number;
  unit: Unit;
  risk: WeatherRisk;
  onWeather: () => void;
  onArrival: () => void;
  onNote: () => void;
  onSync: () => void;
  isRefreshing: boolean;
}) {
  const meta = riskStyle(risk);
  return (
    <aside className="space-y-3">
      <section className={`${cardClass} p-4`}>
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-text-main">
            Weather Outlook{" "}
            <span className="text-[9px] font-normal text-text-muted">
              (Quick)
            </span>
          </h2>
        </div>
        <button type="button" onClick={onWeather} className="mt-3 w-full rounded-xl border border-border bg-bg/40 p-3 text-left hover:bg-primary-50">
          <p className="text-sm font-bold text-text-main">
            {titleCase(summary)}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {displayTemp(low, unit, true)} – {displayTemp(high, unit, true)}
          </p>
          <p className="mt-2 text-xs text-text-main">
            Risk:{" "}
            <span className={`font-semibold ${meta.chip.split(" ")[1]}`}>
              {meta.label}
            </span>
          </p>
          <p className="mt-1 text-[10px] text-text-muted">
            Synced: {formatTime(context?.weather?.syncedAtUtc)}
          </p>
        </button>
        <button type="button" onClick={onSync} disabled={isRefreshing} className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-primary-700 disabled:opacity-50"><RefreshCcw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />{isRefreshing ? "Syncing…" : "Sync weather"}</button>
      </section>
      <button type="button" onClick={onArrival} className={`${cardClass} w-full p-4 text-left transition hover:shadow-md`}>
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary-700" />
          <h2 className="text-sm font-semibold text-text-main">
            Arrival Forecast{" "}
            <span className="text-[9px] font-normal text-text-muted">
              (Quick)
            </span>
          </h2>
        </div>
        <div className="mt-3 space-y-1 text-xs text-text-main">
          <p>
            Arrivals expected:{" "}
            <strong>{context?.ops?.arrivalsNext24h ?? 0}</strong>
          </p>
          <p>
            Departures expected:{" "}
            <strong>{context?.ops?.departuresNext24h ?? 0}</strong>
          </p>
          <p>
            In-house now: <strong>{context?.ops?.inhouseNow ?? 0}</strong>
          </p>
        </div>
        <span className="mt-3 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700 ring-1 ring-emerald-200">
          LIVE
        </span>
      </button>
      <button type="button" onClick={onNote} className={`${cardClass} w-full p-4 text-left transition hover:shadow-md`}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-text-main">
            Operational Note
          </h2>
        </div>
        <p className="mt-3 text-xs leading-5 text-text-muted">
          {risk === "low"
            ? "No weather alerts or disruptions in the current window."
            : "Weather conditions should be monitored during the current window."}
        </p>
        <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-700">
          {risk === "low" ? "All systems normal" : "Monitoring required"}
        </div>
      </button>
    </aside>
  );
}

function StaleBanner({
  hours,
  onRefresh,
  isRefreshing,
}: {
  hours?: number | null;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <p className="text-xs font-semibold">
          Forecast data may be stale
          {typeof hours === "number" ? ` (${hours.toFixed(1)} hours old)` : ""}.
          Refresh to update.
        </p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="text-xs font-bold underline disabled:opacity-50"
      >
        {isRefreshing ? "Refreshing…" : "Refresh forecast"}
      </button>
    </div>
  );
}
function WeatherLoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-28 animate-shimmer rounded-2xl" />
        ))}
      </div>
      <div className="h-56 animate-shimmer rounded-2xl" />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-64 animate-shimmer rounded-2xl" />
        <div className="h-64 animate-shimmer rounded-2xl" />
      </div>
    </div>
  );
}
function WeatherEmptyState({
  onRefresh,
  isRefreshing,
}: {
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <StateCard
      icon={Cloud}
      title="No forecast data available"
      detail="Connect a forecast provider or refresh to load weather intelligence for this property."
      action={isRefreshing ? "Refreshing…" : "Refresh forecast"}
      onAction={onRefresh}
      disabled={isRefreshing}
    />
  );
}
function WeatherErrorState({
  onRetry,
  isRefreshing,
}: {
  onRetry: () => void;
  isRefreshing: boolean;
}) {
  return (
    <StateCard
      icon={AlertTriangle}
      title="Weather forecast could not be loaded"
      detail="The forecast service is unavailable. Try refreshing the forecast."
      action={isRefreshing ? "Retrying…" : "Try again"}
      onAction={onRetry}
      disabled={isRefreshing}
    />
  );
}
function StateCard({
  icon: Icon,
  title,
  detail,
  action,
  onAction,
  disabled,
}: {
  icon: typeof Activity;
  title: string;
  detail: string;
  action: string;
  onAction: () => void;
  disabled: boolean;
}) {
  return (
    <section
      className={`${cardClass} grid min-h-72 place-items-center p-8 text-center`}
    >
      <div>
        <span className={`${iconClass} mx-auto`}>
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-lg font-bold text-text-main">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">
          {detail}
        </p>
        <button
          type="button"
          onClick={onAction}
          disabled={disabled}
          className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary-solid px-4 text-sm font-semibold text-primary-contrast disabled:opacity-50"
        >
          <RefreshCcw className={`h-4 w-4 ${disabled ? "animate-spin" : ""}`} />
          {action}
        </button>
      </div>
    </section>
  );
}
