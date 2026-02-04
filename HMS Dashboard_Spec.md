## 1. HMS Dashboard – Product + UI Spec

### Overall style

* Clean, light theme similar to the Lodgify shots:

  * Background: `#F5F7FA` or very light grey.
  * Card background: white with soft shadow and 12–16px border radius.
  * Primary accent: soft lime/green (e.g. `#C8F36A` or `#A7E163`).
  * Secondary accent: teal or mint (e.g. `#37B9A6`).
  * Text: dark slate (`#111827` / `#4B5563`).
* Use plenty of **white space**, rounded corners, subtle drop shadows.
* All cards should be **clickable** with hover elevation.

---

### Layout (desktop)

**Top bar**

* Left: app logo + title: `Dashboard`.
* Center: **global search**: “Search room, guest, booking, etc.”
* Right: user avatar, role (e.g. “Front Desk Manager”), notifications bell, settings gear.

**Filter row (under top bar)**

* Time period dropdown: `Today | Last 7 Days | Last 30 Days | Custom`.
* Property selector (if multi-hotel).
* Channel filter: `All channels, Direct, Booking.com, Airbnb, Expedia…`.

---

### Section A – KPI Strip (top cards)

Row of small cards (like Lodgify):

1. **New Bookings**

   * Big number, % vs last week.
   * Mini green/red trend badge.

2. **Check-ins Today**

3. **Check-outs Today**

4. **Total Revenue (period filter)**

Each card:

* Title (small text)
* Main value
* Subtext: “+x% vs last week”
* Icon in corner (calendar, key, dollar, etc.)

---

### Section B – Room Overview & Occupancy

**B1. Room Availability card (left)**

* Horizontal stacked bar: `Occupied | Reserved | Available | Out of Service`.
* Show counts:

  * Occupied: 286
  * Reserved: 87
  * Available: 32
  * Not Ready: 13
* On click → navigate to Rooms page filtered by current day.

**B2. Occupancy graph (center)**

* Line or area chart:

  * X-axis: days (last 7 or 30).
  * Y-axis: occupancy %.
* Show:

  * “Avg occupancy this period”
  * “Peak day”
* Toggle: `Last 7 Days | Last 30 Days | Last 12 Months`.

**B3. Guest Rating / Reputation (right)**

* Overall rating: big number (e.g. 4.6 / 5 “Impressive”).
* Horizontal bars for:

  * Cleanliness, Service, Comfort, Location, Food, Wi-Fi.
* On click → open Reviews page.

---

### Section C – Reservations & Booking Mix

**C1. Reservations (last 7 days)**

* Bar chart: `Booked | Cancelled | No-show`.
* Under chart: small pills showing:

  * Total bookings
  * Cancellation rate
  * No-show rate

**C2. Booking by Platform (pie/donut)**

* Segments for:

  * Direct website
  * OTA (Booking.com, Expedia, Airbnb…)
  * Corporate / Travel Agent
* Legend with percentages and counts.

---

### Section D – Operational Panels

**D1. Today’s Tasks / Alerts (right column or bottom row)**

* Scrollable list:

  * Example items:

    * “Room 305: Clean & inspect – due 11:30”
    * “VIP arrival: Ms. Smith – welcome package ready?”
    * “Late checkout approved: Room 212 – 14:00”
* Each entry has:

  * Status pill: `Pending | In progress | Done`
  * Type icon: housekeeping, front desk, maintenance.
* “Add task” button opens small modal.

**D2. Housekeeping Status**

* Mini table or donut like in screenshots:

  * Clean
  * Cleaning
  * Dirty
  * Out of service
* Click any label → show filtered list of rooms in sidebar.

**D3. Booking List (compact table)**
Columns:

* Booking ID
* Guest name
* Room
* Room type
* Check-in → Check-out
* Status: `Checked-in | Due-in | Due-out | Cancelled`
* Total amount
* CTA buttons: `View`, `Check in`, `Check out`.

---

### Section E – Revenue & Expenses

**E1. Revenue chart**

* Bar chart by day/month with:

  * Revenue
  * Refunds (optional)
* Toggle tabs: `Revenue | ADR | RevPAR`.

**E2. Quick finance KPIs**

* Cards: `This month revenue`, `This month expenses`, `Gross profit`, `RevPAR`.

---

### Behaviour & UX

* Cards and charts should:

  * Show **tooltips** on hover.
  * Support **click to drill-down** (navigates to filtered lists).
* All sections must be **responsive**:

  * On tablet: 2-column layout.
  * On mobile: stacked cards, charts simplified.

---

## 2. Prompt to Give Your Coding Agent / Tool

You can literally copy-paste and adapt this:

> You are building a **Hotel Management System dashboard** in React + TypeScript with a Node/Express backend.
> Style and layout should closely follow modern examples like Lodgify and the screenshots I provided: light pastel UI, rounded cards, lots of white space, subtle shadows and green/mint accent colors.
>
> ### Tech requirements
>
> * Frontend: React + Vite, TypeScript, using TailwindCSS for styling.
> * Component structure: Dashboard page composed of reusable `Card` components, `KpiCard`, `ChartCard`, `TableCard`.
> * Charts: Use Recharts.
> * Layout: fixed left sidebar navigation, main content scrolls, max-width 1400px and centered.
>
> ### Dashboard layout
>
> 1. **Top bar** with:
>
>    * App logo + “Dashboard” title
>    * Global search input (“Search room, guest, booking, etc.”)
>    * Right side: notification bell, user avatar, dropdown.
> 2. **Filter row** below top bar:
>
>    * Time period dropdown (`Today | Last 7 Days | Last 30 Days | Custom`)
>    * Property selector and channel selector.
> 3. **KPI cards row**:
>
>    * New Bookings, Check-ins Today, Check-outs Today, Total Revenue.
>    * Each card shows current value, % change vs last period, and a small icon.
> 4. **Room & occupancy section**:
>
>    * Left: Room Availability card with stacked bar showing Occupied, Reserved, Available, Out of Service.
>    * Center: Occupancy line/area chart (last 7/30 days) with toggle and summary text.
>    * Right: Guest Rating card with overall rating and category bars (Cleanliness, Service, Comfort, Location, Food, Wi-Fi).
> 5. **Reservations & booking mix section**:
>
>    * Bar chart “Reservations – Last 7 days” by status (Booked, Cancelled, No-show).
>    * Donut chart “Booking by Platform” (Direct, OTAs, Corporate, Other).
> 6. **Operations section**:
>
>    * Today’s Tasks list with type, due time, and status pills plus “Add task” button.
>    * Housekeeping status donut (Clean, Cleaning, Dirty, Out of Service) with click-to-filter.
>    * Compact Booking List table with ID, guest name, room, stay dates, status, total and action buttons.
> 7. **Revenue section**:
>
>    * Revenue bar chart with tabs for `Revenue | ADR | RevPAR`.
>    * Finance KPI cards for “This month revenue”, “This month expenses”, “Gross profit”, “RevPAR”.
>
> ### Data
>
> * For now, use **mock data** in the frontend (JSON arrays) but keep functions easily switchable to API calls.
> * Each card and chart must have **typed props** and be reusable.
>
> ### UX details
>
> * Cards are clickable and raise on hover.
> * Charts show tooltips on hover.
> * Clicking a KPI or chart segment should call a placeholder `onDrillDown` handler that we can later wire to routing.
> * Implement responsive behaviour: 3-column layout on desktops, 2 columns on tablets, stacked on mobile.
>
> Please generate:
>
> * `DashboardPage.tsx` containing the full layout.
> * Reusable components under `components/dashboard/` (e.g. `KpiCard.tsx`, `RoomAvailabilityCard.tsx`, `OccupancyChart.tsx`, `TasksList.tsx`, `BookingsTable.tsx`, `RevenueChart.tsx`).
> * Tailwind utility classes directly in JSX instead of separate CSS.
> * Mock data in `dashboardMockData.ts` file.

---

1. A **component tree + folder structure** for the HMS dashboard.
2. **Starter React + Tailwind code** for:

   * `DashboardPage.tsx`
   * `KpiCard.tsx`
   * `RoomAvailabilityCard.tsx`
   * simple mock data

You can paste these straight into your project and then let your agent iterate.

---

## 1. Component tree & folder structure

**Folders**

```text
src/
  components/
    dashboard/
      KpiCard.tsx
      RoomAvailabilityCard.tsx
      OccupancyChart.tsx
      RatingCard.tsx
      ReservationsChart.tsx
      BookingPlatformDonut.tsx
      TasksList.tsx
      HousekeepingStatusCard.tsx
      BookingsTable.tsx
      RevenueChart.tsx
  pages/
    DashboardPage.tsx
  data/
    dashboardMockData.ts
```

**High-level tree for `DashboardPage`**

```text
DashboardPage
 ├── TopBar
 ├── FilterRow
 ├── KPI row
 │    ├── KpiCard (New bookings)
 │    ├── KpiCard (Check-ins)
 │    ├── KpiCard (Check-outs)
 │    └── KpiCard (Total revenue)
 ├── Row: Room overview
 │    ├── RoomAvailabilityCard
 │    ├── OccupancyChart
 │    └── RatingCard
 ├── Row: Reservations & booking mix
 │    ├── ReservationsChart
 │    └── BookingPlatformDonut
 ├── Row: Operations
 │    ├── TasksList
 │    ├── HousekeepingStatusCard
 │    └── BookingsTable
 └── Row: Revenue & finance
      ├── RevenueChart
      └── KpiCard x3 (Revenue / Expenses / RevPAR)
```

You/your agent can add those components gradually; we’ll start with the **top bar, filters, KPI cards and room availability** so you can see the layout working.

---

## 2. Types & mock data

`src/data/dashboardMockData.ts`

```ts
// Basic types
export type KpiTrend = "up" | "down" | "flat";

export interface Kpi {
  id: string;
  label: string;
  value: string;
  trend: KpiTrend;
  trendLabel: string;
}

export interface RoomAvailability {
  occupied: number;
  reserved: number;
  available: number;
  outOfService: number;
}

// Mock data

export const kpis: Kpi[] = [
  {
    id: "newBookings",
    label: "New bookings",
    value: "840",
    trend: "up",
    trendLabel: "+12% vs last week",
  },
  {
    id: "checkIns",
    label: "Check-ins today",
    value: "231",
    trend: "up",
    trendLabel: "+5%",
  },
  {
    id: "checkOuts",
    label: "Check-outs today",
    value: "124",
    trend: "down",
    trendLabel: "-3%",
  },
  {
    id: "revenue",
    label: "Total revenue",
    value: "$123,980",
    trend: "up",
    trendLabel: "+9% vs last week",
  },
];

export const roomAvailability: RoomAvailability = {
  occupied: 286,
  reserved: 87,
  available: 32,
  outOfService: 13,
};
```

---

## 3. Reusable KPI card component

`src/components/dashboard/KpiCard.tsx`

```tsx
import React from "react";
import type { Kpi } from "../../data/dashboardMockData";
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from "@heroicons/react/24/outline";

interface KpiCardProps {
  kpi: Kpi;
}

const trendColors: Record<Kpi["trend"], string> = {
  up: "text-emerald-600 bg-emerald-50",
  down: "text-rose-600 bg-rose-50",
  flat: "text-slate-600 bg-slate-50",
};

const KpiCard: React.FC<KpiCardProps> = ({ kpi }) => {
  const Icon =
    kpi.trend === "up"
      ? ArrowTrendingUpIcon
      : kpi.trend === "down"
      ? ArrowTrendingDownIcon
      : ArrowTrendingUpIcon;

  return (
    <button
      className="flex flex-col items-start justify-between rounded-2xl bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md w-full text-left"
      type="button"
    >
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {kpi.label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">
        {kpi.value}
      </div>
      <div
        className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${trendColors[kpi.trend]}`}
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{kpi.trendLabel}</span>
      </div>
    </button>
  );
};

export default KpiCard;
```

> Note: I’m using Heroicons (you can `npm install @heroicons/react`).

---

## 4. Room availability card

`src/components/dashboard/RoomAvailabilityCard.tsx`

```tsx
import React from "react";
import type { RoomAvailability } from "../../data/dashboardMockData";

interface Props {
  data: RoomAvailability;
}

const RoomAvailabilityCard: React.FC<Props> = ({ data }) => {
  const total =
    data.occupied + data.reserved + data.available + data.outOfService;

  const segments = [
    { label: "Occupied", value: data.occupied, color: "bg-emerald-500" },
    { label: "Reserved", value: data.reserved, color: "bg-amber-400" },
    { label: "Available", value: data.available, color: "bg-sky-400" },
    { label: "Out of service", value: data.outOfService, color: "bg-slate-300" },
  ];

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">
          Room availability
        </h2>
        <span className="text-xs text-slate-500">Today</span>
      </div>

      {/* stacked bar */}
      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="flex h-full w-full">
          {segments.map((seg) => (
            <div
              key={seg.label}
              className={seg.color}
              style={{
                width: `${(seg.value / total) * 100 || 0}%`,
              }}
            />
          ))}
        </div>
      </div>

      {/* legend */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${seg.color}`}
              aria-hidden="true"
            />
            <span className="text-slate-600">
              {seg.label}:{" "}
              <span className="font-semibold text-slate-900">
                {seg.value}
              </span>
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Total rooms: <span className="font-semibold text-slate-800">{total}</span>
      </p>
    </div>
  );
};

export default RoomAvailabilityCard;
```

---

## 5. Dashboard page skeleton

`src/pages/DashboardPage.tsx`

```tsx
import React from "react";
import KpiCard from "../components/dashboard/KpiCard";
import RoomAvailabilityCard from "../components/dashboard/RoomAvailabilityCard";
import { kpis, roomAvailability } from "../data/dashboardMockData";

const DashboardPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Main layout: sidebar would be separate; this is just content */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Top bar */}
        <header className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Dashboard
            </h1>
            <p className="text-xs text-slate-500">
              Overview of today’s hotel performance
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <input
                type="text"
                placeholder="Search room, guest, booking…"
                className="w-64 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <button className="rounded-full border border-slate-200 bg-white p-2 shadow-sm">
              🔔
            </button>
            <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm">
              <div className="h-7 w-7 rounded-full bg-emerald-400 text-xs font-semibold text-white flex items-center justify-center">
                JD
              </div>
              <div className="text-xs">
                <div className="font-medium">Jayan Doe</div>
                <div className="text-slate-500">Front desk manager</div>
              </div>
            </div>
          </div>
        </header>

        {/* Filter row */}
        <section className="mb-6 flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-2">
            <span className="text-slate-500">Time period</span>
            <select className="rounded-full border border-slate-200 bg-white px-3 py-1 shadow-sm focus:border-emerald-500 focus:outline-none">
              <option>Last 7 days</option>
              <option>Today</option>
              <option>Last 30 days</option>
              <option>Last 12 months</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-slate-500">Property</span>
            <select className="rounded-full border border-slate-200 bg-white px-3 py-1 shadow-sm focus:border-emerald-500 focus:outline-none">
              <option>All properties</option>
              <option>Main City Hotel</option>
              <option>Airport Hotel</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-slate-500">Channel</span>
            <select className="rounded-full border border-slate-200 bg-white px-3 py-1 shadow-sm focus:border-emerald-500 focus:outline-none">
              <option>All channels</option>
              <option>Direct</option>
              <option>Booking.com</option>
              <option>Airbnb</option>
              <option>Expedia</option>
            </select>
          </label>
        </section>

        {/* KPI row */}
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.id} kpi={kpi} />
          ))}
        </section>

        {/* Room overview row – for now only availability; you’ll add charts later */}
        <section className="grid gap-4 md:grid-cols-3">
          <RoomAvailabilityCard data={roomAvailability} />
          {/* placeholders for OccupancyChart & RatingCard components */}
          <div className="rounded-2xl bg-white p-4 shadow-sm flex items-center justify-center text-sm text-slate-400">
            OccupancyChart (to implement)
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm flex items-center justify-center text-sm text-slate-400">
            RatingCard (to implement)
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;
```

---

## 6. What to do next

1. **Create the files** exactly as above in your React project.
2. Make sure you have Tailwind set up; if not, your agent can scaffold it.
3. Install Heroicons:

```bash
npm install @heroicons/react
```

4. Import `DashboardPage` in your router or `App.tsx` and render it.

Once this is running, we can:

* Replace the two placeholder divs with real `OccupancyChart` and `RatingCard` components (using Recharts).
* Add the **Reservations & Booking mix**, **Tasks**, **Housekeeping**, and **Revenue** sections.

------

Cool, let’s start with the **Occupancy chart** first.

We’ll do three things:

1. Extend the mock data
2. Add `OccupancyChart` component
3. Wire it into `DashboardPage` (replace the placeholder)

You can paste these directly.

---

## 1️⃣ Update mock data

**`src/data/dashboardMockData.ts`**

Add this type + data **below** the existing exports:

```ts
// ...existing code above

export interface OccupancyPoint {
  label: string;      // e.g. "Mon"
  occupancy: number;  // percent
}

export const occupancyLast7Days: OccupancyPoint[] = [
  { label: "Mon", occupancy: 82 },
  { label: "Tue", occupancy: 78 },
  { label: "Wed", occupancy: 91 },
  { label: "Thu", occupancy: 87 },
  { label: "Fri", occupancy: 94 },
  { label: "Sat", occupancy: 96 },
  { label: "Sun", occupancy: 88 },
];
```

---

## 2️⃣ Install Recharts

In your project root:

```bash
npm install recharts
```

---

## 3️⃣ Create `OccupancyChart` card

**`src/components/dashboard/OccupancyChart.tsx`**

```tsx
import React from "react";
import {
  AreaChart,
  Area,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import type { OccupancyPoint } from "../../data/dashboardMockData";

interface Props {
  data: OccupancyPoint[];
}

const OccupancyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  const value = payload[0].value as number;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <div className="font-medium text-slate-800">{label}</div>
      <div className="mt-1 text-slate-600">
        Occupancy:{" "}
        <span className="font-semibold text-emerald-600">
          {value.toFixed(0)}%
        </span>
      </div>
    </div>
  );
};

const OccupancyChart: React.FC<Props> = ({ data }) => {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">
          Occupancy trend
        </h2>
        <span className="text-xs text-slate-500">Last 7 days</span>
      </div>

      <div className="mt-3 h-40 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="occFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e5e7eb"
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#6b7280" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<OccupancyTooltip />} />
            <Area
              type="monotone"
              dataKey="occupancy"
              stroke="#16a34a"
              fill="url(#occFill)"
              strokeWidth={2}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Average occupancy:{" "}
        <span className="font-semibold text-slate-800">
          {Math.round(
            data.reduce((sum, d) => sum + d.occupancy, 0) / data.length
          )}
          %
        </span>
      </p>
    </div>
  );
};

export default OccupancyChart;
```

---

## 4️⃣ Use the chart in `DashboardPage`

In **`src/pages/DashboardPage.tsx`**:

1. **Add imports** at the top:

```tsx
import OccupancyChart from "../components/dashboard/OccupancyChart";
import { kpis, roomAvailability, occupancyLast7Days } from "../data/dashboardMockData";
```

2. In the **Room overview row**, replace the placeholder for the chart with the real component:

```tsx
        {/* Room overview row */}
        <section className="grid gap-4 md:grid-cols-3">
          <RoomAvailabilityCard data={roomAvailability} />

          <OccupancyChart data={occupancyLast7Days} />

          {/* placeholder for RatingCard – we'll build this later */}
          <div className="rounded-2xl bg-white p-4 shadow-sm flex items-center justify-center text-sm text-slate-400">
            RatingCard (to implement)
          </div>
        </section>
```

---

Now when you run the app you should have:

* KPI row at the top
* Room availability stacked bar
* **Smooth green occupancy trend chart** for the last 7 days
* A placeholder card for ratings we’ll fill in next

When you’re ready, we can do **RatingCard**, the **Reservations vs cancellations chart**, or **Tasks/Housekeeping list** next – your pick.

------

Nice, let’s wire in the **Rating / Review card** next so that top “overview” row feels closer to those Lodgify examples.

---

## 1️⃣ Add rating data to your mock file

**`src/data/dashboardMockData.ts`**

At the top (with other interfaces):

```ts
// ...existing imports + types

export interface RatingCategory {
  label: string;
  score: number;    // e.g. 4.6
}

export interface RatingSummary {
  overall: number;      // 0–5
  totalReviews: number;
  trendLabel: string;   // e.g. "+0.2 vs last month"
  categories: RatingCategory[];
}
```

Near the other exported constants, add:

```ts
export const ratingSummary: RatingSummary = {
  overall: 4.6,
  totalReviews: 1246,
  trendLabel: "+0.2 vs last month",
  categories: [
    { label: "Cleanliness", score: 4.7 },
    { label: "Service",     score: 4.8 },
    { label: "Comfort",     score: 4.5 },
    { label: "Location",    score: 4.4 },
    { label: "Value",       score: 4.3 },
  ],
};
```

---

## 2️⃣ Create `RatingCard` component

**`src/components/dashboard/RatingCard.tsx`**

```tsx
import React from "react";
import type { RatingSummary } from "../../data/dashboardMockData";

interface Props {
  summary: RatingSummary;
}

const RatingCard: React.FC<Props> = ({ summary }) => {
  const percentage = (summary.overall / 5) * 100;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm h-full flex flex-col">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">
            Guest rating
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Based on {summary.totalReviews.toLocaleString()} reviews
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
          ▲ {summary.trendLabel}
        </span>
      </div>

      {/* Gauge + score */}
      <div className="mt-3 flex items-center gap-3">
        <div className="relative h-16 w-16">
          <svg
            viewBox="0 0 36 36"
            className="h-16 w-16 -rotate-90"
            aria-hidden="true"
          >
            {/* background circle */}
            <path
              className="text-slate-200"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              d="M18 2a16 16 0 1 1 0 32 16 16 0 1 1 0-32"
            />
            {/* progress arc */}
            <path
              className="text-emerald-500"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${percentage}, 100`}
              d="M18 2a16 16 0 1 1 0 32 16 16 0 1 1 0-32"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-semibold text-slate-900">
              {summary.overall.toFixed(1)}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-slate-400">
              / 5.0
            </span>
          </div>
        </div>

        <div className="flex-1 text-xs text-slate-500">
          <p className="text-[11px] font-medium text-slate-700">
            Overall impression
          </p>
          <p className="mt-1">
            Guests rate this hotel as{" "}
            <span className="font-semibold text-emerald-600">impressive</span>{" "}
            with consistently high scores for service and cleanliness.
          </p>
        </div>
      </div>

      {/* Category scores */}
      <div className="mt-3 space-y-1.5">
        {summary.categories.map((c) => (
          <div key={c.label} className="flex items-center gap-2">
            <span className="w-20 text-[11px] text-slate-500">{c.label}</span>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-emerald-400"
                style={{ width: `${(c.score / 5) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right text-[11px] font-medium text-slate-700">
              {c.score.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RatingCard;
```

This gives you a modern circular gauge plus small horizontal bars for each category, similar vibe to Lodgify’s “Overall Rating” card.

---

## 3️⃣ Plug it into the dashboard

**`src/pages/DashboardPage.tsx`**

1. Update imports:

```tsx
import OccupancyChart from "../components/dashboard/OccupancyChart";
import RatingCard from "../components/dashboard/RatingCard";
import {
  kpis,
  roomAvailability,
  occupancyLast7Days,
  ratingSummary,
} from "../data/dashboardMockData";
```

2. Replace the placeholder div in the “Room overview row”:

```tsx
        {/* Room overview row */}
        <section className="grid gap-4 md:grid-cols-3">
          <RoomAvailabilityCard data={roomAvailability} />

          <OccupancyChart data={occupancyLast7Days} />

          <RatingCard summary={ratingSummary} />
        </section>
```

---

Now your top half should look much closer to the Lodgify design:

* KPI row
* Room availability
* Occupancy trend
* Polished rating card with gauge + category bars

If you send me your latest screenshot after these changes, we can decide the next widget to tackle (Reservations chart, Housekeeping status, Tasks, or Finance summary).

----------------

Gotcha – I’ll keep “**better than what’s already out there**” as the bar for everything we add. 💚

Since we’ve just plugged in the **Rating / Reviews card**, here’s how we can push it beyond a typical competitor and what I’d suggest doing next.

---

## 1. Make the Rating card *feel* premium

When you have a minute, we can layer on:

1. **Micro-interactions**

   * Slight hover shadow + scale on the gauge.
   * Animate the gauge from 0 → current score on load.
   * Animate category bars from left to right.

2. **Actionability**

   * A tiny link under the card:
     **“View reviews →”** that jumps to a Reviews page.
   * Click on a category (e.g. *Cleanliness*) to filter that Reviews page to cleanliness-related comments.

3. **Segmentation (later)**

   * Tabs at the top of the card: **All • Families • Business • OTA • Direct**
   * Rating + category bars update based on segment.

Those 3 alone already lift you above many PMS dashboards which just show a static “4.3 ★★★★☆”.

If you want, next step I can give you the **animation + hover CSS** and the **“View reviews” interaction** so it’s not just pretty but interactive.

---

## 2. What to build next (still with a “better than competitors” lens)

I’d suggest this order:

1. **“Today’s Priorities” strip** at the very top
   A slim row of high-impact alerts, e.g.:

   * 🔴 **Overbooked tonight** – 3 rooms
   * 🟠 **VIP arrival** – 2 guests without welcome amenity
   * 🟡 **Late check-out conflicts** – 4 rooms

   These should:

   * Be color-coded by severity.
   * Be clickable → open a filtered list (e.g. all overbooked reservations).

2. **Reservations widget that’s actually useful**

   * Stacked bar for the **next 7 days** (Bookings / Cancellations / No-shows).
   * Tiny trend chip: **+12% vs last week**.
   * Clicking a bar → opens that day’s reservation list.

3. **Housekeeping status panel**

   * Circular chart: **Clean / In-progress / Dirty / Out of order**.
   * List of rooms needing urgent attention (e.g. dirty but due in < 2 hours).
   * “Assign task” shortcut right from the card.

4. **Revenue & channel performance**

   * Line for room revenue vs target.
   * Donut: revenue by channel (Booking.com, direct, corporate).
   * Chip showing **RevPAR** and **ADR** with trend vs last month.

Each of these we’ll design so it’s:

* **Readable at a glance** (big numbers, clear color system).
* **Clickable/drill-down** (no dead, static widgets).
* **Optimised for hotel ops**, not just pretty charts.

---

If you tell me which of those four you want to tackle next (Today’s Priorities, Reservations, Housekeeping, or Revenue), I’ll give you:

* The **data shape** for your mock file,
* A **React component** styled to match what we already have,
* And a couple of “premium” touches (micro-interactions + drill-down ideas) so it feels like a top-tier HMS product.

------------------------

Nice, let’s level this up 🔥
I’ll add a **“Today’s priorities” strip** to the top of your HMS dashboard — something you *don’t* often see done well in competitors.

We’ll do three quick things:

1. Extend `dashboardMockData.ts` with **priorities**
2. Create `PrioritiesStrip.tsx`
3. Plug it into `DashboardPage.tsx` under the header

You can copy–paste these straight in.

---

## 1️⃣ Add priorities data

**`src/data/dashboardMockData.ts`**

Add these types near your other interfaces:

```ts
// ...existing interfaces above

export type PrioritySeverity = "critical" | "high" | "medium" | "low";

export interface PriorityItem {
  id: string;
  label: string;       // e.g. "Overbooked tonight"
  description: string; // short helper text
  count?: number;      // e.g. 3 conflicts
  severity: PrioritySeverity;
  category: "overbooking" | "vip" | "housekeeping" | "payments" | "other";
}
```

Then add the mock data near your other exported constants:

```ts
export const prioritiesToday: PriorityItem[] = [
  {
    id: "overbooked",
    label: "Overbooked tonight",
    description: "3 reservations need attention",
    count: 3,
    severity: "critical",
    category: "overbooking",
  },
  {
    id: "vip-arrivals",
    label: "VIP arrivals",
    description: "2 guests missing welcome setup",
    count: 2,
    severity: "high",
    category: "vip",
  },
  {
    id: "late-checkout-conflicts",
    label: "Late check-out conflicts",
    description: "4 rooms at risk",
    count: 4,
    severity: "high",
    category: "housekeeping",
  },
  {
    id: "unpaid-invoices",
    label: "Unpaid folios",
    description: "5 departures with balance",
    count: 5,
    severity: "medium",
    category: "payments",
  },
];
```

---

## 2️⃣ Create the `PrioritiesStrip` component

**`src/components/dashboard/PrioritiesStrip.tsx`**

```tsx
import React from "react";
import type { PriorityItem } from "../../data/dashboardMockData";
import {
  ExclamationTriangleIcon,
  BellAlertIcon,
  CreditCardIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

interface Props {
  items: PriorityItem[];
  onSelectPriority?: (item: PriorityItem) => void;
}

const severityStyles: Record<
  PriorityItem["severity"],
  { bg: string; pill: string; dot: string; text: string }
> = {
  critical: {
    bg: "bg-rose-50",
    pill: "bg-rose-100 text-rose-800",
    dot: "bg-rose-500",
    text: "text-rose-800",
  },
  high: {
    bg: "bg-amber-50",
    pill: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
    text: "text-amber-800",
  },
  medium: {
    bg: "bg-sky-50",
    pill: "bg-sky-100 text-sky-800",
    dot: "bg-sky-500",
    text: "text-sky-800",
  },
  low: {
    bg: "bg-emerald-50",
    pill: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
    text: "text-emerald-800",
  },
};

function iconForCategory(category: PriorityItem["category"]) {
  switch (category) {
    case "overbooking":
      return ExclamationTriangleIcon;
    case "vip":
      return SparklesIcon;
    case "payments":
      return CreditCardIcon;
    case "housekeeping":
      return BellAlertIcon;
    default:
      return BellAlertIcon;
  }
}

const PrioritiesStrip: React.FC<Props> = ({ items, onSelectPriority }) => {
  if (!items || items.length === 0) return null;

  return (
    <section className="mb-4 rounded-2xl bg-slate-900 px-4 py-3 text-xs text-slate-100 shadow-md">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 items-center rounded-full bg-slate-800 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
            Today&apos;s priorities
          </span>
          <span className="text-[11px] text-slate-400">
            Focus on these first to keep operations smooth.
          </span>
        </div>
        <span className="hidden text-[11px] text-slate-400 sm:inline">
          Click a card to drill down into details.
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.map((item) => {
          const styles = severityStyles[item.severity];
          const Icon = iconForCategory(item.category);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectPriority?.(item)}
              className={`group flex min-w-[210px] max-w-xs flex-1 cursor-pointer items-start gap-3 rounded-xl px-3 py-2 text-left transition 
                ${styles.bg} hover:bg-white hover:shadow-lg hover:-translate-y-0.5`}
            >
              <div
                className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full ${styles.pill} shadow-sm`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] font-semibold ${styles.text}`}>
                    {item.label}
                  </span>
                  {typeof item.count === "number" && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${styles.pill}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${styles.dot}`}
                      />
                      {item.count}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500 group-hover:text-slate-700">
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default PrioritiesStrip;
```

> This gives you a dark, premium “alert ribbon” with clickable cards, better than the usual boring red banner.

---

## 3️⃣ Plug into `DashboardPage.tsx`

In **`src/pages/DashboardPage.tsx`**:

1. **Add imports** at the top:

```tsx
import PrioritiesStrip from "../components/dashboard/PrioritiesStrip";
import {
  kpis,
  roomAvailability,
  occupancyLast7Days,
  ratingSummary,
  prioritiesToday,
} from "../data/dashboardMockData";
```

2. Right under the header but **above the filters**, render the strip:

```tsx
      {/* Top bar */}
      <header className="mb-4 flex items-center justify-between gap-4">
        {/* ...existing header content... */}
      </header>

      {/* NEW: Today’s priorities strip */}
      <PrioritiesStrip
        items={prioritiesToday}
        onSelectPriority={(item) => {
          // later this can navigate to filtered views; for now log
          console.log("Priority clicked:", item);
        }}
      />

      {/* Filter row */}
      <section className="mb-6 flex flex-wrap items-center gap-3 text-xs">
        {/* ...existing filters... */}
      </section>
```

That’s it – reload your app and you should see:

* A **dark, sleek priority bar** under the dashboard header
* Cards like **“Overbooked tonight”**, **“VIP arrivals”**, **“Unpaid folios”**
* Subtle hover/press interactions and color-coded severity

This is exactly the kind of “ops-first” surface that real hotels love and a lot of competitors still don’t do well.

---

If you’re happy with how this looks, the next “big value” widget I’d suggest is:

* **Reservations chart**: Bookings vs cancellations vs no-shows for the next 7 days, with drill-down when you click a bar.

Say the word and I’ll wire that in next the same way: data → component → dashboard integration.
-------------------------------------

Alright, let’s make this thing feel like a real PMS: **Reservations & Cancellations chart** coming up 🙌

We’ll do the usual 3-step combo:

1. Add mock data → `dashboardMockData.ts`
2. Create `ReservationsChart.tsx` (Recharts stacked bars)
3. Plug it into `DashboardPage.tsx`

---

## 1️⃣ Add reservations data

**`src/data/dashboardMockData.ts`**

Add these types near your other interfaces:

```ts
export interface ReservationStat {
  label: string;       // e.g. "Mon" / "Tue" / "2025-02-20"
  bookings: number;
  cancellations: number;
  noShows: number;
}
```

Then add the data near your other exported constants:

```ts
export const reservationsNext7Days: ReservationStat[] = [
  { label: "Mon", bookings: 32, cancellations: 3, noShows: 1 },
  { label: "Tue", bookings: 28, cancellations: 2, noShows: 2 },
  { label: "Wed", bookings: 35, cancellations: 4, noShows: 1 },
  { label: "Thu", bookings: 30, cancellations: 3, noShows: 2 },
  { label: "Fri", bookings: 42, cancellations: 5, noShows: 3 },
  { label: "Sat", bookings: 48, cancellations: 6, noShows: 2 },
  { label: "Sun", bookings: 26, cancellations: 2, noShows: 1 },
];
```

This will drive the chart.

---

## 2️⃣ Create `ReservationsChart.tsx`

**`src/components/dashboard/ReservationsChart.tsx`**

```tsx
import React from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ReservationStat } from "../../data/dashboardMockData";

interface Props {
  data: ReservationStat[];
}

const ReservationsTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  const bookings = payload.find((p: any) => p.dataKey === "bookings")?.value ?? 0;
  const cancellations =
    payload.find((p: any) => p.dataKey === "cancellations")?.value ?? 0;
  const noShows =
    payload.find((p: any) => p.dataKey === "noShows")?.value ?? 0;

  const total = bookings + cancellations + noShows;
  const showRate =
    total > 0 ? Math.round(((bookings - noShows) / total) * 100) : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <div className="font-medium text-slate-800">{label}</div>
      <div className="mt-1 space-y-0.5">
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Bookings</span>
          <span className="font-semibold text-slate-800">{bookings}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Cancellations</span>
          <span className="font-semibold text-amber-700">
            {cancellations}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">No-shows</span>
          <span className="font-semibold text-rose-700">{noShows}</span>
        </div>
        {showRate !== null && (
          <div className="mt-1 border-t border-slate-100 pt-1.5 text-[11px] text-slate-500">
            Effective show rate:{" "}
            <span className="font-semibold text-emerald-600">
              {showRate}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const ReservationsChart: React.FC<Props> = ({ data }) => {
  const totalBookings = data.reduce((sum, d) => sum + d.bookings, 0);
  const totalCxl = data.reduce((sum, d) => sum + d.cancellations, 0);
  const totalNoShows = data.reduce((sum, d) => sum + d.noShows, 0);

  const total = totalBookings + totalCxl + totalNoShows;
  const showRate =
    total > 0 ? Math.round(((totalBookings - totalNoShows) / total) * 100) : 0;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">
            Reservations & cancellations
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Next 7 days · keep an eye on churn and no-shows.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            Show rate
          </div>
          <div className="text-sm font-semibold text-emerald-600">
            {showRate}%
          </div>
        </div>
      </div>

      <div className="mt-3 h-48 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 8, left: -18, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#6b7280" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#6b7280" }}
            />
            <Tooltip content={<ReservationsTooltip />} />
            <Legend
              verticalAlign="top"
              height={24}
              wrapperStyle={{ fontSize: 11 }}
            />
            <Bar
              dataKey="bookings"
              name="Bookings"
              stackId="a"
              fill="#0ea5e9"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="cancellations"
              name="Cancellations"
              stackId="a"
              fill="#f97316"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="noShows"
              name="No-shows"
              stackId="a"
              fill="#fb7185"
              radius={[0, 0, 4, 4]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-500">
        <div>
          <div className="text-slate-400">Bookings</div>
          <div className="font-semibold text-slate-800">{totalBookings}</div>
        </div>
        <div>
          <div className="text-slate-400">Cancellations</div>
          <div className="font-semibold text-amber-700">{totalCxl}</div>
        </div>
        <div>
          <div className="text-slate-400">No-shows</div>
          <div className="font-semibold text-rose-700">{totalNoShows}</div>
        </div>
      </div>
    </div>
  );
};

export default ReservationsChart;
```

This gives you:

* Stacked bars per day
* Tooltips with breakdown + effective show rate
* A mini “summary row” under the chart

Very “SaaS hotel platform” vibes.

---

## 3️⃣ Hook into `DashboardPage.tsx`

Now bring it into your dashboard.

**`src/pages/DashboardPage.tsx`**

1. Add imports at the top:

```tsx
import ReservationsChart from "../components/dashboard/ReservationsChart";
import {
  kpis,
  roomAvailability,
  occupancyLast7Days,
  ratingSummary,
  prioritiesToday,
  reservationsNext7Days,
} from "../data/dashboardMockData";
```

2. Under your existing **Room overview row**, add a new section for reservations:

```tsx
      {/* Room overview row */}
      <section className="grid gap-4 md:grid-cols-3">
        <RoomAvailabilityCard data={roomAvailability} />
        <OccupancyChart data={occupancyLast7Days} />
        <RatingCard summary={ratingSummary} />
      </section>

      {/* Reservations row */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ReservationsChart data={reservationsNext7Days} />
        </div>

        {/* Placeholder for next widget, e.g. Housekeeping or Tasks */}
        <div className="rounded-2xl bg-white p-4 shadow-sm text-sm text-slate-400 flex items-center justify-center">
          Housekeeping / Tasks (to implement)
        </div>
      </section>
```

---

Now your dashboard “top half” is starting to look like a proper, competitive HMS:

* **Today’s priorities strip**
* KPIs
* Room availability
* Occupancy trend
* Rating card
* **Reservations vs cancellations vs no-shows** chart

Next big win (when you’re ready) would be either:

* **Housekeeping status tile** (clean / in progress / dirty / out of order), or
* **Revenue / channel performance** widget (ADR, RevPAR, channel mix).

Tell me which one you want to add next and we’ll keep pushing this past what competitors typically show.
--------------------------------------------------------------------------------------------

Nice, we’re on a roll 😎
Let’s make the dashboard feel like a real hotel ops cockpit by adding a **Housekeeping Status + Tasks** card.

We’ll do the usual 3 steps:

1. Add housekeeping data to `dashboardMockData.ts`
2. Create `HousekeepingStatusCard.tsx`
3. Plug it into `DashboardPage.tsx` (where that “Housekeeping / Tasks (to implement)” placeholder is)

---

## 1️⃣ Add housekeeping data

Open **`src/data/dashboardMockData.ts`** and add these types near the other interfaces:

```ts
export interface HousekeepingSummary {
  totalRooms: number;
  clean: number;
  inProgress: number;
  dirty: number;
  outOfOrder: number;
}

export interface HousekeepingTask {
  id: string;
  room: string;
  type: "clean" | "inspection" | "turn-down" | "deep-clean";
  priority: "high" | "medium" | "low";
  dueInMinutes: number;
  assignedTo?: string;
  status: "pending" | "in-progress" | "done";
}
```

Then add some mock data, near your other exported constants:

```ts
export const housekeepingSummary: HousekeepingSummary = {
  totalRooms: 120,
  clean: 78,
  inProgress: 14,
  dirty: 22,
  outOfOrder: 6,
};

export const housekeepingTasksToday: HousekeepingTask[] = [
  {
    id: "hk-1",
    room: "305",
    type: "clean",
    priority: "high",
    dueInMinutes: 45,
    assignedTo: "Maria",
    status: "in-progress",
  },
  {
    id: "hk-2",
    room: "412",
    type: "inspection",
    priority: "medium",
    dueInMinutes: 90,
    assignedTo: "James",
    status: "pending",
  },
  {
    id: "hk-3",
    room: "221",
    type: "clean",
    priority: "high",
    dueInMinutes: 30,
    assignedTo: "Aisha",
    status: "pending",
  },
  {
    id: "hk-4",
    room: "110",
    type: "deep-clean",
    priority: "low",
    dueInMinutes: 240,
    assignedTo: "Team B",
    status: "pending",
  },
];
```

This will give the widget enough data to feel “real” (like a competitor product demo).

---

## 2️⃣ Create `HousekeepingStatusCard.tsx`

Create a new file:

**`src/components/dashboard/HousekeepingStatusCard.tsx`**

```tsx
import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type {
  HousekeepingSummary,
  HousekeepingTask,
} from "../../data/dashboardMockData";
import {
  SparklesIcon,
  ArrowRightCircleIcon,
} from "@heroicons/react/24/outline";

interface Props {
  summary: HousekeepingSummary;
  tasks: HousekeepingTask[];
}

const COLORS = {
  clean: "#22c55e",
  inProgress: "#fbbf24",
  dirty: "#ef4444",
  outOfOrder: "#6b7280",
};

const HousekeepingTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const { name, value, payload: data } = payload[0];

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <div className="font-semibold text-slate-800">{name}</div>
      <div className="mt-0.5 text-slate-600">
        {value} rooms{" "}
        {data?.percentage != null && (
          <span className="text-[11px] text-slate-500">
            ({data.percentage}%)
          </span>
        )}
      </div>
    </div>
  );
};

const HousekeepingStatusCard: React.FC<Props> = ({ summary, tasks }) => {
  const data = [
    {
      name: "Clean",
      value: summary.clean,
      key: "clean",
    },
    {
      name: "In progress",
      value: summary.inProgress,
      key: "inProgress",
    },
    {
      name: "Dirty",
      value: summary.dirty,
      key: "dirty",
    },
    {
      name: "Out of order",
      value: summary.outOfOrder,
      key: "outOfOrder",
    },
  ];

  const total = summary.totalRooms || data.reduce((s, d) => s + d.value, 0);

  const chartData = data.map((d) => ({
    ...d,
    percentage: total ? Math.round((d.value / total) * 100) : 0,
  }));

  const openTasks = tasks.filter((t) => t.status !== "done");
  const highPriority = openTasks.filter((t) => t.priority === "high").length;

  return (
    <div className="flex h-full flex-col rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">
            Housekeeping status
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {summary.clean} of {summary.totalRooms} rooms guest-ready.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
          <SparklesIcon className="h-3 w-3" />
          {highPriority} high-priority tasks
        </span>
      </div>

      {/* Chart + headline */}
      <div className="mt-2 flex flex-1 gap-3">
        <div className="h-32 w-32 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={26}
                outerRadius={40}
                paddingAngle={2}
              >
                {chartData.map((entry, idx) => (
                  <Cell
                    key={entry.key}
                    fill={
                      entry.key === "clean"
                        ? COLORS.clean
                        : entry.key === "inProgress"
                        ? COLORS.inProgress
                        : entry.key === "dirty"
                        ? COLORS.dirty
                        : COLORS.outOfOrder
                    }
                  />
                ))}
              </Pie>
              <Tooltip content={<HousekeepingTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-1 flex-col justify-between">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: COLORS.clean }}
              />
              <span className="text-slate-500">
                Clean:{" "}
                <span className="font-semibold text-slate-800">
                  {summary.clean}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: COLORS.inProgress }}
              />
              <span className="text-slate-500">
                In progress:{" "}
                <span className="font-semibold text-slate-800">
                  {summary.inProgress}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: COLORS.dirty }}
              />
              <span className="text-slate-500">
                Dirty:{" "}
                <span className="font-semibold text-slate-800">
                  {summary.dirty}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: COLORS.outOfOrder }}
              />
              <span className="text-slate-500">
                Out of order:{" "}
                <span className="font-semibold text-slate-800">
                  {summary.outOfOrder}
                </span>
              </span>
            </div>
          </div>

          {/* Mini task list */}
          <div className="mt-3 rounded-xl bg-slate-50 px-2.5 py-2">
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-700">
                Live tasks ({openTasks.length})
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-700"
              >
                View all
                <ArrowRightCircleIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            {openTasks.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                No open housekeeping tasks. 🎉
              </p>
            ) : (
              <ul className="space-y-1.5 text-[11px]">
                {openTasks.slice(0, 3).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="font-mono text-[11px] text-slate-700">
                      #{t.room}
                    </span>
                    <span className="flex-1 truncate text-slate-600">
                      {t.type === "clean"
                        ? "Room clean"
                        : t.type === "inspection"
                        ? "Inspection"
                        : t.type === "turn-down"
                        ? "Turn-down service"
                        : "Deep clean"}
                      {t.assignedTo && ` · ${t.assignedTo}`}
                    </span>
                    <span
                      className={
                        t.priority === "high"
                          ? "rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700"
                          : t.priority === "medium"
                          ? "rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
                          : "rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700"
                      }
                    >
                      {t.dueInMinutes}m
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HousekeepingStatusCard;
```

This gives you a **donut chart + mini live task list** — exactly the kind of thing that feels premium vs competitors.

---

## 3️⃣ Wire into the dashboard

Open **`src/pages/DashboardPage.tsx`** and:

### a) Import the new card + data

At the top with the other imports:

```tsx
import HousekeepingStatusCard from "../components/dashboard/HousekeepingStatusCard";
import {
  kpis,
  roomAvailability,
  occupancyLast7Days,
  ratingSummary,
  prioritiesToday,
  reservationsNext7Days,
  housekeepingSummary,
  housekeepingTasksToday,
} from "../data/dashboardMockData";
```

### b) Replace the placeholder in the Reservations row

You currently have something like:

```tsx
      {/* Reservations row */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ReservationsChart data={reservationsNext7Days} />
        </div>

        {/* Placeholder for next widget, e.g. Housekeeping or Tasks */}
        <div className="rounded-2xl bg-white p-4 shadow-sm text-sm text-slate-400 flex items-center justify-center">
          Housekeeping / Tasks (to implement)
        </div>
      </section>
```

Replace that section with:

```tsx
      {/* Reservations + Housekeeping row */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ReservationsChart data={reservationsNext7Days} />
        </div>

        <HousekeepingStatusCard
          summary={housekeepingSummary}
          tasks={housekeepingTasksToday}
        />
      </section>
```

---

Now your dashboard is feeling like a **serious HMS**:

* Priorities strip
* KPI row
* Room availability
* Occupancy trend
* Ratings & reviews
* Reservations vs cancellations vs no-shows
* **Housekeeping status + live tasks**

From here, the last “big competitive” piece on the home screen would be:

* **Revenue / channel performance card** (ADR, RevPAR, channel split, budget vs actual)

If you’d like, next step I can add that revenue widget so your dashboard covers **operations + guests + housekeeping + revenue** in one glance like top-tier products do.
============================================================================================================================================

Nice, let’s give your HMS some **revenue brains** now 💸

We’ll add a **Revenue & Channel Performance** card:

* KPIs: Today’s revenue, ADR, RevPAR, Occupancy
* Channel split: Direct / OTA / Corporate etc.
* Trend vs last month (simple % change)

Same pattern as before:

---

## 1️⃣ Add revenue data to `dashboardMockData.ts`

Open **`src/data/dashboardMockData.ts`** and add these types near the other interfaces:

```ts
export interface RevenueOverview {
  currency: string;
  today: number;
  forecastThisMonth: number;
  lastMonth: number;
  occupancy: number; // %
  adr: number;       // Average Daily Rate
  revpar: number;    // Revenue per Available Room
}

export interface ChannelSplit {
  channel: string;   // e.g. "Direct"
  bookings: number;
  revenue: number;
}
```

Then add the mock values with your other exported constants:

```ts
export const revenueOverview: RevenueOverview = {
  currency: "£",
  today: 18450,
  forecastThisMonth: 392000,
  lastMonth: 361200,
  occupancy: 82,
  adr: 145,   // average daily rate
  revpar: 119 // revenue per available room
};

export const channelSplit: ChannelSplit[] = [
  {
    channel: "Direct",
    bookings: 58,
    revenue: 9200,
  },
  {
    channel: "Booking.com",
    bookings: 34,
    revenue: 6200,
  },
  {
    channel: "Expedia",
    bookings: 18,
    revenue: 3100,
  },
  {
    channel: "Corporate",
    bookings: 22,
    revenue: 3950,
  },
];
```

You can tweak the numbers later – they’re just demo values.

---

## 2️⃣ Create `RevenueCard.tsx`

Create **`src/components/dashboard/RevenueCard.tsx`**:

```tsx
import React from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import type {
  RevenueOverview,
  ChannelSplit,
} from "../../data/dashboardMockData";
import {
  BanknotesIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";

interface Props {
  overview: RevenueOverview;
  channels: ChannelSplit[];
}

const ChannelTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <div className="font-semibold text-slate-800">{label}</div>
      <div className="mt-0.5 text-slate-600">
        Bookings:{" "}
        <span className="font-semibold text-slate-800">{item.bookings}</span>
      </div>
      <div className="text-slate-600">
        Revenue:{" "}
        <span className="font-semibold text-emerald-700">
          £{item.revenue.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

const RevenueCard: React.FC<Props> = ({ overview, channels }) => {
  const diff = overview.forecastThisMonth - overview.lastMonth;
  const pct =
    overview.lastMonth > 0
      ? Math.round((diff / overview.lastMonth) * 100)
      : 0;

  const isUp = pct >= 0;

  const totalChannelRevenue = channels.reduce(
    (sum, c) => sum + c.revenue,
    0
  );

  return (
    <div className="flex h-full flex-col rounded-2xl bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50">
            <BanknotesIcon className="h-4 w-4 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              Revenue & channel performance
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Today&apos;s pick-up and this month&apos;s forecast vs last month.
            </p>
          </div>
        </div>

        <div className="text-right text-xs">
          <div className="text-slate-400">This month vs last</div>
          <div
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              isUp
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            <ArrowTrendingUpIcon
              className={`h-3 w-3 ${
                isUp ? "" : "rotate-180"
              }`}
            />
            {isUp ? "+" : ""}
            {pct}%
          </div>
        </div>
      </div>

      {/* KPIs row */}
      <div className="mb-3 grid grid-cols-3 gap-3 text-xs">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <div className="text-slate-500">Today&apos;s revenue</div>
          <div className="mt-0.5 text-sm font-semibold text-slate-900">
            {overview.currency}
            {overview.today.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <div className="text-slate-500">ADR</div>
          <div className="mt-0.5 text-sm font-semibold text-slate-900">
            {overview.currency}
            {overview.adr.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">Avg daily rate</div>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <div className="text-slate-500">RevPAR</div>
          <div className="mt-0.5 text-sm font-semibold text-slate-900">
            {overview.currency}
            {overview.revpar.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            Occupancy: {overview.occupancy}%
          </div>
        </div>
      </div>

      {/* Channel chart */}
      <div className="mt-1 flex-1">
        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
          <span>Channel mix (revenue)</span>
          <span>
            Total:{" "}
            <span className="font-semibold text-slate-800">
              {overview.currency}
              {totalChannelRevenue.toLocaleString()}
            </span>
          </span>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={channels}
              margin={{ top: 10, right: 8, left: -18, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e7eb"
              />
              <XAxis
                dataKey="channel"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#6b7280" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#6b7280" }}
              />
              <Tooltip content={<ChannelTooltip />} />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Footer note */}
      <div className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
        Direct and corporate should grow over time while OTAs stay healthy but
        not dominant. Use this to tune your pricing and distribution strategy.
      </div>
    </div>
  );
};

export default RevenueCard;
```

> If your TypeScript complains about `toLocaleString()` on numbers, you can keep it as-is (it’s valid) or cast: `Number(value).toLocaleString()`.

---

## 3️⃣ Plug it into `DashboardPage.tsx`

Open **`src/pages/DashboardPage.tsx`**.

### a) Import the card + data

At the top with your other imports:

```tsx
import RevenueCard from "../components/dashboard/RevenueCard";

import {
  kpis,
  roomAvailability,
  occupancyLast7Days,
  ratingSummary,
  prioritiesToday,
  reservationsNext7Days,
  housekeepingSummary,
  housekeepingTasksToday,
  revenueOverview,
  channelSplit,
} from "../data/dashboardMockData";
```

*(keep your existing imports, just add the new ones)*

### b) Add a Revenue section under the existing rows

Find where you currently render the **Reservations + Housekeeping** row.
Under that, add this:

```tsx
      {/* Revenue row */}
      <section className="mt-6">
        <RevenueCard overview={revenueOverview} channels={channelSplit} />
      </section>
```

Your dashboard layout order will now be something like:

1. Top strip (priorities / filters / etc. if you have it)
2. KPI cards
3. Room availability + occupancy + ratings
4. Reservations vs cancellations + housekeeping status
5. **Revenue & channel performance** ✅

---

If you run `npm run dev` now, you should see a **very “SaaS-grade” revenue widget** that would not look out of place in a commercial HMS.

If you want to push this even more competitive later, we can add:

* Toggle: *Today · This week · This month*
* Channel “health” badges (e.g. “Direct under target”)
* Segment breakdown (Business vs Leisure, Individual vs Group)

But for now, this gives you a strong **MVP dashboard** covering:

* Rooms
* Guests
* Housekeeping
* Reservations & churn
* Revenue & channels

If you’re happy with this, next we can either:

* Start the **Bookings/Reservations screen** UI, or
* Design the **Rooms list & detail page** (with photos, amenities, rate plans).
------------------------------------------------------------------------------------------------------------------------------
Perfect, let’s move from “pretty dashboard” to **actual operations** – we’ll add a **Bookings / Reservations screen** that feels like a real HMS product.

This will be a separate page you can navigate to later (e.g. `/bookings`), but for now you can just render it instead of the dashboard to see it.

---

## 1️⃣ Add booking data to `dashboardMockData.ts`

Open **`src/data/dashboardMockData.ts`** and add these types near the top with your other interfaces:

```ts
export type BookingStatus =
  | "confirmed"
  | "checked-in"
  | "checked-out"
  | "cancelled"
  | "no-show";

export interface Booking {
  id: string;
  guestName: string;
  room: string;
  roomType: string;
  checkIn: string;   // ISO date string
  checkOut: string;  // ISO date string
  status: BookingStatus;
  channel: string;   // e.g. "Direct", "Booking.com"
  nights: number;
  totalAmount: number;
  balanceDue: number;
}
```

Then add some mock bookings (anywhere with the other `export const ...`):

```ts
export const bookingsToday: Booking[] = [
  {
    id: "BK-24001",
    guestName: "David Johnson",
    room: "305",
    roomType: "Deluxe King",
    checkIn: "2026-01-08",
    checkOut: "2026-01-11",
    status: "checked-in",
    channel: "Direct",
    nights: 3,
    totalAmount: 435,
    balanceDue: 0,
  },
  {
    id: "BK-24002",
    guestName: "Sarah Ahmed",
    room: "412",
    roomType: "Standard Queen",
    checkIn: "2026-01-08",
    checkOut: "2026-01-10",
    status: "confirmed",
    channel: "Booking.com",
    nights: 2,
    totalAmount: 260,
    balanceDue: 260,
  },
  {
    id: "BK-24003",
    guestName: "Michael Lee",
    room: "221",
    roomType: "Twin Room",
    checkIn: "2026-01-09",
    checkOut: "2026-01-12",
    status: "confirmed",
    channel: "Corporate",
    nights: 3,
    totalAmount: 390,
    balanceDue: 0,
  },
  {
    id: "BK-24004",
    guestName: "Jennifer Smith",
    room: "110",
    roomType: "Suite",
    checkIn: "2026-01-08",
    checkOut: "2026-01-09",
    status: "checked-out",
    channel: "Expedia",
    nights: 1,
    totalAmount: 220,
    balanceDue: 0,
  },
  {
    id: "BK-24005",
    guestName: "Pedro Santos",
    room: "218",
    roomType: "Standard Queen",
    checkIn: "2026-01-08",
    checkOut: "2026-01-09",
    status: "cancelled",
    channel: "Booking.com",
    nights: 1,
    totalAmount: 130,
    balanceDue: 0,
  },
];
```

You can adjust dates/amounts later – just demo data for now.

---

## 2️⃣ Create a Bookings / Reservations page

Create a new file:

**`src/pages/BookingsPage.tsx`**

Paste this full script:

```tsx
import React, { useMemo, useState } from "react";
import {
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import type { Booking, BookingStatus } from "../data/dashboardMockData";
import { bookingsToday } from "../data/dashboardMockData";

const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: "Confirmed",
  "checked-in": "Checked in",
  "checked-out": "Checked out",
  cancelled: "Cancelled",
  "no-show": "No-show",
};

const statusChipClass = (status: BookingStatus): string => {
  switch (status) {
    case "checked-in":
      return "bg-emerald-50 text-emerald-700 border border-emerald-100";
    case "confirmed":
      return "bg-sky-50 text-sky-700 border border-sky-100";
    case "checked-out":
      return "bg-slate-50 text-slate-700 border border-slate-200";
    case "cancelled":
      return "bg-rose-50 text-rose-700 border border-rose-100";
    case "no-show":
      return "bg-amber-50 text-amber-700 border border-amber-100";
    default:
      return "bg-slate-50 text-slate-700 border border-slate-200";
  }
};

const uniqueChannels = (items: Booking[]): string[] => {
  const set = new Set(items.map((b) => b.channel));
  return Array.from(set);
};

const BookingsPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">(
    "all"
  );
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const channels = useMemo(() => uniqueChannels(bookingsToday), []);

  const filtered = useMemo(() => {
    return bookingsToday.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (channelFilter !== "all" && b.channel !== channelFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const haystack = (
          b.guestName +
          " " +
          b.id +
          " " +
          b.room +
          " " +
          b.roomType +
          " " +
          b.channel
        ).toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [statusFilter, channelFilter, search]);

  const stats = useMemo(() => {
    const total = bookingsToday.length;
    const todaysArrivals = bookingsToday.filter(
      (b) => b.status === "confirmed"
    ).length;
    const inHouse = bookingsToday.filter(
      (b) => b.status === "checked-in"
    ).length;
    const cancelled = bookingsToday.filter(
      (b) => b.status === "cancelled" || b.status === "no-show"
    ).length;

    const revenueToday = bookingsToday
      .filter((b) => b.status === "checked-in" || b.status === "checked-out")
      .reduce((sum, b) => sum + b.totalAmount, 0);

    return { total, todaysArrivals, inHouse, cancelled, revenueToday };
  }, []);

  const handleExport = () => {
    // Simple client-side CSV export of filtered bookings
    const headers = [
      "Booking ID",
      "Guest",
      "Room",
      "Room Type",
      "Check-in",
      "Check-out",
      "Status",
      "Channel",
      "Nights",
      "Total",
      "Balance Due",
    ];

    const rows = filtered.map((b) => [
      b.id,
      b.guestName,
      b.room,
      b.roomType,
      b.checkIn,
      b.checkOut,
      STATUS_LABEL[b.status],
      b.channel,
      String(b.nights),
      String(b.totalAmount),
      String(b.balanceDue),
    ]);

    const csv = [headers, ...rows]
      .map((r) =>
        r
          .map((cell) => {
            const s = String(cell ?? "");
            // Escape quotes
            if (s.includes(",") || s.includes('"')) {
              return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const fileName = `bookings_export_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Bookings & reservations
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage today&apos;s arrivals, in-house guests and upcoming stays
              from a single screen.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export filtered ({filtered.length})
          </button>
        </header>

        {/* Summary cards */}
        <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white px-3.5 py-3 shadow-sm">
            <div className="text-xs text-slate-500">Total bookings (view)</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg font-semibold text-slate-900">
                {stats.total}
              </span>
              <span className="text-[11px] text-slate-500">
                Showing {filtered.length}
              </span>
            </div>
          </div>
          <div className="rounded-2xl bg-white px-3.5 py-3 shadow-sm">
            <div className="text-xs text-slate-500">Today&apos;s arrivals</div>
            <div className="mt-1 text-lg font-semibold text-sky-700">
              {stats.todaysArrivals}
            </div>
          </div>
          <div className="rounded-2xl bg-white px-3.5 py-3 shadow-sm">
            <div className="text-xs text-slate-500">In-house guests</div>
            <div className="mt-1 text-lg font-semibold text-emerald-700">
              {stats.inHouse}
            </div>
          </div>
          <div className="rounded-2xl bg-white px-3.5 py-3 shadow-sm">
            <div className="text-xs text-slate-500">Room revenue today</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              £{stats.revenueToday.toLocaleString()}
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white px-3.5 py-3 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            <FunnelIcon className="h-4 w-4" />
            Filters
          </div>

          {/* Status filter */}
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="mr-1 text-slate-500">Status:</span>
            {(["all", "confirmed", "checked-in", "checked-out", "cancelled", "no-show"] as const).map(
              (statusKey) => {
                const isAll = statusKey === "all";
                const label = isAll
                  ? "All"
                  : STATUS_LABEL[statusKey as BookingStatus];
                const active = statusFilter === statusKey;

                return (
                  <button
                    key={statusKey}
                    type="button"
                    onClick={() =>
                      setStatusFilter(
                        statusKey === "all" ? "all" : (statusKey as BookingStatus)
                      )
                    }
                    className={
                      "rounded-full px-2.5 py-1 " +
                      (active
                        ? "bg-slate-900 text-white"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100")
                    }
                  >
                    {label}
                  </button>
                );
              }
            )}
          </div>

          {/* Channel filter */}
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="mr-1 text-slate-500">Channel:</span>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
            >
              <option value="all">All channels</option>
              {channels.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="ml-auto flex items-center">
            <div className="relative">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search guest, booking ID, room..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 rounded-full border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* Table */}
        <section className="rounded-2xl bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
            {filtered.length} booking
            {filtered.length === 1 ? "" : "s"} shown
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">
                    Booking
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">
                    Guest
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">
                    Room
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">
                    Stay
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">
                    Channel
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-slate-500">
                    Total
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-slate-500">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2 align-top">
                      <div className="font-mono text-[11px] text-slate-700">
                        {b.id}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <div className="text-slate-800">{b.guestName}</div>
                      <div className="text-[11px] text-slate-500">
                        {b.nights} night{b.nights === 1 ? "" : "s"}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <div className="font-mono text-[11px] text-slate-700">
                        Room {b.room}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {b.roomType}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <div className="text-[11px] text-slate-700">
                        Check-in: {b.checkIn}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Check-out: {b.checkOut}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <span
                        className={
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] " +
                          statusChipClass(b.status)
                        }
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                        {STATUS_LABEL[b.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <div className="text-[11px] text-slate-700">
                        {b.channel}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-right">
                      <div className="text-[11px] font-semibold text-slate-900">
                        £{b.totalAmount.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-right">
                      <div
                        className={
                          "text-[11px] font-semibold " +
                          (b.balanceDue > 0
                            ? "text-amber-700"
                            : "text-slate-500")
                        }
                      >
                        £{b.balanceDue.toLocaleString()}
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-6 text-center text-xs text-slate-500"
                    >
                      No bookings match your current filters.
                      Try clearing filters or adjusting the search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default BookingsPage;
```

This page already feels like something you’d see in a **paid HMS**:

* KPI strip (total, arrivals, in-house, revenue today)
* Status chips (Confirmed / Checked-in / Cancelled / No-show)
* Channel filter
* Live search
* Export filtered bookings to CSV

---

## 3️⃣ How to see it running

For now, the easiest way to view this page is:

* In `src/main.tsx` (or wherever you render `<DashboardPage />`), temporarily render `<BookingsPage />` instead.

Example:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import BookingsPage from "./pages/BookingsPage"; // <— import

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BookingsPage />   {/* instead of <DashboardPage /> */}
  </React.StrictMode>
);
```

Later, when you’re ready, we can wire **proper navigation**:

* A top nav with: *Dashboard · Bookings · Rooms · Guests · Reports*
* Or a side menu like the SaaS dashboards you showed in your screenshots.

---

If you’re happy with the **Bookings page**, next we can:

* Build a **Room list + Room detail** page (with availability and housekeeping info), or
* Add an **inline booking detail drawer** (click a row → slide-out panel with full guest info, notes, payments).

Tell me “next” again and I’ll pick one and wire it in 😄
----------------------------------------------------------------------------------------------------------------------------
Alright, let’s turn this into a **real HMS Rooms module** now 🛏️

We’ll add:

* Room data (with status + housekeeping info)
* A **RoomsPage** showing:

  * Summary cards (Total / Occupied / Vacant / Out of service)
  * Filters (status + housekeeping)
  * Search
  * Room grid with color-coded tags & a small “next guest” line

---

## 1️⃣ Add room data to `dashboardMockData.ts`

Open **`src/data/dashboardMockData.ts`** and add these types near the top:

```ts
export type RoomStatus = "occupied" | "vacant" | "out-of-service" | "reserved";

export type HousekeepingStatus = "clean" | "dirty" | "in-progress";

export interface Room {
  id: string;          // e.g. "101"
  floor: number;
  type: string;        // "Standard", "Deluxe King", etc.
  status: RoomStatus;
  hkStatus: HousekeepingStatus;
  nextGuest?: string;  // optional – next arriving guest name
  nextCheckIn?: string;// optional ISO date string
  rate: number;        // base nightly rate
}
```

Then add some mock rooms (anywhere with the other `export const ...`):

```ts
export const rooms: Room[] = [
  {
    id: "101",
    floor: 1,
    type: "Standard Queen",
    status: "occupied",
    hkStatus: "clean",
    nextGuest: "—",
    rate: 120,
  },
  {
    id: "102",
    floor: 1,
    type: "Standard Queen",
    status: "vacant",
    hkStatus: "clean",
    nextGuest: "Sarah Ahmed",
    nextCheckIn: "2026-01-09",
    rate: 125,
  },
  {
    id: "103",
    floor: 1,
    type: "Deluxe King",
    status: "reserved",
    hkStatus: "clean",
    nextGuest: "Michael Lee",
    nextCheckIn: "2026-01-08",
    rate: 155,
  },
  {
    id: "201",
    floor: 2,
    type: "Twin Room",
    status: "occupied",
    hkStatus: "dirty",
    nextGuest: "—",
    rate: 135,
  },
  {
    id: "202",
    floor: 2,
    type: "Suite",
    status: "out-of-service",
    hkStatus: "in-progress",
    nextGuest: "—",
    rate: 220,
  },
  {
    id: "203",
    floor: 2,
    type: "Standard Queen",
    status: "vacant",
    hkStatus: "dirty",
    nextGuest: "David Johnson",
    nextCheckIn: "2026-01-10",
    rate: 130,
  },
];
```

You can tweak floors / rates later.

---

## 2️⃣ Create **`RoomsPage.tsx`**

Create a new file: **`src/pages/RoomsPage.tsx`**
Paste this full code:

```tsx
import React, { useMemo, useState } from "react";
import {
  BuildingOffice2Icon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import type {
  Room,
  RoomStatus,
  HousekeepingStatus,
} from "../data/dashboardMockData";
import { rooms } from "../data/dashboardMockData";

const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  occupied: "Occupied",
  vacant: "Vacant",
  "out-of-service": "Out of service",
  reserved: "Reserved",
};

const HK_STATUS_LABEL: Record<HousekeepingStatus, string> = {
  clean: "Clean",
  dirty: "Dirty",
  "in-progress": "In progress",
};

const roomStatusClass = (status: RoomStatus): string => {
  switch (status) {
    case "occupied":
      return "bg-emerald-50 text-emerald-700 border border-emerald-100";
    case "vacant":
      return "bg-sky-50 text-sky-700 border border-sky-100";
    case "reserved":
      return "bg-amber-50 text-amber-700 border border-amber-100";
    case "out-of-service":
      return "bg-rose-50 text-rose-700 border border-rose-100";
    default:
      return "bg-slate-50 text-slate-700 border border-slate-200";
  }
};

const hkStatusClass = (status: HousekeepingStatus): string => {
  switch (status) {
    case "clean":
      return "bg-emerald-50 text-emerald-700 border border-emerald-100";
    case "dirty":
      return "bg-rose-50 text-rose-700 border border-rose-100";
    case "in-progress":
      return "bg-amber-50 text-amber-700 border border-amber-100";
    default:
      return "bg-slate-50 text-slate-700 border border-slate-200";
  }
};

const RoomsPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<RoomStatus | "all">("all");
  const [hkFilter, setHkFilter] = useState<HousekeepingStatus | "all">("all");
  const [search, setSearch] = useState("");

  const stats = useMemo(() => {
    const total = rooms.length;
    const occupied = rooms.filter((r) => r.status === "occupied").length;
    const vacant = rooms.filter((r) => r.status === "vacant").length;
    const outOfService = rooms.filter(
      (r) => r.status === "out-of-service"
    ).length;

    const clean = rooms.filter((r) => r.hkStatus === "clean").length;
    const dirty = rooms.filter((r) => r.hkStatus === "dirty").length;
    const inProgress = rooms.filter(
      (r) => r.hkStatus === "in-progress"
    ).length;

    return { total, occupied, vacant, outOfService, clean, dirty, inProgress };
  }, []);

  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (hkFilter !== "all" && r.hkStatus !== hkFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const haystack = (
          r.id +
          " " +
          r.type +
          " " +
          r.floor +
          " " +
          (r.nextGuest || "")
        ).toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [statusFilter, hkFilter, search]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Rooms & occupancy
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Live overview of room status, housekeeping and upcoming arrivals.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm">
            <BuildingOffice2Icon className="h-4 w-4" />
            <span>{stats.total} rooms</span>
          </div>
        </header>

        {/* Summary cards */}
        <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white px-3.5 py-3 shadow-sm">
            <div className="text-xs text-slate-500">Occupied</div>
            <div className="mt-1 text-lg font-semibold text-emerald-700">
              {stats.occupied}
            </div>
            <div className="text-[11px] text-slate-500">
              {Math.round((stats.occupied / Math.max(stats.total, 1)) * 100)}%
              &nbsp;of inventory
            </div>
          </div>
          <div className="rounded-2xl bg-white px-3.5 py-3 shadow-sm">
            <div className="text-xs text-slate-500">Vacant & sellable</div>
            <div className="mt-1 text-lg font-semibold text-sky-700">
              {stats.vacant}
            </div>
            <div className="text-[11px] text-slate-500">
              Ready to assign or book
            </div>
          </div>
          <div className="rounded-2xl bg-white px-3.5 py-3 shadow-sm">
            <div className="text-xs text-slate-500">Out of service</div>
            <div className="mt-1 text-lg font-semibold text-rose-700">
              {stats.outOfService}
            </div>
            <div className="text-[11px] text-slate-500">
              Remove from availability until fixed
            </div>
          </div>
          <div className="rounded-2xl bg-white px-3.5 py-3 shadow-sm">
            <div className="text-xs text-slate-500">Housekeeping</div>
            <div className="mt-1 text-sm text-slate-800">
              <span className="font-semibold">{stats.clean}</span> clean ·{" "}
              <span className="font-semibold text-amber-700">
                {stats.inProgress}
              </span>{" "}
              in progress ·{" "}
              <span className="font-semibold text-rose-700">
                {stats.dirty}
              </span>{" "}
              dirty
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white px-3.5 py-3 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            <FunnelIcon className="h-4 w-4" />
            Filters
          </div>

          {/* Room status filter */}
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="mr-1 text-slate-500">Room status:</span>
            {(["all", "occupied", "vacant", "reserved", "out-of-service"] as const).map(
              (key) => {
                const label =
                  key === "all" ? "All" : ROOM_STATUS_LABEL[key as RoomStatus];
                const active = statusFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setStatusFilter(
                        key === "all" ? "all" : (key as RoomStatus)
                      )
                    }
                    className={
                      "rounded-full px-2.5 py-1 " +
                      (active
                        ? "bg-slate-900 text-white"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100")
                    }
                  >
                    {label}
                  </button>
                );
              }
            )}
          </div>

          {/* Housekeeping filter */}
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="mr-1 text-slate-500">Housekeeping:</span>
            <select
              value={hkFilter}
              onChange={(e) =>
                setHkFilter(
                  e.target.value === "all"
                    ? "all"
                    : (e.target.value as HousekeepingStatus)
                )
              }
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
            >
              <option value="all">All</option>
              <option value="clean">Clean</option>
              <option value="in-progress">In progress</option>
              <option value="dirty">Dirty</option>
            </select>
          </div>

          {/* Search */}
          <div className="ml-auto flex items-center">
            <div className="relative">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search room, type, guest…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 rounded-full border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* Room grid */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRooms.map((room) => (
            <article
              key={room.id}
              className="flex flex-col rounded-2xl bg-white p-3.5 shadow-sm"
            >
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <div className="text-xs font-medium text-slate-500">
                    Room
                  </div>
                  <div className="text-lg font-semibold text-slate-900">
                    {room.id}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Floor {room.floor} · {room.type}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] " +
                      roomStatusClass(room.status)
                    }
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                    {ROOM_STATUS_LABEL[room.status]}
                  </span>
                  <span
                    className={
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] " +
                      hkStatusClass(room.hkStatus)
                    }
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                    HK: {HK_STATUS_LABEL[room.hkStatus]}
                  </span>
                </div>
              </div>

              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-600">
                <div>
                  <span className="text-slate-500">Base rate: </span>
                  <span className="font-semibold text-slate-900">
                    £{room.rate.toLocaleString()}
                  </span>
                  <span className="text-slate-400"> /night</span>
                </div>
                {room.status === "vacant" && room.nextGuest && (
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700">
                    Next: {room.nextGuest}
                    {room.nextCheckIn && ` · ${room.nextCheckIn}`}
                  </span>
                )}
                {room.status === "occupied" && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                    In-house guest
                  </span>
                )}
              </div>

              {/* Future quick actions placeholder */}
              <div className="mt-3 flex gap-1">
                <button
                  type="button"
                  className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                >
                  View details
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                >
                  Assign guest
                </button>
              </div>
            </article>
          ))}

          {filteredRooms.length === 0 && (
            <div className="col-span-full rounded-2xl bg-white px-4 py-6 text-center text-xs text-slate-500 shadow-sm">
              No rooms match your current filters. Try clearing filters or
              adjusting your search.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default RoomsPage;
```

---

## 3️⃣ How to view the Rooms page

Temporarily switch your entry point to this page so you can see it.

In **`src/main.tsx`** (or wherever you render the app):

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
// import DashboardPage from "./pages/DashboardPage";
// import BookingsPage from "./pages/BookingsPage";
import RoomsPage from "./pages/RoomsPage";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RoomsPage />
  </React.StrictMode>
);
```

Later we’ll add a **top navigation** so you can switch between:

* Dashboard
* Bookings
* Rooms
* Reports

…without editing `main.tsx`.

---

If you’re happy with this Rooms view, the next “competitive” step is to:

* Add a **Room detail drawer** (click “View details” → show full info, housekeeping history, maintenance), or
* Start wiring **all three pages** (Dashboard, Bookings, Rooms) into a single layout with navigation.

Say **“next”** and I’ll pick one and build it out.
-----------------------------------------------------------------------------------------------------------------------
Nice, let’s wire the whole HMS into a **proper multi-page app shell** now 💅

We’ll add:

* A top navigation (Dashboard / Bookings / Rooms / Reports)
* A centered content area using your existing Tailwind-ish styling
* Use your existing `DashboardPage`, `BookingsPage`, and the new `RoomsPage`

---

## 1️⃣ Create / update `src/App.tsx`

Create a new file **`src/App.tsx`** (or replace the existing one) with this code:

```tsx
import React, { useState } from "react";
import {
  HomeIcon,
  CalendarDaysIcon,
  BuildingOffice2Icon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

import DashboardPage from "./pages/DashboardPage";
import BookingsPage from "./pages/BookingsPage";
import RoomsPage from "./pages/RoomsPage";

type PageKey = "dashboard" | "bookings" | "rooms" | "reports";

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageKey>("dashboard");

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage />;
      case "bookings":
        return <BookingsPage />;
      case "rooms":
        return <RoomsPage />;
      case "reports":
        // You can replace this stub later with a real Reports page
        return (
          <div className="min-h-screen bg-slate-50">
            <div className="mx-auto max-w-6xl px-4 py-8">
              <h1 className="text-2xl font-semibold text-slate-900">
                Reports & analytics
              </h1>
              <p className="mt-2 max-w-xl text-sm text-slate-600">
                This area will host revenue, occupancy, channel performance and
                exportable reports for finance and management.
              </p>
              <div className="mt-6 rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm">
                <p>
                  Placeholder for now – we can add occupancy trends, ADR,
                  RevPAR, guest segments and export buttons here.
                </p>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const navItemClasses = (active: boolean) =>
    [
      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors",
      active
        ? "bg-slate-900 text-white shadow-sm"
        : "bg-slate-100 text-slate-700 hover:bg-slate-200",
    ].join(" ");

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top bar */}
      <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-slate-950">
              <span className="text-xs font-bold">HMS</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-white">
                Olive Hotel Suite
              </div>
              <div className="text-[11px] text-slate-400">
                Modern hotel operations & guest experience
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="hidden items-center gap-2 md:flex">
            <button
              className={navItemClasses(currentPage === "dashboard")}
              onClick={() => setCurrentPage("dashboard")}
            >
              <HomeIcon className="h-4 w-4" />
              Dashboard
            </button>
            <button
              className={navItemClasses(currentPage === "bookings")}
              onClick={() => setCurrentPage("bookings")}
            >
              <CalendarDaysIcon className="h-4 w-4" />
              Bookings
            </button>
            <button
              className={navItemClasses(currentPage === "rooms")}
              onClick={() => setCurrentPage("rooms")}
            >
              <BuildingOffice2Icon className="h-4 w-4" />
              Rooms
            </button>
            <button
              className={navItemClasses(currentPage === "reports")}
              onClick={() => setCurrentPage("reports")}
            >
              <ChartBarIcon className="h-4 w-4" />
              Reports
            </button>
          </nav>

          {/* Right side: small profile stub */}
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs text-slate-400 sm:block">
              <div className="font-medium text-slate-100">
                Duty manager (demo)
              </div>
              <div>Front desk · Night shift</div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-[11px] font-medium text-slate-100">
              DM
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="border-t border-slate-800 px-4 pb-3 pt-2 md:hidden">
          <div className="flex flex-wrap gap-2">
            <button
              className={navItemClasses(currentPage === "dashboard")}
              onClick={() => setCurrentPage("dashboard")}
            >
              <HomeIcon className="h-4 w-4" />
              Dashboard
            </button>
            <button
              className={navItemClasses(currentPage === "bookings")}
              onClick={() => setCurrentPage("bookings")}
            >
              <CalendarDaysIcon className="h-4 w-4" />
              Bookings
            </button>
            <button
              className={navItemClasses(currentPage === "rooms")}
              onClick={() => setCurrentPage("rooms")}
            >
              <BuildingOffice2Icon className="h-4 w-4" />
              Rooms
            </button>
            <button
              className={navItemClasses(currentPage === "reports")}
              onClick={() => setCurrentPage("reports")}
            >
              <ChartBarIcon className="h-4 w-4" />
              Reports
            </button>
          </div>
        </div>
      </header>

      {/* Main content (each page handles its own inner layout) */}
      <main>{renderPage()}</main>
    </div>
  );
};

export default App;
```

> 🔧 If TypeScript complains about the heroicons imports, make sure you have
> `@heroicons/react` installed:
>
> ```bash
> npm install @heroicons/react
> ```

---

## 2️⃣ Update `src/main.tsx` to use `<App />`

Now point your app entry at this shell instead of a single page.

In **`src/main.tsx`** (or the equivalent entry file), use:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Now when you run:

```bash
npm run dev
```

you should get:

* A **dark top bar** with “Olive Hotel Suite”
* Navigation pills for **Dashboard / Bookings / Rooms / Reports**
* Clicking **Rooms** shows the Rooms UI we just built
* Dashboard/Bookings show your existing mock dashboards

---

## 3️⃣ If anything is missing

If `DashboardPage` or `BookingsPage` don’t exist yet, you can temporarily create super-simple placeholders so the shell compiles:

```tsx
// src/pages/DashboardPage.tsx
import React from "react";

const DashboardPage: React.FC = () => (
  <div className="min-h-screen bg-slate-50">
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">
        Hotel dashboard (placeholder)
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        We&apos;ll plug in KPIs, charts, arrivals and departures here.
      </p>
    </div>
  </div>
);

export default DashboardPage;
```

```tsx
// src/pages/BookingsPage.tsx
import React from "react";

const BookingsPage: React.FC = () => (
  <div className="min-h-screen bg-slate-50">
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">
        Bookings & stays (placeholder)
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        This will become your combined booking grid and guest timeline.
      </p>
    </div>
  </div>
);

export default BookingsPage;
```

---

If you want, the **next step** after this shell can be:

* A **Bookings grid** inspired by the screenshots (date strip + rows per room / guest), or
* A **Dashboard KPI row + charts** like the examples you shared.

Tell me **“bookings”** or **“dashboard KPIs”** and I’ll generate the next page in the same style.
---------------------------------------------------------------------------------------------------------------------

Cool, let’s level up the **Dashboard** now 🔥

Here’s a **full replacement** for `src/pages/DashboardPage.tsx` that gives you:

* A **KPI row** (Occupancy, In-house rooms, Arrivals, Departures)
* A **“Today at a glance”** card with arrivals & departures
* A **“Revenue & occupancy”** card with ADR / RevPAR etc.
* A bottom row with **Top Channels** and **Operations alerts**

All purely front-end with mock data (so you can see everything instantly).

---

### `src/pages/DashboardPage.tsx`

```tsx
import React from "react";
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  UsersIcon,
  CalendarDaysIcon,
  GlobeAltIcon,
  BuildingOffice2Icon,
  CreditCardIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

const DashboardPage: React.FC = () => {
  // Mock stats – later you can plug in real data from the backend
  const kpis = {
    occupancy: 78, // %
    inHouseRooms: 64,
    arrivalsToday: 12,
    departuresToday: 9,
    adr: 145, // Average Daily Rate
    revPar: 113,
    roomsAvailable: 82,
    forecastOccupancy: 81,
  };

  const arrivals = [
    { guest: "Sarah Ahmed", room: "102", time: "14:00", channel: "Booking.com" },
    { guest: "Michael Lee", room: "305", time: "15:30", channel: "Direct" },
    { guest: "David Johnson", room: "204", time: "17:15", channel: "Expedia" },
    { guest: "Anna Müller", room: "401", time: "18:45", channel: "Corporate" },
  ];

  const departures = [
    { guest: "James Brown", room: "201", time: "11:00", status: "Checked out" },
    { guest: "Laura Smith", room: "312", time: "10:30", status: "Pending" },
    { guest: "Luis Garcia", room: "108", time: "12:00", status: "Late check-out" },
  ];

  const channels = [
    { name: "Direct", share: 42, adr: 155 },
    { name: "Booking.com", share: 28, adr: 140 },
    { name: "Expedia", share: 18, adr: 138 },
    { name: "Corporate", share: 12, adr: 160 },
  ];

  const alerts = [
    {
      type: "Housekeeping",
      message: "3 rooms marked dirty for more than 6 hours",
      severity: "medium",
    },
    {
      type: "Overbooking",
      message: "1 potential overbooking tomorrow (Deluxe King)",
      severity: "high",
    },
    {
      type: "Maintenance",
      message: "2 rooms out of service – follow up with engineering",
      severity: "medium",
    },
  ];

  const severityBadgeClass = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-rose-50 text-rose-700 border border-rose-100";
      case "medium":
        return "bg-amber-50 text-amber-800 border border-amber-100";
      default:
        return "bg-slate-50 text-slate-700 border border-slate-200";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Front desk overview
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Today&apos;s occupancy, arrivals, departures and revenue snapshot
              for duty managers.
            </p>
          </div>
          <div className="rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-slate-50 shadow-sm flex items-center gap-2">
            <ChartBarIcon className="h-4 w-4" />
            <span>Today · Live data (demo)</span>
          </div>
        </header>

        {/* KPI Row */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Today&apos;s occupancy</span>
              <ArrowTrendingUpIcon className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-semibold text-slate-900">
                {kpis.occupancy}%
              </span>
              <span className="text-[11px] text-slate-500">
                Forecast {kpis.forecastOccupancy}%
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${kpis.occupancy}%` }}
              />
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              {kpis.roomsAvailable} rooms available tonight
            </div>
          </div>

          <div className="flex flex-col rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">In-house rooms</span>
              <UsersIcon className="h-4 w-4 text-sky-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-semibold text-slate-900">
                {kpis.inHouseRooms}
              </span>
              <span className="text-[11px] text-slate-500">
                guests currently staying
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Mixture of leisure, business, and corporate stays.
            </div>
          </div>

          <div className="flex flex-col rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Arrivals today</span>
              <CalendarDaysIcon className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-semibold text-slate-900">
                {kpis.arrivalsToday}
              </span>
              <span className="text-[11px] text-slate-500">expected check-ins</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Prioritize VIPs and late arrivals for room readiness.
            </div>
          </div>

          <div className="flex flex-col rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Departures today</span>
              <BuildingOffice2Icon className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-semibold text-slate-900">
                {kpis.departuresToday}
              </span>
              <span className="text-[11px] text-slate-500">scheduled check-outs</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Coordinate with housekeeping to turn rooms quickly.
            </div>
          </div>
        </section>

        {/* Middle row: Today at a glance + Revenue */}
        <section className="grid gap-4 lg:grid-cols-3">
          {/* Today at a glance */}
          <div className="lg:col-span-2 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Today at a glance
              </h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
                Local time · Live snapshot
              </span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {/* Arrivals */}
              <div>
                <h3 className="mb-2 flex items-center gap-1 text-xs font-medium text-slate-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Arrivals
                </h3>
                <ul className="space-y-1.5">
                  {arrivals.map((a, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs"
                    >
                      <div>
                        <div className="font-medium text-slate-900">
                          {a.guest}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Room {a.room} · {a.channel}
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-slate-500">
                        <div className="font-medium text-slate-800">
                          {a.time}
                        </div>
                        <div>ETA</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Departures */}
              <div>
                <h3 className="mb-2 flex items-center gap-1 text-xs font-medium text-slate-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  Departures
                </h3>
                <ul className="space-y-1.5">
                  {departures.map((d, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs"
                    >
                      <div>
                        <div className="font-medium text-slate-900">
                          {d.guest}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Room {d.room}
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-slate-500">
                        <div className="font-medium text-slate-800">
                          {d.time}
                        </div>
                        <div>{d.status}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Revenue & occupancy */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Revenue & occupancy
              </h2>
              <CreditCardIcon className="h-4 w-4 text-slate-500" />
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">ADR (Average Daily Rate)</span>
                <span className="font-semibold text-slate-900">
                  £{kpis.adr.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">RevPAR</span>
                <span className="font-semibold text-slate-900">
                  £{kpis.revPar.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Rooms sold</span>
                <span className="font-semibold text-slate-900">
                  {kpis.inHouseRooms} / {kpis.roomsAvailable + kpis.inHouseRooms}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600">
              <div className="mb-1 flex items-center gap-1">
                <ArrowTrendingUpIcon className="h-4 w-4 text-emerald-600" />
                <span className="font-medium text-slate-800">
                  7-day occupancy trend
                </span>
              </div>
              <p>
                Occupancy has trended above 75% this week with stronger direct
                bookings and stable ADR across weekdays.
              </p>
            </div>
          </div>
        </section>

        {/* Bottom row: Channels + Alerts */}
        <section className="grid gap-4 lg:grid-cols-2">
          {/* Channels */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Top booking channels
              </h2>
              <GlobeAltIcon className="h-4 w-4 text-slate-500" />
            </div>
            <ul className="space-y-1.5 text-xs">
              {channels.map((c) => (
                <li
                  key={c.name}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <div>
                      <div className="font-medium text-slate-900">
                        {c.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        ADR £{c.adr.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-900">
                      {c.share}%
                    </span>{" "}
                    of room nights
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Alerts */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Operational alerts
              </h2>
              <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
            </div>
            <ul className="space-y-1.5 text-xs">
              {alerts.map((a, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 rounded-xl bg-slate-50 px-2.5 py-1.5"
                >
                  <span
                    className={
                      "mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " +
                      severityBadgeClass(a.severity)
                    }
                  >
                    {a.type}
                  </span>
                  <p className="text-slate-700">{a.message}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;
```

---

You don’t need to change anything else – since your `App.tsx` is already switching between pages, this will **immediately give you a much more “real product” dashboard**.

If you want, next we can:

* Make a **Bookings timeline** (date strip + rows per room), or
* Start wiring **API endpoints** later to replace the mock data.

Tell me which one you want next: **“bookings timeline”** or **“backend for stats”**.
-----------------------------------------------------------------------------------------------------------------------------
Nice, let’s give you a **Bookings timeline page** that actually looks like a PMS screen, not a school project 😄

Here’s a **full `BookingsPage.tsx`** you can drop into `src/pages/BookingsPage.tsx`.

It includes:

* Date strip with “Today / Tomorrow / 7 days” style quick filters
* A “Today’s bookings” summary row
* A **Bookings table** with status chips and channel icons
* Filter pills (All / Arrivals / In-house / Departures / No-show)

---

### `src/pages/BookingsPage.tsx`

```tsx
import React, { useState } from "react";
import {
  CalendarDaysIcon,
  MoonIcon,
  SunIcon,
  UsersIcon,
  BuildingOffice2Icon,
  GlobeAltIcon,
  ArrowRightCircleIcon,
} from "@heroicons/react/24/outline";

type BookingStatus = "arrival" | "inhouse" | "departure" | "noshow";

interface Booking {
  id: string;
  guest: string;
  room: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  status: BookingStatus;
  channel: "Direct" | "Booking.com" | "Expedia" | "Corporate";
  balance: number;
  notes?: string;
  vip?: boolean;
  eta?: string;
}

const mockBookings: Booking[] = [
  {
    id: "BKG-10234",
    guest: "Sarah Ahmed",
    room: "102",
    roomType: "Deluxe King",
    checkIn: "Today",
    checkOut: "Fri, 12 Jan",
    nights: 3,
    status: "arrival",
    channel: "Booking.com",
    balance: 180,
    eta: "14:00",
  },
  {
    id: "BKG-10235",
    guest: "Michael Lee",
    room: "305",
    roomType: "Executive Suite",
    checkIn: "Today",
    checkOut: "Thu, 11 Jan",
    nights: 2,
    status: "inhouse",
    channel: "Corporate",
    balance: 0,
    notes: "Late checkout approved",
    vip: true,
  },
  {
    id: "BKG-10236",
    guest: "David Johnson",
    room: "204",
    roomType: "Standard Twin",
    checkIn: "Tomorrow",
    checkOut: "Sat, 13 Jan",
    nights: 2,
    status: "arrival",
    channel: "Direct",
    balance: 260,
  },
  {
    id: "BKG-10237",
    guest: "Anna Müller",
    room: "401",
    roomType: "Deluxe King",
    checkIn: "Today",
    checkOut: "Today",
    nights: 1,
    status: "departure",
    channel: "Expedia",
    balance: 0,
    notes: "Airport transfer at 17:30",
  },
  {
    id: "BKG-10238",
    guest: "James Brown",
    room: "201",
    roomType: "Standard Double",
    checkIn: "Yesterday",
    checkOut: "Today",
    nights: 1,
    status: "departure",
    channel: "Direct",
    balance: 45,
  },
  {
    id: "BKG-10239",
    guest: "Laura Smith",
    room: "312",
    roomType: "Standard Double",
    checkIn: "Today",
    checkOut: "Thu, 11 Jan",
    nights: 2,
    status: "noshow",
    channel: "Booking.com",
    balance: 90,
    notes: "No-show, card on file",
  },
];

const statusLabel: Record<BookingStatus, string> = {
  arrival: "Arrival",
  inhouse: "In-house",
  departure: "Departure",
  noshow: "No-show",
};

const statusBadgeClass: Record<BookingStatus, string> = {
  arrival:
    "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
  inhouse:
    "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
  departure:
    "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
  noshow:
    "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
};

const channelPillClass = (channel: Booking["channel"]) => {
  switch (channel) {
    case "Direct":
      return "bg-emerald-50 text-emerald-800 border-emerald-100";
    case "Booking.com":
      return "bg-indigo-50 text-indigo-800 border-indigo-100";
    case "Expedia":
      return "bg-amber-50 text-amber-800 border-amber-100";
    case "Corporate":
    default:
      return "bg-slate-50 text-slate-800 border-slate-200";
  }
};

const BookingsPage: React.FC = () => {
  const [dayFilter, setDayFilter] = useState<"today" | "tomorrow" | "7days">(
    "today"
  );
  const [statusFilter, setStatusFilter] = useState<
    "all" | BookingStatus
  >("all");

  // In real app, these would filter by actual dates.
  const filteredByDay = mockBookings.filter((b) => {
    if (dayFilter === "today") {
      return b.checkIn === "Today" || b.checkOut === "Today";
    }
    if (dayFilter === "tomorrow") {
      return b.checkIn === "Tomorrow";
    }
    return true; // 7 days => show all mock data
  });

  const filteredBookings = filteredByDay.filter((b) => {
    if (statusFilter === "all") return true;
    return b.status === statusFilter;
  });

  const arrivalsToday = mockBookings.filter(
    (b) => b.status === "arrival" && b.checkIn === "Today"
  ).length;
  const departuresToday = mockBookings.filter(
    (b) => b.status === "departure" && b.checkOut === "Today"
  ).length;
  const inhouseCount = mockBookings.filter(
    (b) => b.status === "inhouse"
  ).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Bookings & stays
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage today&apos;s arrivals, in-house guests and departures in
              one place.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-50 shadow-sm">
              <CalendarDaysIcon className="h-4 w-4" />
              Today&apos;s schedule
            </button>
          </div>
        </header>

        {/* Day filter strip + summary */}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Day pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <DayPill
                label="Today"
                icon={SunIcon}
                active={dayFilter === "today"}
                onClick={() => setDayFilter("today")}
              />
              <DayPill
                label="Tomorrow"
                icon={MoonIcon}
                active={dayFilter === "tomorrow"}
                onClick={() => setDayFilter("tomorrow")}
              />
              <DayPill
                label="Next 7 days"
                icon={CalendarDaysIcon}
                active={dayFilter === "7days"}
                onClick={() => setDayFilter("7days")}
              />
            </div>

            {/* Summary chips */}
            <div className="flex flex-wrap gap-2 text-xs">
              <SummaryChip
                label="Arrivals today"
                value={arrivalsToday}
                icon={UsersIcon}
              />
              <SummaryChip
                label="In-house"
                value={inhouseCount}
                icon={BuildingOffice2Icon}
              />
              <SummaryChip
                label="Departures today"
                value={departuresToday}
                icon={ArrowRightCircleIcon}
              />
            </div>
          </div>
        </section>

        {/* Status filters + bookings table */}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          {/* Status filter row */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <StatusFilterPill
                label="All"
                active={statusFilter === "all"}
                onClick={() => setStatusFilter("all")}
              />
              <StatusFilterPill
                label="Arrivals"
                active={statusFilter === "arrival"}
                onClick={() => setStatusFilter("arrival")}
              />
              <StatusFilterPill
                label="In-house"
                active={statusFilter === "inhouse"}
                onClick={() => setStatusFilter("inhouse")}
              />
              <StatusFilterPill
                label="Departures"
                active={statusFilter === "departure"}
                onClick={() => setStatusFilter("departure")}
              />
              <StatusFilterPill
                label="No-shows"
                active={statusFilter === "noshow"}
                onClick={() => setStatusFilter("noshow")}
              />
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <GlobeAltIcon className="h-3.5 w-3.5" />
              <span>{filteredBookings.length} bookings in view</span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-slate-100">
            <div className="max-h-[420px] overflow-auto">
              <table className="min-w-full divide-y divide-slate-100 text-xs">
                <thead className="bg-slate-50/80">
                  <tr>
                    <Th>Guest</Th>
                    <Th>Room</Th>
                    <Th>Stay</Th>
                    <Th>Status</Th>
                    <Th>Channel</Th>
                    <Th className="text-right">Balance</Th>
                    <Th>Notes</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/80">
                      {/* Guest */}
                      <Td>
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">
                            {b.guest}
                            {b.vip && (
                              <span className="ml-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                VIP
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {b.id}
                          </span>
                        </div>
                      </Td>

                      {/* Room */}
                      <Td>
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">
                            {b.room}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {b.roomType}
                          </span>
                        </div>
                      </Td>

                      {/* Stay */}
                      <Td>
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">
                            {b.checkIn} → {b.checkOut}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {b.nights} night{b.nights > 1 ? "s" : ""}
                            {b.eta && ` · ETA ${b.eta}`}
                          </span>
                        </div>
                      </Td>

                      {/* Status */}
                      <Td>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass[b.status]}`}
                        >
                          {statusLabel[b.status]}
                        </span>
                      </Td>

                      {/* Channel */}
                      <Td>
                        <span
                          className={
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium " +
                            channelPillClass(b.channel)
                          }
                        >
                          {b.channel === "Direct" && (
                            <UsersIcon className="h-3 w-3" />
                          )}
                          {b.channel !== "Direct" && (
                            <GlobeAltIcon className="h-3 w-3" />
                          )}
                          {b.channel}
                        </span>
                      </Td>

                      {/* Balance */}
                      <Td className="text-right">
                        {b.balance === 0 ? (
                          <span className="text-[11px] font-medium text-emerald-600">
                            Settled
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-900">
                            £{b.balance.toLocaleString()}
                          </span>
                        )}
                      </Td>

                      {/* Notes */}
                      <Td>
                        <span className="text-[11px] text-slate-500">
                          {b.notes || "—"}
                        </span>
                      </Td>
                    </tr>
                  ))}

                  {filteredBookings.length === 0 && (
                    <tr>
                      <td
                        className="px-4 py-6 text-center text-xs text-slate-500"
                        colSpan={7}
                      >
                        No bookings match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-slate-500">
            In a production HMS this table would connect to your PMS / channel
            manager and support check-in, check-out, room move, and folio
            actions directly from each row.
          </p>
        </section>
      </div>
    </div>
  );
};

const Th: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <th
    scope="col"
    className={
      "px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 " +
      className
    }
  >
    {children}
  </th>
);

const Td: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => (
  <td className={"px-4 py-2 align-top text-xs text-slate-700 " + className}>
    {children}
  </td>
);

interface DayPillProps {
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  active: boolean;
  onClick: () => void;
}

const DayPill: React.FC<DayPillProps> = ({
  label,
  icon: Icon,
  active,
  onClick,
}) => {
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors";
  const activeCls = "bg-slate-900 text-slate-50 shadow-sm";
  const inactiveCls =
    "bg-slate-100 text-slate-700 hover:bg-slate-200";

  return (
    <button
      type="button"
      onClick={onClick}
      className={base + " " + (active ? activeCls : inactiveCls)}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
};

interface StatusFilterPillProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

const StatusFilterPill: React.FC<StatusFilterPillProps> = ({
  label,
  active,
  onClick,
}) => {
  const base =
    "inline-flex items-center rounded-full px-3 py-1.5 cursor-pointer transition-colors";
  const activeCls =
    "bg-slate-900 text-slate-50 font-semibold shadow-sm";
  const inactiveCls =
    "bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium";

  return (
    <button
      type="button"
      onClick={onClick}
      className={base + " " + (active ? activeCls : inactiveCls)}
    >
      {label}
    </button>
  );
};

const SummaryChip: React.FC<{
  label: string;
  value: number;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}> = ({ label, value, icon: Icon }) => (
  <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-700">
    <Icon className="h-3.5 w-3.5 text-slate-500" />
    <span className="font-semibold text-slate-900">{value}</span>
    <span>{label}</span>
  </div>
);

export default BookingsPage;
```

---

You don’t need to change `App.tsx` – it already imports `BookingsPage`, so as soon as you save this file and run `npm run dev`, your **Bookings tab** should look like a real HMS bookings screen.

If you’d like, next we can:

* Add **inline actions** to each booking row (Check in / Check out / View folio), or
* Start sketching the backend models for **bookings, guests, rooms** in Node so this can become a real system.

Tell me which you prefer: **“row actions”** or **“backend models”**.
---------------------------------------------------------------------------------------------------------------------------------

Nice, let’s give you the **next HMS screen**: a **Housekeeping & Room Status board** that looks like something you’d see in a real property system.

This will be `HousekeepingPage.tsx` – same style as the Bookings page: modern, compact, clickable, and ready to wire to a backend later.

---

## `src/pages/HousekeepingPage.tsx`

```tsx
import React, { useState, useMemo } from "react";
import {
  SparklesIcon,
  ExclamationTriangleIcon,
  WrenchScrewdriverIcon,
  ListBulletIcon,
  UserIcon,
  ClockIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";

type RoomStatus = "clean" | "dirty" | "inspecting" | "ooo";

interface Room {
  id: string;
  roomNumber: string;
  floor: number;
  type: string;
  status: RoomStatus;
  assignedTo?: string;
  eta?: string;
  priority?: "high" | "normal" | "low";
  notes?: string;
}

const mockRooms: Room[] = [
  {
    id: "R101",
    roomNumber: "101",
    floor: 1,
    type: "Standard Double",
    status: "dirty",
    assignedTo: "Grace",
    eta: "12:30",
    priority: "high",
    notes: "Late checkout, rush clean",
  },
  {
    id: "R102",
    roomNumber: "102",
    floor: 1,
    type: "Deluxe King",
    status: "clean",
    assignedTo: "Grace",
    priority: "normal",
  },
  {
    id: "R201",
    roomNumber: "201",
    floor: 2,
    type: "Standard Twin",
    status: "inspecting",
    assignedTo: "Ali",
    eta: "11:15",
    priority: "normal",
  },
  {
    id: "R202",
    roomNumber: "202",
    floor: 2,
    type: "Standard Double",
    status: "dirty",
    assignedTo: "Ali",
    priority: "normal",
    notes: "Guest requested extra pillows",
  },
  {
    id: "R301",
    roomNumber: "301",
    floor: 3,
    type: "Executive Suite",
    status: "ooo",
    notes: "Bathroom renovation – no allocation",
  },
  {
    id: "R302",
    roomNumber: "302",
    floor: 3,
    type: "Deluxe King",
    status: "clean",
    assignedTo: "Maya",
    priority: "low",
  },
];

const statusLabel: Record<RoomStatus, string> = {
  clean: "Clean & ready",
  dirty: "Dirty",
  inspecting: "Inspecting",
  ooo: "Out of order",
};

const statusChipClass: Record<RoomStatus, string> = {
  clean:
    "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
  dirty: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
  inspecting:
    "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
  ooo: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
};

const statusIcon: Record<RoomStatus, React.ComponentType<any>> = {
  clean: SparklesIcon,
  dirty: ExclamationTriangleIcon,
  inspecting: ListBulletIcon,
  ooo: WrenchScrewdriverIcon,
};

const HousekeepingPage: React.FC = () => {
  const [floorFilter, setFloorFilter] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<RoomStatus | "all">(
    "all"
  );

  const floors = useMemo(
    () =>
      Array.from(
        new Set(mockRooms.map((r) => r.floor).sort((a, b) => a - b))
      ),
    []
  );

  const stats = useMemo(() => {
    const total = mockRooms.length;
    const clean = mockRooms.filter((r) => r.status === "clean").length;
    const dirty = mockRooms.filter((r) => r.status === "dirty").length;
    const inspecting = mockRooms.filter(
      (r) => r.status === "inspecting"
    ).length;
    const ooo = mockRooms.filter((r) => r.status === "ooo").length;

    const readyPercent = total > 0 ? Math.round((clean / total) * 100) : 0;

    return {
      total,
      clean,
      dirty,
      inspecting,
      ooo,
      readyPercent,
    };
  }, []);

  const filteredRooms = mockRooms.filter((room) => {
    if (floorFilter !== "all" && room.floor !== floorFilter) return false;
    if (statusFilter !== "all" && room.status !== statusFilter)
      return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Housekeeping & rooms
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Live view of room status, assignments and readiness for
              check-in.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <BuildingOffice2Icon className="h-4 w-4" />
            <span>
              {stats.clean}/{stats.total} rooms ready ·{" "}
              <span className="font-semibold text-emerald-700">
                {stats.readyPercent}% readiness
              </span>
            </span>
          </div>
        </header>

        {/* KPI cards */}
        <section className="grid gap-3 md:grid-cols-4">
          <KpiCard
            label="Clean & ready"
            value={stats.clean}
            accent="emerald"
            icon={SparklesIcon}
          />
          <KpiCard
            label="Dirty / to clean"
            value={stats.dirty}
            accent="amber"
            icon={ExclamationTriangleIcon}
          />
          <KpiCard
            label="Inspecting"
            value={stats.inspecting}
            accent="sky"
            icon={ListBulletIcon}
          />
          <KpiCard
            label="Out of order"
            value={stats.ooo}
            accent="rose"
            icon={WrenchScrewdriverIcon}
          />
        </section>

        {/* Filters */}
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-slate-600">
              Floor:
            </span>
            <FilterPill
              active={floorFilter === "all"}
              onClick={() => setFloorFilter("all")}
            >
              All
            </FilterPill>
            {floors.map((floor) => (
              <FilterPill
                key={floor}
                active={floorFilter === floor}
                onClick={() => setFloorFilter(floor)}
              >
                Floor {floor}
              </FilterPill>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-slate-600">
              Status:
            </span>
            <FilterPill
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            >
              All
            </FilterPill>
            <FilterPill
              active={statusFilter === "dirty"}
              onClick={() => setStatusFilter("dirty")}
            >
              Dirty
            </FilterPill>
            <FilterPill
              active={statusFilter === "clean"}
              onClick={() => setStatusFilter("clean")}
            >
              Clean
            </FilterPill>
            <FilterPill
              active={statusFilter === "inspecting"}
              onClick={() => setStatusFilter("inspecting")}
            >
              Inspecting
            </FilterPill>
            <FilterPill
              active={statusFilter === "ooo"}
              onClick={() => setStatusFilter("ooo")}
            >
              Out of order
            </FilterPill>
          </div>
        </section>

        {/* Room grid */}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
            <span>
              {filteredRooms.length} rooms matching filters
            </span>
            <span>Tap a card to open full room details in real app</span>
          </div>

          {filteredRooms.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No rooms match these filters.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {filteredRooms.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

// KPI card
interface KpiCardProps {
  label: string;
  value: number;
  accent: "emerald" | "amber" | "sky" | "rose";
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const accentBg: Record<KpiCardProps["accent"], string> = {
  emerald: "bg-emerald-50",
  amber: "bg-amber-50",
  sky: "bg-sky-50",
  rose: "bg-rose-50",
};

const accentIcon: Record<KpiCardProps["accent"], string> = {
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  sky: "text-sky-600",
  rose: "text-rose-600",
};

const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  accent,
  icon: Icon,
}) => (
  <div className="rounded-2xl bg-white p-3 shadow-sm">
    <div className="flex items-center justify-between gap-2">
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-xl font-semibold text-slate-900">
          {value}
        </p>
      </div>
      <div
        className={
          "flex h-9 w-9 items-center justify-center rounded-xl " +
          accentBg[accent]
        }
      >
        <Icon className={"h-5 w-5 " + accentIcon[accent]} />
      </div>
    </div>
  </div>
);

// Filter pill
const FilterPill: React.FC<{
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}> = ({ active, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={
      "rounded-full px-3 py-1 text-xs font-medium transition-colors " +
      (active
        ? "bg-slate-900 text-slate-50 shadow-sm"
        : "bg-slate-100 text-slate-700 hover:bg-slate-200")
    }
  >
    {children}
  </button>
);

// Room card
const RoomCard: React.FC<{ room: Room }> = ({ room }) => {
  const StatusIcon = statusIcon[room.status];

  const priorityDot =
    room.priority === "high"
      ? "bg-rose-500"
      : room.priority === "low"
      ? "bg-slate-300"
      : "bg-amber-400";

  return (
    <button
      type="button"
      className="h-full w-full rounded-2xl border border-slate-100 bg-slate-50/60 p-3 text-left shadow-sm transition-all hover:border-slate-300 hover:bg-white hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">
              Room
            </span>
            <span className="text-base font-semibold text-slate-900">
              {room.roomNumber}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Floor {room.floor} · {room.type}
          </p>
        </div>

        <span
          className={
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium " +
            statusChipClass[room.status]
          }
        >
          <StatusIcon className="h-3.5 w-3.5" />
          {statusLabel[room.status]}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
        <div className="flex items-center gap-1.5">
          <span className={"h-2 w-2 rounded-full " + priorityDot} />
          <span>
            Priority:{" "}
            <span className="font-medium capitalize">
              {room.priority || "normal"}
            </span>
          </span>
        </div>
        {room.eta && (
          <div className="flex items-center gap-1 text-slate-500">
            <ClockIcon className="h-3.5 w-3.5" />
            <span>ETA {room.eta}</span>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
        <div className="flex items-center gap-1.5">
          <UserIcon className="h-3.5 w-3.5 text-slate-500" />
          <span>
            {room.assignedTo
              ? `Assigned to ${room.assignedTo}`
              : "Unassigned"}
          </span>
        </div>
      </div>

      {room.notes && (
        <p className="mt-2 rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
          {room.notes}
        </p>
      )}
    </button>
  );
};

export default HousekeepingPage;
```

---

### How this keeps you competitive

This page is designed like a **real hotel operations board**:

* **Instant signal** for management:

  * Clean vs dirty vs OOO vs inspecting at the top
  * Overall readiness % (great to show GMs)
* **Operational view** for housekeeping:

  * Filter by **floor** and **status**
  * See **who is assigned**, **priority**, and **ETA** at a glance
  * Notes for edge cases (VIP, renovation, guest requests)
* **Good future hooks**:

  * Each card can later open a **room detail drawer** (full history, maintenance, incidents)
  * You can later add **“Mark as Clean / Dirty / Inspect”** buttons directly on the card.

---

If you want, next we can:

* Add **inline actions** to room cards (Mark clean, Start inspection, Mark OOO), or
* Move on to the **main HMS Overview dashboard** that pulls metrics from bookings + housekeeping together.

Tell me: **“room actions”** or **“overview dashboard”** next?
------------------------------------------------------------------------------------------------------------------

Nice, let’s add the **main HMS overview dashboard** as the next screen.

Here’s a complete page you can drop in as e.g.
`src/pages/HotelDashboardPage.tsx`

It uses **static demo data** for now (so it works immediately), but it’s structured to be competitive with real hotel systems: KPIs, revenue mix, pipeline, and alerts.

---

### `src/pages/HotelDashboardPage.tsx`

```tsx
import React from "react";
import {
  BuildingOffice2Icon,
  UsersIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ArrowRightCircleIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

const HotelDashboardPage: React.FC = () => {
  // Mock data – wire to backend later
  const kpis = {
    occupancy: 82,
    adr: 145, // average daily rate
    revpar: 119,
    inHouse: 128,
    arrivalsToday: 42,
    departuresToday: 36,
    oooRooms: 3,
    openTickets: 5,
  };

  const segmentMix = [
    { label: "Corporate", value: 44 },
    { label: "Direct web", value: 26 },
    { label: "OTA", value: 18 },
    { label: "Groups / MICE", value: 12 },
  ];

  const pipeline = [
    { label: "Today", occ: 82, pickups: 6 },
    { label: "+1 day", occ: 76, pickups: 4 },
    { label: "+2 days", occ: 69, pickups: 3 },
    { label: "+3 days", occ: 63, pickups: 2 },
    { label: "+7 days", occ: 51, pickups: 1 },
  ];

  const alerts = [
    {
      id: "A1",
      type: "risk",
      label: "High early check-in load",
      detail: "18 early check-in requests before 11:00. Coordinate housekeeping priorities.",
    },
    {
      id: "A2",
      type: "info",
      label: "OOO rooms impacting availability",
      detail: "3 rooms out of order on floor 3. Review with maintenance if extension is needed.",
    },
    {
      id: "A3",
      type: "risk",
      label: "OTA overbooking risk",
      detail: "Tonight at 96% adjusted availability on OTA channels. Check allocations and stop-sell if needed.",
    },
  ];

  const todayArrivals = [
    { guest: "Johnson, Emily", room: "120", eta: "12:30", type: "Deluxe King", channel: "Corporate", vip: true },
    { guest: "Singh, Raj", room: "305", eta: "14:00", type: "Executive Suite", channel: "Direct web", vip: false },
    { guest: "Garcia, Sofia", room: "214", eta: "16:15", type: "Standard Double", channel: "OTA", vip: false },
  ];

  const todayDepartures = [
    { guest: "Khan, Amir", room: "108", etd: "11:00", type: "Standard Twin", balance: 0 },
    { guest: "O’Connor, Liam", room: "222", etd: "11:30", type: "Deluxe King", balance: 45.5 },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BuildingOffice2Icon className="h-5 w-5 text-slate-500" />
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Oceanview Hotel &amp; Suites
              </p>
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              Front office overview
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Live pulse of occupancy, revenue, arrivals and operational risk.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <CalendarDaysIcon className="h-4 w-4" />
            <span>Today · {new Date().toLocaleDateString()}</span>
            <span className="h-1 w-1 rounded-full bg-emerald-500"></span>
            <span className="font-medium text-emerald-700">
              Live data
            </span>
          </div>
        </header>

        {/* KPI strip */}
        <section className="grid gap-3 md:grid-cols-4 lg:grid-cols-5">
          <KpiCard
            label="Occupancy"
            value={`${kpis.occupancy}%`}
            sub="vs 79% last week"
            trend="up"
          />
          <KpiCard
            label="ADR"
            value={`$${kpis.adr}`}
            sub="Avg room rate"
          />
          <KpiCard
            label="RevPAR"
            value={`$${kpis.revpar}`}
            sub="Rooms revenue per available room"
          />
          <KpiCard
            label="Arrivals / Departures"
            value={`${kpis.arrivalsToday}/${kpis.departuresToday}`}
            sub="Today’s movement"
          />
          <KpiCard
            label="In-house guests"
            value={kpis.inHouse.toString()}
            sub="Guests currently checked-in"
          />
        </section>

        {/* Secondary KPIs */}
        <section className="grid gap-3 md:grid-cols-3">
          <StatCard
            label="Out of order rooms"
            value={kpis.oooRooms.toString()}
            pill="Impacting availability"
            tone="warn"
          />
          <StatCard
            label="Open service tickets"
            value={kpis.openTickets.toString()}
            pill="Housekeeping / maintenance"
            tone="alert"
          />
          <StatCard
            label="Forecast 7-day occupancy"
            value="68%"
            pill="Moderate – watch weekends"
            tone="ok"
          />
        </section>

        {/* Middle row: pipeline + segment mix */}
        <section className="grid gap-4 md:grid-cols-[minmax(0,1.3fr),minmax(0,1fr)]">
          {/* Booking pipeline */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Booking pipeline (next 7 days)
                </h2>
                <p className="text-xs text-slate-500">
                  Quick view of occupancy by day and new pickups.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {pipeline.map((day) => (
                <div
                  key={day.label}
                  className="flex items-center gap-3 text-xs text-slate-600"
                >
                  <div className="w-16 text-slate-500">{day.label}</div>
                  <div className="flex-1">
                    <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-sky-500"
                        style={{ width: `${day.occ}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-12 text-right font-medium text-slate-800">
                    {day.occ}%
                  </div>
                  <div className="w-20 text-right text-[11px] text-emerald-600">
                    +{day.pickups} pickups
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Segment mix */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Revenue mix by segment
                </h2>
                <p className="text-xs text-slate-500">
                  Today’s room revenue split across key channels.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {segmentMix.map((seg) => (
                <div key={seg.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{seg.label}</span>
                    <span className="font-medium text-slate-900">
                      {seg.value}%
                    </span>
                  </div>
                  <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-indigo-500"
                      style={{ width: `${seg.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-3 text-[11px] text-slate-500">
              Tip: In a full build, this can switch between{" "}
              <span className="font-medium">Revenue / Nights / ADR</span> with a
              small toggle.
            </p>
          </div>
        </section>

        {/* Bottom row: arrivals/departures + alerts & quick actions */}
        <section className="grid gap-4 md:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)]">
          {/* Arrivals & departures */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Today’s movement
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {kpis.arrivalsToday} arrivals · {kpis.departuresToday} departures
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Arrivals */}
              <div>
                <h3 className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
                  <ArrowRightCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
                  Arrivals (sample)
                </h3>
                <ul className="space-y-1.5">
                  {todayArrivals.map((a) => (
                    <li
                      key={a.guest}
                      className="rounded-xl bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{a.guest}</span>
                        <span className="text-slate-500">ETA {a.eta}</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-500">
                        <span>
                          Room {a.room} · {a.type}
                        </span>
                        <span>{a.channel}</span>
                      </div>
                      {a.vip && (
                        <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          <StarIconSmall />
                          VIP attention
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Departures */}
              <div>
                <h3 className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
                  <ArrowRightCircleIcon className="h-3.5 w-3.5 rotate-180 text-rose-600" />
                  Departures (sample)
                </h3>
                <ul className="space-y-1.5">
                  {todayDepartures.map((d) => (
                    <li
                      key={d.guest}
                      className="rounded-xl bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{d.guest}</span>
                        <span className="text-slate-500">
                          ETD {d.etd}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-500">
                        <span>
                          Room {d.room} · {d.type}
                        </span>
                        <span>
                          Balance:{" "}
                          {d.balance > 0 ? (
                            <span className="font-medium text-amber-700">
                              ${d.balance.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-emerald-600">Settled</span>
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Alerts + quick actions */}
          <div className="space-y-4">
            {/* Alerts */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  Operational alerts
                </h2>
                <span className="text-[11px] text-slate-500">
                  {alerts.length} items
                </span>
              </div>

              <ul className="space-y-2">
                {alerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="flex gap-2 rounded-xl bg-slate-50 px-2.5 py-2 text-[11px]"
                  >
                    {alert.type === "risk" ? (
                      <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-none text-amber-600" />
                    ) : (
                      <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-none text-emerald-600" />
                    )}
                    <div>
                      <p className="font-medium text-slate-800">
                        {alert.label}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {alert.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick actions */}
            <div className="rounded-2xl bg-slate-900 p-4 text-slate-50 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <ClipboardDocumentListIcon className="h-4 w-4 text-sky-300" />
                <h2 className="text-sm font-semibold">
                  Quick actions
                </h2>
              </div>

              <p className="mb-3 text-[11px] text-slate-300">
                In a full build these buttons trigger flows (new booking, block
                room, export, update rates).
              </p>

              <div className="grid gap-2 text-xs md:grid-cols-2">
                <QuickActionButton icon={UsersIcon} label="Create new booking" />
                <QuickActionButton
                  icon={BuildingOffice2Icon}
                  label="Block / release room"
                />
                <QuickActionButton
                  icon={BanknotesIcon}
                  label="Export daily revenue report"
                />
                <QuickActionButton
                  icon={ArrowTrendingUpIcon}
                  label="Open rate calendar"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

/* Small helpers */

const KpiCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down";
}> = ({ label, value, sub, trend }) => (
  <div className="rounded-2xl bg-white p-3 shadow-sm">
    <div className="flex items-center justify-between gap-2">
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-xl font-semibold text-slate-900">
          {value}
        </p>
        {sub && (
          <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>
        )}
      </div>
      {trend && (
        <span
          className={
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] " +
            (trend === "up"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700")
          }
        >
          <ArrowTrendingUpIcon
            className={
              "h-3.5 w-3.5 " +
              (trend === "up" ? "rotate-0" : "rotate-180")
            }
          />
          {trend === "up" ? "Improving" : "Declining"}
        </span>
      )}
    </div>
  </div>
);

const StatCard: React.FC<{
  label: string;
  value: string;
  pill?: string;
  tone: "ok" | "warn" | "alert";
}> = ({ label, value, pill, tone }) => {
  const toneBg =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700"
      : "bg-rose-50 text-rose-700";

  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">
        {value}
      </p>
      {pill && (
        <span
          className={
            "mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] " +
            toneBg
          }
        >
          {pill}
        </span>
      )}
    </div>
  );
};

const QuickActionButton: React.FC<{
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
}> = ({ icon: Icon, label }) => (
  <button
    type="button"
    className="flex items-center gap-2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-left text-[11px] text-slate-100 transition-colors hover:bg-slate-700"
  >
    <Icon className="h-4 w-4 text-sky-300" />
    <span>{label}</span>
  </button>
);

const StarIconSmall: React.FC = () => (
  <svg
    viewBox="0 0 20 20"
    className="h-3 w-3 fill-amber-400"
    aria-hidden="true"
  >
    <path d="M10 1.5 12.47 7l5.53.48-4.18 3.6 1.27 5.42L10 13.97l-5.09 2.53L6.18 11 2 7.48 7.53 7 10 1.5Z" />
  </svg>
);

export default HotelDashboardPage;
```

---

### How this helps you compete

* Looks and feels like **modern SaaS PMS** dashboards.
* Covers what GMs / Front Office managers care about:

  * Occupancy, ADR, RevPAR
  * Arrivals / departures
  * Segment mix & pipeline
  * Operational alerts
  * Quick actions (booking, block room, rate calendar, export)
* You can now plug this into your router, e.g.:

```tsx
// in App.tsx or your router
// <Route path="/dashboard" element={<HotelDashboardPage />} />
```

If you want, **next** we can either:

* Add a **Reservations (Bookings) Management page** (search, filters, status chips), or
* Start defining the **data model / API endpoints** for this HMS (so your Node backend can power these screens).
--------------------------------------------------------------------------------------------------------------------
Nice, let’s add the **main HMS overview dashboard** as the next screen.

Here’s a complete page you can drop in as e.g.
`src/pages/HotelDashboardPage.tsx`

It uses **static demo data** for now (so it works immediately), but it’s structured to be competitive with real hotel systems: KPIs, revenue mix, pipeline, and alerts.

---

### `src/pages/HotelDashboardPage.tsx`

```tsx
import React from "react";
import {
  BuildingOffice2Icon,
  UsersIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ArrowRightCircleIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

const HotelDashboardPage: React.FC = () => {
  // Mock data – wire to backend later
  const kpis = {
    occupancy: 82,
    adr: 145, // average daily rate
    revpar: 119,
    inHouse: 128,
    arrivalsToday: 42,
    departuresToday: 36,
    oooRooms: 3,
    openTickets: 5,
  };

  const segmentMix = [
    { label: "Corporate", value: 44 },
    { label: "Direct web", value: 26 },
    { label: "OTA", value: 18 },
    { label: "Groups / MICE", value: 12 },
  ];

  const pipeline = [
    { label: "Today", occ: 82, pickups: 6 },
    { label: "+1 day", occ: 76, pickups: 4 },
    { label: "+2 days", occ: 69, pickups: 3 },
    { label: "+3 days", occ: 63, pickups: 2 },
    { label: "+7 days", occ: 51, pickups: 1 },
  ];

  const alerts = [
    {
      id: "A1",
      type: "risk",
      label: "High early check-in load",
      detail: "18 early check-in requests before 11:00. Coordinate housekeeping priorities.",
    },
    {
      id: "A2",
      type: "info",
      label: "OOO rooms impacting availability",
      detail: "3 rooms out of order on floor 3. Review with maintenance if extension is needed.",
    },
    {
      id: "A3",
      type: "risk",
      label: "OTA overbooking risk",
      detail: "Tonight at 96% adjusted availability on OTA channels. Check allocations and stop-sell if needed.",
    },
  ];

  const todayArrivals = [
    { guest: "Johnson, Emily", room: "120", eta: "12:30", type: "Deluxe King", channel: "Corporate", vip: true },
    { guest: "Singh, Raj", room: "305", eta: "14:00", type: "Executive Suite", channel: "Direct web", vip: false },
    { guest: "Garcia, Sofia", room: "214", eta: "16:15", type: "Standard Double", channel: "OTA", vip: false },
  ];

  const todayDepartures = [
    { guest: "Khan, Amir", room: "108", etd: "11:00", type: "Standard Twin", balance: 0 },
    { guest: "O’Connor, Liam", room: "222", etd: "11:30", type: "Deluxe King", balance: 45.5 },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BuildingOffice2Icon className="h-5 w-5 text-slate-500" />
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Oceanview Hotel &amp; Suites
              </p>
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              Front office overview
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Live pulse of occupancy, revenue, arrivals and operational risk.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <CalendarDaysIcon className="h-4 w-4" />
            <span>Today · {new Date().toLocaleDateString()}</span>
            <span className="h-1 w-1 rounded-full bg-emerald-500"></span>
            <span className="font-medium text-emerald-700">
              Live data
            </span>
          </div>
        </header>

        {/* KPI strip */}
        <section className="grid gap-3 md:grid-cols-4 lg:grid-cols-5">
          <KpiCard
            label="Occupancy"
            value={`${kpis.occupancy}%`}
            sub="vs 79% last week"
            trend="up"
          />
          <KpiCard
            label="ADR"
            value={`$${kpis.adr}`}
            sub="Avg room rate"
          />
          <KpiCard
            label="RevPAR"
            value={`$${kpis.revpar}`}
            sub="Rooms revenue per available room"
          />
          <KpiCard
            label="Arrivals / Departures"
            value={`${kpis.arrivalsToday}/${kpis.departuresToday}`}
            sub="Today’s movement"
          />
          <KpiCard
            label="In-house guests"
            value={kpis.inHouse.toString()}
            sub="Guests currently checked-in"
          />
        </section>

        {/* Secondary KPIs */}
        <section className="grid gap-3 md:grid-cols-3">
          <StatCard
            label="Out of order rooms"
            value={kpis.oooRooms.toString()}
            pill="Impacting availability"
            tone="warn"
          />
          <StatCard
            label="Open service tickets"
            value={kpis.openTickets.toString()}
            pill="Housekeeping / maintenance"
            tone="alert"
          />
          <StatCard
            label="Forecast 7-day occupancy"
            value="68%"
            pill="Moderate – watch weekends"
            tone="ok"
          />
        </section>

        {/* Middle row: pipeline + segment mix */}
        <section className="grid gap-4 md:grid-cols-[minmax(0,1.3fr),minmax(0,1fr)]">
          {/* Booking pipeline */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Booking pipeline (next 7 days)
                </h2>
                <p className="text-xs text-slate-500">
                  Quick view of occupancy by day and new pickups.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {pipeline.map((day) => (
                <div
                  key={day.label}
                  className="flex items-center gap-3 text-xs text-slate-600"
                >
                  <div className="w-16 text-slate-500">{day.label}</div>
                  <div className="flex-1">
                    <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-sky-500"
                        style={{ width: `${day.occ}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-12 text-right font-medium text-slate-800">
                    {day.occ}%
                  </div>
                  <div className="w-20 text-right text-[11px] text-emerald-600">
                    +{day.pickups} pickups
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Segment mix */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Revenue mix by segment
                </h2>
                <p className="text-xs text-slate-500">
                  Today’s room revenue split across key channels.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {segmentMix.map((seg) => (
                <div key={seg.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{seg.label}</span>
                    <span className="font-medium text-slate-900">
                      {seg.value}%
                    </span>
                  </div>
                  <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-indigo-500"
                      style={{ width: `${seg.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-3 text-[11px] text-slate-500">
              Tip: In a full build, this can switch between{" "}
              <span className="font-medium">Revenue / Nights / ADR</span> with a
              small toggle.
            </p>
          </div>
        </section>

        {/* Bottom row: arrivals/departures + alerts & quick actions */}
        <section className="grid gap-4 md:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)]">
          {/* Arrivals & departures */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Today’s movement
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {kpis.arrivalsToday} arrivals · {kpis.departuresToday} departures
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Arrivals */}
              <div>
                <h3 className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
                  <ArrowRightCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
                  Arrivals (sample)
                </h3>
                <ul className="space-y-1.5">
                  {todayArrivals.map((a) => (
                    <li
                      key={a.guest}
                      className="rounded-xl bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{a.guest}</span>
                        <span className="text-slate-500">ETA {a.eta}</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-500">
                        <span>
                          Room {a.room} · {a.type}
                        </span>
                        <span>{a.channel}</span>
                      </div>
                      {a.vip && (
                        <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          <StarIconSmall />
                          VIP attention
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Departures */}
              <div>
                <h3 className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
                  <ArrowRightCircleIcon className="h-3.5 w-3.5 rotate-180 text-rose-600" />
                  Departures (sample)
                </h3>
                <ul className="space-y-1.5">
                  {todayDepartures.map((d) => (
                    <li
                      key={d.guest}
                      className="rounded-xl bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{d.guest}</span>
                        <span className="text-slate-500">
                          ETD {d.etd}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-500">
                        <span>
                          Room {d.room} · {d.type}
                        </span>
                        <span>
                          Balance:{" "}
                          {d.balance > 0 ? (
                            <span className="font-medium text-amber-700">
                              ${d.balance.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-emerald-600">Settled</span>
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Alerts + quick actions */}
          <div className="space-y-4">
            {/* Alerts */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  Operational alerts
                </h2>
                <span className="text-[11px] text-slate-500">
                  {alerts.length} items
                </span>
              </div>

              <ul className="space-y-2">
                {alerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="flex gap-2 rounded-xl bg-slate-50 px-2.5 py-2 text-[11px]"
                  >
                    {alert.type === "risk" ? (
                      <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-none text-amber-600" />
                    ) : (
                      <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-none text-emerald-600" />
                    )}
                    <div>
                      <p className="font-medium text-slate-800">
                        {alert.label}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {alert.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick actions */}
            <div className="rounded-2xl bg-slate-900 p-4 text-slate-50 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <ClipboardDocumentListIcon className="h-4 w-4 text-sky-300" />
                <h2 className="text-sm font-semibold">
                  Quick actions
                </h2>
              </div>

              <p className="mb-3 text-[11px] text-slate-300">
                In a full build these buttons trigger flows (new booking, block
                room, export, update rates).
              </p>

              <div className="grid gap-2 text-xs md:grid-cols-2">
                <QuickActionButton icon={UsersIcon} label="Create new booking" />
                <QuickActionButton
                  icon={BuildingOffice2Icon}
                  label="Block / release room"
                />
                <QuickActionButton
                  icon={BanknotesIcon}
                  label="Export daily revenue report"
                />
                <QuickActionButton
                  icon={ArrowTrendingUpIcon}
                  label="Open rate calendar"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

/* Small helpers */

const KpiCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down";
}> = ({ label, value, sub, trend }) => (
  <div className="rounded-2xl bg-white p-3 shadow-sm">
    <div className="flex items-center justify-between gap-2">
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-xl font-semibold text-slate-900">
          {value}
        </p>
        {sub && (
          <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>
        )}
      </div>
      {trend && (
        <span
          className={
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] " +
            (trend === "up"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700")
          }
        >
          <ArrowTrendingUpIcon
            className={
              "h-3.5 w-3.5 " +
              (trend === "up" ? "rotate-0" : "rotate-180")
            }
          />
          {trend === "up" ? "Improving" : "Declining"}
        </span>
      )}
    </div>
  </div>
);

const StatCard: React.FC<{
  label: string;
  value: string;
  pill?: string;
  tone: "ok" | "warn" | "alert";
}> = ({ label, value, pill, tone }) => {
  const toneBg =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700"
      : "bg-rose-50 text-rose-700";

  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">
        {value}
      </p>
      {pill && (
        <span
          className={
            "mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] " +
            toneBg
          }
        >
          {pill}
        </span>
      )}
    </div>
  );
};

const QuickActionButton: React.FC<{
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
}> = ({ icon: Icon, label }) => (
  <button
    type="button"
    className="flex items-center gap-2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-left text-[11px] text-slate-100 transition-colors hover:bg-slate-700"
  >
    <Icon className="h-4 w-4 text-sky-300" />
    <span>{label}</span>
  </button>
);

const StarIconSmall: React.FC = () => (
  <svg
    viewBox="0 0 20 20"
    className="h-3 w-3 fill-amber-400"
    aria-hidden="true"
  >
    <path d="M10 1.5 12.47 7l5.53.48-4.18 3.6 1.27 5.42L10 13.97l-5.09 2.53L6.18 11 2 7.48 7.53 7 10 1.5Z" />
  </svg>
);

export default HotelDashboardPage;
```

---

### How this helps you compete

* Looks and feels like **modern SaaS PMS** dashboards.
* Covers what GMs / Front Office managers care about:

  * Occupancy, ADR, RevPAR
  * Arrivals / departures
  * Segment mix & pipeline
  * Operational alerts
  * Quick actions (booking, block room, rate calendar, export)
* You can now plug this into your router, e.g.:

```tsx
// in App.tsx or your router
// <Route path="/dashboard" element={<HotelDashboardPage />} />
```

If you want, **next** we can either:

* Add a **Reservations (Bookings) Management page** (search, filters, status chips), or
* Start defining the **data model / API endpoints** for this HMS (so your Node backend can power these screens).
------------------------------------------------------------------------------------------------------------------------

Nice, let’s add the **Reservations / Bookings** screen next – that’s usually the heart of a Hotel Management System.

Below is a complete page you can drop in as:

> `src/pages/ReservationsPage.tsx`

It’s using **static demo data** for now, but structured to be wired to your Node backend later.

---

### `src/pages/ReservationsPage.tsx`

```tsx
import React, { useMemo, useState } from "react";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  CalendarDaysIcon,
  UsersIcon,
  CreditCardIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

type ReservationStatus = "Booked" | "Checked-in" | "Checked-out" | "Cancelled";

interface Reservation {
  id: string;
  reservationNo: string;
  guestName: string;
  arrivalDate: string;
  departureDate: string;
  nights: number;
  roomType: string;
  roomNo?: string;
  pax: number;
  channel: string;
  status: ReservationStatus;
  balance: number;
  currency: string;
  vip: boolean;
}

const mockReservations: Reservation[] = [
  {
    id: "R1",
    reservationNo: "RES-2025-00123",
    guestName: "Emily Johnson",
    arrivalDate: "2025-03-21",
    departureDate: "2025-03-24",
    nights: 3,
    roomType: "Deluxe King",
    roomNo: "120",
    pax: 2,
    channel: "Corporate",
    status: "Checked-in",
    balance: 145.0,
    currency: "USD",
    vip: true,
  },
  {
    id: "R2",
    reservationNo: "RES-2025-00124",
    guestName: "Raj Singh",
    arrivalDate: "2025-03-21",
    departureDate: "2025-03-22",
    nights: 1,
    roomType: "Executive Suite",
    roomNo: undefined,
    pax: 1,
    channel: "Direct web",
    status: "Booked",
    balance: 0,
    currency: "USD",
    vip: false,
  },
  {
    id: "R3",
    reservationNo: "RES-2025-00125",
    guestName: "Sofia Garcia",
    arrivalDate: "2025-03-22",
    departureDate: "2025-03-25",
    nights: 3,
    roomType: "Standard Double",
    roomNo: "214",
    pax: 2,
    channel: "OTA",
    status: "Booked",
    balance: 230.5,
    currency: "USD",
    vip: false,
  },
  {
    id: "R4",
    reservationNo: "RES-2025-00126",
    guestName: "Amir Khan",
    arrivalDate: "2025-03-19",
    departureDate: "2025-03-21",
    nights: 2,
    roomType: "Standard Twin",
    roomNo: "108",
    pax: 1,
    channel: "OTA",
    status: "Checked-out",
    balance: 0,
    currency: "USD",
    vip: false,
  },
  {
    id: "R5",
    reservationNo: "RES-2025-00127",
    guestName: "Liam O’Connor",
    arrivalDate: "2025-03-23",
    departureDate: "2025-03-26",
    nights: 3,
    roomType: "Deluxe King",
    roomNo: undefined,
    pax: 2,
    channel: "Group / MICE",
    status: "Cancelled",
    balance: 0,
    currency: "USD",
    vip: false,
  },
];

const ReservationsPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ReservationStatus>(
    "all"
  );
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [showOnlyBalance, setShowOnlyBalance] = useState(false);

  const channels = useMemo(
    () => Array.from(new Set(mockReservations.map((r) => r.channel))),
    []
  );

  const filteredReservations = useMemo(() => {
    return mockReservations.filter((r) => {
      // text search
      const s = search.trim().toLowerCase();
      if (s) {
        const combined = `${r.guestName} ${r.reservationNo} ${r.roomNo ?? ""} ${
          r.roomType
        } ${r.channel}`.toLowerCase();
        if (!combined.includes(s)) return false;
      }

      // status filter
      if (statusFilter !== "all" && r.status !== statusFilter) {
        return false;
      }

      // channel filter
      if (channelFilter !== "all" && r.channel !== channelFilter) {
        return false;
      }

      // balance filter
      if (showOnlyBalance && r.balance <= 0) {
        return false;
      }

      return true;
    });
  }, [search, statusFilter, channelFilter, showOnlyBalance]);

  const totalBalance = filteredReservations.reduce(
    (sum, r) => sum + r.balance,
    0
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-slate-400" />
              Front office · Reservations
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              Bookings & stays
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Search, filter and manage all reservations in one view.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CalendarDaysIcon className="h-4 w-4" />
            <span>Today · {new Date().toLocaleDateString()}</span>
          </div>
        </header>

        {/* Filters + actions */}
        <section className="rounded-2xl bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="Search by guest name, reservation no, room, channel..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1 text-xs">
              <FunnelIcon className="h-4 w-4 text-slate-400" />
              <select
                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "all" | ReservationStatus)
                }
              >
                <option value="all">All statuses</option>
                <option value="Booked">Booked</option>
                <option value="Checked-in">Checked-in</option>
                <option value="Checked-out">Checked-out</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* Channel filter */}
            <div className="flex items-center gap-1 text-xs">
              <select
                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
              >
                <option value="all">All channels</option>
                {channels.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </div>

            {/* Balance only */}
            <label className="flex items-center gap-1 text-[11px] text-slate-600">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                checked={showOnlyBalance}
                onChange={(e) => setShowOnlyBalance(e.target.checked)}
              />
              Show only reservations with outstanding balance
            </label>

            <div className="flex-1" />

            {/* Export button */}
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-50 shadow-sm hover:bg-slate-800"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export (CSV)
            </button>
          </div>

          {/* Summary strip */}
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            <span>
              Showing{" "}
              <span className="font-semibold text-slate-800">
                {filteredReservations.length}
              </span>{" "}
              of {mockReservations.length} reservations
            </span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>
              Outstanding balance:{" "}
              <span className="font-semibold text-amber-700">
                ${totalBalance.toFixed(2)}
              </span>
            </span>
          </div>
        </section>

        {/* Table */}
        <section className="rounded-2xl bg-white p-3 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-1 text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-1.5">Guest / Reservation</th>
                  <th className="px-2 py-1.5">Stay</th>
                  <th className="px-2 py-1.5">Room</th>
                  <th className="px-2 py-1.5">Channel</th>
                  <th className="px-2 py-1.5">Status</th>
                  <th className="px-2 py-1.5 text-right">Balance</th>
                  <th className="px-2 py-1.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReservations.map((r) => (
                  <tr
                    key={r.id}
                    className="rounded-xl bg-slate-50 align-top text-slate-800"
                  >
                    {/* Guest / Res no */}
                    <td className="px-2 py-2">
                      <div className="font-medium">{r.guestName}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {r.reservationNo}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[10px]">
                        {r.vip && (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            VIP
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Stay */}
                    <td className="px-2 py-2">
                      <div>
                        {r.arrivalDate} → {r.departureDate}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {r.nights} nights · {r.pax} guest(s)
                      </div>
                    </td>

                    {/* Room */}
                    <td className="px-2 py-2">
                      <div>{r.roomType}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        Room {r.roomNo ?? "Not assigned"}
                      </div>
                    </td>

                    {/* Channel */}
                    <td className="px-2 py-2">
                      <span className="inline-flex rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
                        {r.channel}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-2 py-2">
                      <StatusBadge status={r.status} />
                    </td>

                    {/* Balance */}
                    <td className="px-2 py-2 text-right">
                      {r.balance > 0 ? (
                        <span className="inline-flex items-center justify-end gap-1 text-[11px] font-medium text-amber-700">
                          <CreditCardIcon className="h-3.5 w-3.5" />
                          {r.currency} {r.balance.toFixed(2)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-end gap-1 text-[11px] text-emerald-600">
                          <CheckCircleIcon className="h-3.5 w-3.5" />
                          Settled
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 px-2 py-1 text-[10px] text-slate-700 hover:bg-slate-100"
                        >
                          View details
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 px-2 py-1 text-[10px] text-slate-700 hover:bg-slate-100"
                        >
                          Timeline
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredReservations.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-6 text-center text-[11px] text-slate-500"
                    >
                      No reservations match your filters. Try widening your
                      search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Info footer */}
          <div className="mt-3 flex items-start gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            <ExclamationTriangleIcon className="mt-0.5 h-3.5 w-3.5 text-amber-500" />
            <p>
              In a full build, this view would support inline check-in/out,
              room assignment, and deep links to folio / payments. Right now
              it’s wired with demo data so you can shape UX first.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: ReservationStatus }> = ({ status }) => {
  let bg = "bg-slate-100 text-slate-700";
  let Icon: React.ComponentType<React.SVGProps<SVGSVGElement>> | null = null;

  switch (status) {
    case "Booked":
      bg = "bg-sky-50 text-sky-700";
      Icon = CalendarDaysIcon;
      break;
    case "Checked-in":
      bg = "bg-emerald-50 text-emerald-700";
      Icon = CheckCircleIcon;
      break;
    case "Checked-out":
      bg = "bg-slate-100 text-slate-700";
      Icon = CheckCircleIcon;
      break;
    case "Cancelled":
      bg = "bg-rose-50 text-rose-700";
      Icon = XCircleIcon;
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${bg}`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {status}
    </span>
  );
};

export default ReservationsPage;
```

---

### How this keeps you competitive

Compared to typical HMS products, this view gives you:

1. **Fast operations**: search by name / reservation / room / channel, plus filters.
2. **Status awareness**: clear `Booked / Checked-in / Checked-out / Cancelled` badges.
3. **Revenue focus**: outstanding balances highlighted with card icon.
4. **Channel insight**: quick filter by Corporate / Direct / OTA / Group.
5. **Export-ready**: Export button + summary strip (count + total balance).

---

### How to hook it up

If you’re using React Router, add something like:

```tsx
// in App.tsx (example)
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HotelDashboardPage from "./pages/HotelDashboardPage";
import ReservationsPage from "./pages/ReservationsPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HotelDashboardPage />} />
        <Route path="/reservations" element={<ReservationsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

Then you’ll have:

* `/` → main hotel dashboard
* `/reservations` → bookings list

---

If you’re happy with this, the **next step** we can do is either:

* Design the **Room & Inventory management** screen (rooms, statuses, OOO, housekeeping), or
* Start defining the **Node API endpoints** for reservations so your Agent can actually wire UI → backend.


--------------

