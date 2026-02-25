import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KPI_VALUE_CLASS, KPI_VALUE_CLASS_SM } from '@/styles/typography';
import { useAuthStore } from '@/stores/authStore';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type BookingStatus = 'Checked-In' | 'Checked-Out' | 'Pending';

type BookingRow = {
  id: string;
  bookingId: string;
  guestName: string;
  roomType: 'Deluxe' | 'Standard' | 'Suite';
  roomNumber: string;
  duration: string;
  dates: string;
  status: BookingStatus;
};

type TaskRow = {
  id: string;
  dateLabel: string;
  title: string;
  subtitle: string;
  completed: boolean;
};

type RoomSignal = {
  label: string;
  value: string;
  tone: 'lime' | 'amber' | 'sky';
};

type DashboardRange = '7d' | '3m' | '6m' | '1y';

type ChannelPerformance = {
  label: string;
  value: string;
  hint: string;
  tone: 'emerald' | 'sky' | 'amber';
};

type TaskTemplate = Omit<TaskRow, 'completed'>;

function formatCurrency(value: number, currency = 'USD') {
  return value.toLocaleString(undefined, { style: 'currency', currency, maximumFractionDigits: 0 });
}

function scaleInt(value: number, factor: number) {
  return Math.max(0, Math.round(value * factor));
}

const DASHBOARD_RANGE_LABELS: Record<DashboardRange, string> = {
  '7d': 'Last 7 Days',
  '3m': 'Last 3 Months',
  '6m': 'Last 6 Months',
  '1y': 'Last 1 Year',
};

const DASHBOARD_RANGE_FACTORS: Record<DashboardRange, number> = {
  '7d': 0.24,
  '3m': 0.62,
  '6m': 1,
  '1y': 1.45,
};

function TrendPill({ pct }: { pct: number }) {
  const up = pct >= 0;
  const cls = up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700';
  const label = `${up ? '\u25B2' : '\u25BC'} ${Math.abs(pct).toFixed(2)}% from last week`;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium ${cls}`}>{label}</span>;
}

function ClickableCard({
  to,
  className,
  ariaLabel,
  children,
}: {
  to: string;
  className: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();

  // Prevent accidental navigation when the user interacts with controls inside the card
  // (selects, inputs, buttons, links, etc.). This is critical for dropdown filters to work.
  const INTERACTIVE_SELECTOR =
    'a,button,input,select,textarea,summary,details,[role="button"],[role="menuitem"],[role="option"],[role="checkbox"],[data-no-card-nav="true"]';

  const isInteractive = (target: EventTarget | null, currentTarget: HTMLElement) => {
    const el = target instanceof Element ? target : null;
    if (!el) return false;
    const closest = el.closest(INTERACTIVE_SELECTOR);
    return !!closest && currentTarget.contains(closest);
  };

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={ariaLabel}
      className={`${className} cursor-pointer outline-none transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2`}
      onClick={(e) => {
        if (e.defaultPrevented) return;
        if (isInteractive(e.target, e.currentTarget)) return;
        navigate(to);
      }}
      onKeyDown={(e) => {
        if (isInteractive(e.target, e.currentTarget)) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(to);
        }
      }}
    >
      {children}
    </div>
  );
}

function KpiCard({
  title,
  value,
  trendPct,
  icon,
  to,
}: {
  title: string;
  value: string;
  trendPct: number;
  icon: React.ReactNode;
  to: string;
}) {
  return (
    <ClickableCard
      to={to}
      ariaLabel={`${title} details`}
      className="rounded-[20px] bg-white p-4 shadow-sm ring-1 ring-slate-200"
    >
      <div className="flex items-center justify-between">
        <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">{icon}</div>
        <button
          type="button"
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-50"
          aria-label="More"
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
          </svg>
        </button>
      </div>

      <div className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
      <div className={`mt-2 ${KPI_VALUE_CLASS}`}>{value}</div>
      <div className="mt-2">
        <TrendPill pct={trendPct} />
      </div>
    </ClickableCard>
  );
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const cls =
    status === 'Checked-In'
      ? 'bg-lime-100 text-lime-800'
      : status === 'Checked-Out'
        ? 'bg-slate-100 text-slate-700'
        : 'bg-amber-100 text-amber-800';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{status}</span>;
}

function RoomTypeBadge({ roomType }: { roomType: BookingRow['roomType'] }) {
  const cls =
    roomType === 'Deluxe'
      ? 'bg-lime-100 text-lime-800'
      : roomType === 'Standard'
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-slate-100 text-slate-700';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{roomType}</span>;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const globalRangeMenuRef = useRef<HTMLDivElement | null>(null);
  
  // Permission check for financial data
  // Receptionists should NOT see financial KPIs on dashboard (Total Revenue, ADR, Revenue chart)
  // Only ADMIN and MANAGER roles can view financial metrics
  const { user } = useAuthStore();
  const canViewFinancials = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // MOCK DATA - replace with real data
  const currency = 'USD';
  const baseSummary = useMemo(
    () => ({
      newBookings: 840,
      checkIn: 231,
      checkOut: 124,
      totalRevenue: 123_980,
      trends: { newBookings: 8.7, checkIn: 3.56, checkOut: -1.06, totalRevenue: 5.7 },
    }),
    [],
  );

  // MOCK DATA - replace with real data
  const baseRoomAvailability = useMemo(() => ({ occupied: 286, reserved: 87, available: 32, notReady: 13 }), []);

  const [dashboardGlobalRange, setDashboardGlobalRange] = useState<DashboardRange>('6m');
  const [showDashboardGlobalRangeMenu, setShowDashboardGlobalRangeMenu] = useState(false);
  const [revenueRange, setRevenueRange] = useState<DashboardRange>('6m');

  const summary = useMemo(() => {
    const factor = DASHBOARD_RANGE_FACTORS[dashboardGlobalRange];
    return {
      newBookings: scaleInt(baseSummary.newBookings, factor),
      checkIn: scaleInt(baseSummary.checkIn, factor),
      checkOut: scaleInt(baseSummary.checkOut, factor),
      totalRevenue: scaleInt(baseSummary.totalRevenue, factor),
      trends: {
        newBookings: baseSummary.trends.newBookings + (dashboardGlobalRange === '7d' ? -1.2 : dashboardGlobalRange === '1y' ? 0.9 : 0),
        checkIn: baseSummary.trends.checkIn + (dashboardGlobalRange === '3m' ? 0.4 : dashboardGlobalRange === '1y' ? -0.3 : 0),
        checkOut: baseSummary.trends.checkOut + (dashboardGlobalRange === '7d' ? -0.55 : dashboardGlobalRange === '1y' ? 0.42 : 0),
        totalRevenue:
          baseSummary.trends.totalRevenue + (dashboardGlobalRange === '7d' ? -0.9 : dashboardGlobalRange === '3m' ? -0.35 : dashboardGlobalRange === '1y' ? 1.05 : 0),
      },
    };
  }, [baseSummary, dashboardGlobalRange]);

  const roomAvailability = useMemo(() => {
    const factor = DASHBOARD_RANGE_FACTORS[dashboardGlobalRange];
    if (dashboardGlobalRange === '6m') return baseRoomAvailability;
    return {
      occupied: scaleInt(baseRoomAvailability.occupied, factor),
      reserved: scaleInt(baseRoomAvailability.reserved, factor),
      available: Math.max(8, scaleInt(baseRoomAvailability.available, factor * (dashboardGlobalRange === '7d' ? 1.15 : 0.95))),
      notReady: Math.max(2, scaleInt(baseRoomAvailability.notReady, factor * (dashboardGlobalRange === '1y' ? 1.05 : 1))),
    };
  }, [baseRoomAvailability, dashboardGlobalRange]);

  // MOCK DATA - replace with real data
  const revenue6m = useMemo(
    () => [
      { month: 'Dec 2027', value: 220_000 },
      { month: 'Jan 2028', value: 245_000 },
      { month: 'Feb 2028', value: 315_060 },
      { month: 'Mar 2028', value: 265_000 },
      { month: 'Apr 2028', value: 305_000 },
      { month: 'May 2028', value: 285_000 },
    ],
    [],
  );

  // MOCK DATA - replace with real data
  const revenue1y = useMemo(
    () => [
      { month: 'Jun 2027', value: 180_000 },
      { month: 'Jul 2027', value: 210_000 },
      { month: 'Aug 2027', value: 195_000 },
      { month: 'Sep 2027', value: 240_000 },
      { month: 'Oct 2027', value: 330_000 },
      { month: 'Nov 2027', value: 390_000 },
      ...revenue6m,
    ],
    [revenue6m],
  );

  // MOCK DATA - replace with real data
  const revenue3m = useMemo(() => revenue6m.slice(3), [revenue6m]);
  // MOCK DATA - replace with real data
  const revenue7d = useMemo(
    () => [
      { month: 'Mon', value: 38_000 },
      { month: 'Tue', value: 41_500 },
      { month: 'Wed', value: 39_200 },
      { month: 'Thu', value: 46_000 },
      { month: 'Fri', value: 52_700 },
      { month: 'Sat', value: 49_900 },
      { month: 'Sun', value: 47_300 },
    ],
    [],
  );

  const revenueByMonth = useMemo(() => {
    if (revenueRange === '7d') return revenue7d;
    if (revenueRange === '3m') return revenue3m;
    if (revenueRange === '6m') return revenue6m;
    return revenue1y;
  }, [revenue1y, revenue3m, revenue6m, revenue7d, revenueRange]);

  // MOCK DATA - replace with real data
  const reservations7d = useMemo(
    () => [
      { day: '12 Jun', booked: 40, canceled: 18 },
      { day: '13 Jun', booked: 52, canceled: 22 },
      { day: '14 Jun', booked: 48, canceled: 20 },
      { day: '15 Jun', booked: 60, canceled: 26 },
      { day: '16 Jun', booked: 72, canceled: 24 },
      { day: '17 Jun', booked: 65, canceled: 28 },
      { day: '18 Jun', booked: 58, canceled: 21 },
    ],
    [],
  );

  const reservations3m = useMemo(
    () => [
      { day: 'Mar', booked: 146, canceled: 58 },
      { day: 'Apr', booked: 162, canceled: 61 },
      { day: 'May', booked: 171, canceled: 64 },
    ],
    [],
  );

  const reservations1y = useMemo(
    () => [
      { day: 'Jun', booked: 118, canceled: 46 },
      { day: 'Jul', booked: 130, canceled: 48 },
      { day: 'Aug', booked: 124, canceled: 44 },
      { day: 'Sep', booked: 138, canceled: 51 },
      { day: 'Oct', booked: 149, canceled: 55 },
      { day: 'Nov', booked: 154, canceled: 57 },
      { day: 'Dec', booked: 161, canceled: 60 },
      { day: 'Jan', booked: 166, canceled: 62 },
      { day: 'Feb', booked: 158, canceled: 59 },
      { day: 'Mar', booked: 146, canceled: 58 },
      { day: 'Apr', booked: 162, canceled: 61 },
      { day: 'May', booked: 171, canceled: 64 },
    ],
    [],
  );

  const reservations6m = useMemo(
    () => [
      { day: 'Jan', booked: 310, canceled: 74 },
      { day: 'Feb', booked: 298, canceled: 69 },
      { day: 'Mar', booked: 344, canceled: 81 },
      { day: 'Apr', booked: 366, canceled: 88 },
      { day: 'May', booked: 352, canceled: 83 },
      { day: 'Jun', booked: 388, canceled: 96 },
    ],
    [],
  );

  const [reservationsRange, setReservationsRange] = useState<DashboardRange>('7d');
  const applyDashboardGlobalRange = (range: DashboardRange) => {
    setDashboardGlobalRange(range);
    setRevenueRange(range);
    setReservationsRange(range);
    setShowDashboardGlobalRangeMenu(false);
  };

  useEffect(() => {
    if (!showDashboardGlobalRangeMenu) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (globalRangeMenuRef.current?.contains(target)) return;
      setShowDashboardGlobalRangeMenu(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowDashboardGlobalRangeMenu(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showDashboardGlobalRangeMenu]);

  const dashboardRangeLabel = DASHBOARD_RANGE_LABELS[dashboardGlobalRange];
  const reservationsByDay = useMemo(
    () =>
      reservationsRange === '7d'
        ? reservations7d
        : reservationsRange === '3m'
          ? reservations3m
          : reservationsRange === '6m'
            ? reservations6m
            : reservations1y,
    [reservations1y, reservations3m, reservations6m, reservations7d, reservationsRange],
  );

  // MOCK DATA - replace with real data
  const bookingByPlatform = useMemo(() => {
    const byRange: Record<DashboardRange, { name: string; pct: number }[]> = {
      '7d': [
        { name: 'Direct Booking', pct: 57 },
        { name: 'Booking.com', pct: 14 },
        { name: 'Agoda', pct: 10 },
        { name: 'Airbnb', pct: 11 },
        { name: 'Hotels.com', pct: 6 },
        { name: 'Others', pct: 2 },
      ],
      '3m': [
        { name: 'Direct Booking', pct: 59 },
        { name: 'Booking.com', pct: 13 },
        { name: 'Agoda', pct: 11 },
        { name: 'Airbnb', pct: 10 },
        { name: 'Hotels.com', pct: 5 },
        { name: 'Others', pct: 2 },
      ],
      '6m': [
        { name: 'Direct Booking', pct: 61 },
        { name: 'Booking.com', pct: 12 },
        { name: 'Agoda', pct: 11 },
        { name: 'Airbnb', pct: 9 },
        { name: 'Hotels.com', pct: 5 },
        { name: 'Others', pct: 2 },
      ],
      '1y': [
        { name: 'Direct Booking', pct: 63 },
        { name: 'Booking.com', pct: 11 },
        { name: 'Agoda', pct: 10 },
        { name: 'Airbnb', pct: 8 },
        { name: 'Hotels.com', pct: 5 },
        { name: 'Others', pct: 3 },
      ],
    };
    return byRange[dashboardGlobalRange];
  }, [dashboardGlobalRange]);

  // MOCK DATA - replace with real data
  const reviewSummary = useMemo(() => {
    const byRange: Record<
      DashboardRange,
      {
        rating: number;
        reviewsCount: number;
        responseRate: number;
        sentiment: { positive: number; neutral: number; negative: number };
        categories: { name: string; value: number }[];
      }
    > = {
      '7d': {
        rating: 4.5,
        reviewsCount: 312,
        responseRate: 92,
        sentiment: { positive: 258, neutral: 37, negative: 17 },
        categories: [
          { name: 'Facilities', value: 4.3 },
          { name: 'Cleanliness', value: 4.6 },
          { name: 'Services', value: 4.5 },
          { name: 'Comfort', value: 4.7 },
          { name: 'Location', value: 4.5 },
          { name: 'Food & Dining', value: 4.3 },
        ],
      },
      '3m': {
        rating: 4.6,
        reviewsCount: 1188,
        responseRate: 93,
        sentiment: { positive: 998, neutral: 128, negative: 62 },
        categories: [
          { name: 'Facilities', value: 4.4 },
          { name: 'Cleanliness', value: 4.6 },
          { name: 'Services', value: 4.6 },
          { name: 'Comfort', value: 4.7 },
          { name: 'Location', value: 4.5 },
          { name: 'Food & Dining', value: 4.4 },
        ],
      },
      '6m': {
        rating: 4.6,
        reviewsCount: 2546,
        responseRate: 94,
        sentiment: { positive: 2180, neutral: 256, negative: 110 },
        categories: [
          { name: 'Facilities', value: 4.4 },
          { name: 'Cleanliness', value: 4.7 },
          { name: 'Services', value: 4.6 },
          { name: 'Comfort', value: 4.8 },
          { name: 'Location', value: 4.5 },
          { name: 'Food & Dining', value: 4.4 },
        ],
      },
      '1y': {
        rating: 4.7,
        reviewsCount: 5012,
        responseRate: 95,
        sentiment: { positive: 4336, neutral: 468, negative: 208 },
        categories: [
          { name: 'Facilities', value: 4.5 },
          { name: 'Cleanliness', value: 4.7 },
          { name: 'Services', value: 4.7 },
          { name: 'Comfort', value: 4.8 },
          { name: 'Location', value: 4.6 },
          { name: 'Food & Dining', value: 4.5 },
        ],
      },
    };
    return byRange[dashboardGlobalRange];
  }, [dashboardGlobalRange]);

  // MOCK DATA - replace with real data
  const recentActivitiesBase = useMemo(
    () => [
      {
        id: 'ra-1',
        title: 'Conference Room Setup',
        detail: 'Events team set up Conference Room B for 10 AM meeting, including AV equipment and refreshments.',
        time: '12:00 PM',
      },
      {
        id: 'ra-2',
        title: 'Guest Check-Out',
        detail: 'Sarah Johnson completed check-out process and updated room availability for Room 305.',
        time: '11:00 AM',
      },
      {
        id: 'ra-3',
        title: 'Room Cleaning Completed',
        detail: 'Maria Gonzalez cleaned and prepared Room 204 for new guests.',
        time: '10:00 AM',
      },
      {
        id: 'ra-4',
        title: 'Invoice Sent to Guest',
        detail: 'Invoice INV-2028-119 was emailed to Anthony Clarke for Room 101.',
        time: '9:35 AM',
      },
      {
        id: 'ra-5',
        title: 'Late Check-Out Approved',
        detail: 'Front desk approved late check-out for Room 302 until 2:00 PM.',
        time: '9:10 AM',
      },
      {
        id: 'ra-6',
        title: 'Inventory Restocked',
        detail: 'Housekeeping trolley stock refreshed for floors 2 and 3.',
        time: '8:40 AM',
      },
    ],
    [],
  );

  const recentActivities = useMemo(() => {
    if (dashboardGlobalRange === '7d') return recentActivitiesBase.slice(0, 4);
    if (dashboardGlobalRange === '3m') return recentActivitiesBase.slice(0, 5);
    return recentActivitiesBase;
  }, [dashboardGlobalRange, recentActivitiesBase]);

  // MOCK DATA - replace with real data
  const taskTemplates = useMemo<TaskTemplate[]>(
    () => [
      { id: 't1', dateLabel: 'June 19, 2028', title: 'Set Up Conference Room B for 10 AM Meeting', subtitle: 'Meeting' },
      { id: 't2', dateLabel: 'June 19, 2028', title: 'Restock Housekeeping Supplies on 3rd Floor', subtitle: '' },
      { id: 't3', dateLabel: 'June 20, 2028', title: 'Inspect and Clean the Pool Area', subtitle: '' },
      { id: 't4', dateLabel: 'June 20, 2028', title: 'Check-In Assistance During Peak Hours (4 PM - 6 PM)', subtitle: '' },
      { id: 't5', dateLabel: 'June 21, 2028', title: 'Mini-bar audit for premium rooms', subtitle: 'Inventory' },
      { id: 't6', dateLabel: 'June 21, 2028', title: 'VIP early check-in preparation', subtitle: 'Guest' },
    ],
    [],
  );
  const [taskCompletionById, setTaskCompletionById] = useState<Record<string, boolean>>({});
  const tasks = useMemo<TaskRow[]>(() => {
    const visible =
      dashboardGlobalRange === '7d'
        ? taskTemplates.slice(0, 4)
        : dashboardGlobalRange === '3m'
          ? taskTemplates.slice(0, 5)
          : dashboardGlobalRange === '6m'
            ? taskTemplates.slice(0, 4)
            : taskTemplates;
    return visible.map((t) => ({ ...t, completed: !!taskCompletionById[t.id] }));
  }, [dashboardGlobalRange, taskCompletionById, taskTemplates]);

  // MOCK DATA - replace with real data
  const allBookings: BookingRow[] = useMemo(
    () => [
      {
        id: 'b1',
        bookingId: 'LG-B00108',
        guestName: 'Angus Copper',
        roomType: 'Deluxe',
        roomNumber: 'Room 101',
        duration: '3 nights',
        dates: 'June 19, 2028 - June 22, 2028',
        status: 'Checked-In',
      },
      {
        id: 'b2',
        bookingId: 'LG-B00109',
        guestName: 'Catherine Lopp',
        roomType: 'Standard',
        roomNumber: 'Room 202',
        duration: '2 nights',
        dates: 'June 19, 2028 - June 21, 2028',
        status: 'Checked-In',
      },
      {
        id: 'b3',
        bookingId: 'LG-B00110',
        guestName: 'Emily Johnson',
        roomType: 'Suite',
        roomNumber: 'Room 302',
        duration: '4 nights',
        dates: 'June 18, 2028 - June 22, 2028',
        status: 'Pending',
      },
      {
        id: 'b4',
        bookingId: 'LG-B00111',
        guestName: 'Daniel Brooks',
        roomType: 'Deluxe',
        roomNumber: 'Room 107',
        duration: '2 nights',
        dates: 'June 20, 2028 - June 22, 2028',
        status: 'Checked-In',
      },
      {
        id: 'b5',
        bookingId: 'LG-B00112',
        guestName: 'Sophia Miller',
        roomType: 'Standard',
        roomNumber: 'Room 206',
        duration: '1 night',
        dates: 'June 20, 2028 - June 21, 2028',
        status: 'Checked-Out',
      },
      {
        id: 'b6',
        bookingId: 'LG-B00113',
        guestName: 'Michael Stone',
        roomType: 'Suite',
        roomNumber: 'Room 401',
        duration: '5 nights',
        dates: 'June 17, 2028 - June 22, 2028',
        status: 'Checked-In',
      },
      {
        id: 'b7',
        bookingId: 'LG-B00114',
        guestName: 'Olivia Chen',
        roomType: 'Deluxe',
        roomNumber: 'Room 205',
        duration: '3 nights',
        dates: 'June 21, 2028 - June 24, 2028',
        status: 'Pending',
      },
      {
        id: 'b8',
        bookingId: 'LG-B00115',
        guestName: 'Noah Richardson',
        roomType: 'Standard',
        roomNumber: 'Room 118',
        duration: '2 nights',
        dates: 'June 21, 2028 - June 23, 2028',
        status: 'Checked-In',
      },
    ],
    [],
  );
  const bookings: BookingRow[] = useMemo(() => {
    if (dashboardGlobalRange === '7d') return allBookings.slice(0, 5);
    if (dashboardGlobalRange === '3m') return allBookings.slice(0, 6);
    if (dashboardGlobalRange === '6m') return allBookings;
    return [...allBookings].reverse();
  }, [allBookings, dashboardGlobalRange]);

  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatus, setBookingStatus] = useState<'All Status' | BookingStatus>('All Status');

  // MOCK DATA - replace with real data
  const roomSignals = useMemo<RoomSignal[]>(() => {
    const byRange: Record<DashboardRange, RoomSignal[]> = {
      '7d': [
        { label: 'Priority Clean', value: '2 rooms', tone: 'amber' },
        { label: 'Maintenance Alerts', value: '1 open', tone: 'sky' },
        { label: 'Late Check-Outs', value: '2 today', tone: 'lime' },
      ],
      '3m': [
        { label: 'Priority Clean', value: '4 rooms', tone: 'amber' },
        { label: 'Maintenance Alerts', value: '2 open', tone: 'sky' },
        { label: 'Late Check-Outs', value: '3 today', tone: 'lime' },
      ],
      '6m': [
        { label: 'Priority Clean', value: '3 rooms', tone: 'amber' },
        { label: 'Maintenance Alerts', value: '2 open', tone: 'sky' },
        { label: 'Late Check-Outs', value: '4 today', tone: 'lime' },
      ],
      '1y': [
        { label: 'Priority Clean', value: '5 rooms', tone: 'amber' },
        { label: 'Maintenance Alerts', value: '3 open', tone: 'sky' },
        { label: 'Late Check-Outs', value: '6 today', tone: 'lime' },
      ],
    };
    return byRange[dashboardGlobalRange];
  }, [dashboardGlobalRange]);

  // MOCK DATA - replace with real data
  const channelPerformance = useMemo<ChannelPerformance[]>(() => {
    const byRange: Record<DashboardRange, ChannelPerformance[]> = {
      '7d': [
        { label: 'Top Channel', value: 'Direct Booking', hint: '57% share', tone: 'emerald' },
        { label: 'Best Conversion', value: 'Airbnb', hint: '5.1% CVR', tone: 'sky' },
        { label: 'Highest ADR', value: '$228', hint: 'Direct', tone: 'amber' },
      ],
      '3m': [
        { label: 'Top Channel', value: 'Direct Booking', hint: '59% share', tone: 'emerald' },
        { label: 'Best Conversion', value: 'Booking.com', hint: '4.9% CVR', tone: 'sky' },
        { label: 'Highest ADR', value: '$219', hint: 'Agoda', tone: 'amber' },
      ],
      '6m': [
        { label: 'Top Channel', value: 'Direct Booking', hint: '61% share', tone: 'emerald' },
        { label: 'Best Conversion', value: 'Booking.com', hint: '4.8% CVR', tone: 'sky' },
        { label: 'Highest ADR', value: '$214', hint: 'Agoda', tone: 'amber' },
      ],
      '1y': [
        { label: 'Top Channel', value: 'Direct Booking', hint: '63% share', tone: 'emerald' },
        { label: 'Best Conversion', value: 'Booking.com', hint: '5.2% CVR', tone: 'sky' },
        { label: 'Highest ADR', value: '$236', hint: 'Hotels.com', tone: 'amber' },
      ],
    };
    return byRange[dashboardGlobalRange];
  }, [dashboardGlobalRange]);

  const filteredBookings = useMemo(() => {
    const q = bookingSearch.trim().toLowerCase();
    return bookings.filter((b) => {
      if (bookingStatus !== 'All Status' && b.status !== bookingStatus) return false;
      if (!q) return true;
      return b.guestName.toLowerCase().includes(q) || b.bookingId.toLowerCase().includes(q);
    });
  }, [bookings, bookingSearch, bookingStatus]);

  const totalRooms =
    roomAvailability.occupied + roomAvailability.reserved + roomAvailability.available + roomAvailability.notReady;
  const maxRevenuePoint = useMemo(() => {
    return revenueByMonth.reduce((best, cur) => (cur.value > best.value ? cur : best), revenueByMonth[0]);
  }, [revenueByMonth]);

  // Position the "TOTAL REVENUE" bubble near the max point (approx. by index + value range).
  const maxRevenueIndex = useMemo(() => {
    const idx = revenueByMonth.findIndex((p) => p.month === maxRevenuePoint.month);
    return Math.max(0, idx);
  }, [maxRevenuePoint.month, revenueByMonth]);

  const bubbleLeftPct = useMemo(() => {
    if (revenueByMonth.length <= 1) return 50;
    return (maxRevenueIndex / (revenueByMonth.length - 1)) * 100;
  }, [maxRevenueIndex, revenueByMonth.length]);

  const bubbleTopPct = useMemo(() => {
    const vals = revenueByMonth.map((p) => p.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max === min) return 22;
    const t = (maxRevenuePoint.value - min) / (max - min); // 0..1
    // Higher value => closer to top. Clamp to keep it readable.
    const top = 14 + (1 - t) * 34; // 14%..48%
    return Math.round(Math.min(48, Math.max(14, top)));
  }, [maxRevenuePoint.value, revenueByMonth]);

  const donutColors = ['#bbf7d0', '#d9f99d', '#c7d2fe', '#fde68a', '#fecaca', '#e2e8f0'];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div ref={globalRangeMenuRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={showDashboardGlobalRangeMenu}
              aria-label="Open dashboard global time filter"
              onClick={() => setShowDashboardGlobalRangeMenu((prev) => !prev)}
              className="inline-flex min-w-[148px] items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold text-text-main shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-200"
            >
              <span>{dashboardRangeLabel}</span>
              <svg className="ml-2 h-4 w-4 text-text-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 8l4 4 4-4" />
              </svg>
            </button>

            {showDashboardGlobalRangeMenu && (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-2 min-w-[156px] overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg"
              >
                {[
                  { value: '7d', label: 'Last 7 Days' },
                  { value: '3m', label: 'Last 3 Months' },
                  { value: '6m', label: 'Last 6 Months' },
                  { value: '1y', label: 'Last 1 Year' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitem"
                    onClick={() => applyDashboardGlobalRange(option.value as DashboardRange)}
                    className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                      dashboardGlobalRange === option.value
                        ? 'bg-primary-50 text-text-main'
                        : 'text-text-muted hover:bg-slate-50 hover:text-text-main'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate('/bookings?action=new')}
            className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-primary-600"
          >
            New booking
          </button>
          <button
            type="button"
            onClick={() => navigate('/guests?action=add')}
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
          >
            Add guest
          </button>
        </div>
      </div>

      <div className="grid items-stretch gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          title="New Bookings"
          value={summary.newBookings.toLocaleString()}
          trendPct={summary.trends.newBookings}
          to="/bookings"
          icon={
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M7 7h10M7 12h10M7 17h6" />
            </svg>
          }
        />
        <KpiCard
          title="Check-In"
          value={summary.checkIn.toLocaleString()}
          trendPct={summary.trends.checkIn}
          to="/bookings"
          icon={
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M3 12h18M7 8l-4 4 4 4" />
            </svg>
          }
        />
        <KpiCard
          title="Check-Out"
          value={summary.checkOut.toLocaleString()}
          trendPct={summary.trends.checkOut}
          to="/bookings"
          icon={
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M21 12H3m14 4l4-4-4-4" />
            </svg>
          }
        />
        {canViewFinancials && (
          <KpiCard
            title="Total Revenue"
            value={formatCurrency(summary.totalRevenue, currency)}
            trendPct={summary.trends.totalRevenue}
            to="/invoices"
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.7}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                />
              </svg>
            }
          />
        )}
        <KpiCard
          title="Occupancy"
          value={`${Math.round((roomAvailability.occupied / totalRooms) * 100)}%`}
          trendPct={2.14}
          to="/rooms"
          icon={
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M4 20h16M7 20V9l5-4 5 4v11M9 12h6" />
            </svg>
          }
        />
        {canViewFinancials && (
          <KpiCard
            title="ADR"
            value={formatCurrency(Math.round(summary.totalRevenue / Math.max(summary.newBookings, 1)), currency)}
            trendPct={1.92}
            to="/reports"
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M4 18h16M7 15l3-3 3 2 4-5" />
              </svg>
            }
          />
        )}
      </div>

        <div className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
          <ClickableCard to="/rooms" ariaLabel="Go to rooms" className="h-full rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Room Availability</div>
              <button
                type="button"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-50"
                aria-label="More"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
                </svg>
              </button>
            </div>

            <div className="mt-4">
              <div className="h-6 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="flex h-full w-full">
                  <div
                    className="h-full bg-emerald-200"
                    style={{ width: `${Math.round((roomAvailability.occupied / totalRooms) * 100)}%` }}
                    title="Occupied"
                  />
                  <div
                    className="h-full bg-lime-200"
                    style={{ width: `${Math.round((roomAvailability.reserved / totalRooms) * 100)}%` }}
                    title="Reserved"
                  />
                  <div
                    className="h-full bg-emerald-50"
                    style={{ width: `${Math.round((roomAvailability.available / totalRooms) * 100)}%` }}
                    title="Available"
                  />
                  <div
                    className="h-full bg-slate-200"
                    style={{ width: `${Math.round((roomAvailability.notReady / totalRooms) * 100)}%` }}
                    title="Not Ready"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-10 w-1 rounded-full bg-emerald-200" aria-hidden="true" />
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Occupied</div>
                    <div className={`mt-1 ${KPI_VALUE_CLASS_SM}`}>{roomAvailability.occupied}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-10 w-1 rounded-full bg-lime-200" aria-hidden="true" />
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Reserved</div>
                    <div className={`mt-1 ${KPI_VALUE_CLASS_SM}`}>{roomAvailability.reserved}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-10 w-1 rounded-full bg-emerald-100" aria-hidden="true" />
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Available</div>
                    <div className={`mt-1 ${KPI_VALUE_CLASS_SM}`}>{roomAvailability.available}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-10 w-1 rounded-full bg-slate-200" aria-hidden="true" />
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Not Ready</div>
                    <div className={`mt-1 ${KPI_VALUE_CLASS_SM}`}>{roomAvailability.notReady}</div>
                  </div>
                </div>
              </div>

              <div className="mt-10 grid gap-2 sm:grid-cols-3">
                {roomSignals.map((signal) => {
                  const toneClass =
                    signal.tone === 'amber'
                      ? 'bg-amber-50 text-amber-800 ring-amber-100'
                      : signal.tone === 'sky'
                        ? 'bg-sky-50 text-sky-800 ring-sky-100'
                        : 'bg-lime-50 text-lime-800 ring-lime-100';
                  return (
                    <div key={signal.label} className={`rounded-xl px-3 py-2 ring-1 ${toneClass}`}>
                      <div className="text-[11px] font-semibold text-slate-500">{signal.label}</div>
                      <div className="mt-1 text-sm font-semibold">{signal.value}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ClickableCard>

          {canViewFinancials && (
            <ClickableCard to="/expenses" ariaLabel="Go to revenue and expenses" className="min-w-0 h-full overflow-hidden rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Revenue</div>
                  <div className="text-xs font-semibold text-slate-500">
                    {revenueRange === '7d'
                      ? 'Last 7 Days'
                    : revenueRange === '3m'
                      ? 'Last 3 Months'
                      : revenueRange === '6m'
                        ? 'Last 6 Months'
                        : 'Last 1 Year'}
                </div>
              </div>
              <select
                className="min-w-[126px] rounded-full bg-lime-200 py-1.5 pl-4 pr-10 text-[11px] font-semibold text-slate-900"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                value={revenueRange}
                onChange={(e) => {
                  e.stopPropagation();
                  setRevenueRange(e.target.value as any);
                }}
              >
                <option value="7d">Last 7 Days</option>
                <option value="3m">Last 3 Months</option>
                <option value="6m">Last 6 Months</option>
                <option value="1y">Last 1 Year</option>
              </select>
            </div>

            <div className="relative mt-3 h-64 overflow-hidden">
              <div
                className="pointer-events-none absolute -translate-x-1/2 rounded-2xl border border-lime-200 bg-lime-50 px-4 py-2 text-center shadow-sm"
                style={{ left: `${bubbleLeftPct}%`, top: `${bubbleTopPct}%` }}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total Revenue</div>
                <div className="text-sm font-extrabold text-slate-900">{formatCurrency(maxRevenuePoint.value, currency)}</div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueByMonth}>
                  <defs>
                    <linearGradient id="revFillSoft" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#84cc16" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#84cc16" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                    width={44}
                  />
                  <Tooltip
                    formatter={(value: any) => formatCurrency(Number(value) || 0, currency)}
                    contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#65a30d" strokeWidth={2} fill="url(#revFillSoft)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ClickableCard>
          )}

          <ClickableCard to="/bookings" ariaLabel="Go to reservations" className="h-full rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Reservations</div>
              <select
                className="min-w-[126px] rounded-full bg-lime-200 py-1.5 pl-4 pr-10 text-[11px] font-semibold text-slate-900"
                value={reservationsRange}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  setReservationsRange(e.target.value as any);
                }}
              >
                <option value="7d">Last 7 Days</option>
                <option value="3m">Last 3 Months</option>
                <option value="6m">Last 6 Months</option>
                <option value="1y">Last 1 Year</option>
              </select>
            </div>

            <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-slate-500">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-200" />
                Booked
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-lime-200" />
                Canceled
              </span>
            </div>

            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reservationsByDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }} />
                  <Bar dataKey="booked" fill="#bbf7d0" radius={[10, 10, 10, 10]} />
                  <Bar dataKey="canceled" fill="#d9f99d" radius={[10, 10, 10, 10]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ClickableCard>

          <ClickableCard to="/reports" ariaLabel="Go to booking platform report" className="min-w-0 h-full rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Booking by Platform</div>
                <div className="text-xs font-semibold text-slate-500">{dashboardRangeLabel}</div>
              </div>
              <button
                type="button"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-50"
                aria-label="More"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
                </svg>
              </button>
            </div>

            <div className="mt-4 grid gap-4 2xl:grid-cols-[248px_220px_1fr] 2xl:items-center">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={bookingByPlatform} dataKey="pct" nameKey="name" innerRadius={64} outerRadius={96} paddingAngle={2}>
                      {bookingByPlatform.map((_, idx) => (
                        <Cell key={idx} fill={donutColors[idx % donutColors.length]} stroke="#ffffff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mx-auto w-full max-w-[220px] space-y-2 text-sm">
                {bookingByPlatform.map((row, idx) => (
                  <div key={row.name} className="grid grid-cols-[1fr_auto] items-center gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: donutColors[idx % donutColors.length] }} />
                      <span className="truncate text-slate-700">{row.name}</span>
                    </div>
                    <span className="font-semibold text-slate-900">{row.pct}%</span>
                  </div>
                ))}
              </div>

              <div className="grid gap-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
                {channelPerformance.map((item) => {
                  const toneClass =
                    item.tone === 'sky'
                      ? 'border-sky-200 bg-sky-50/50'
                      : item.tone === 'amber'
                        ? 'border-amber-200 bg-amber-50/50'
                        : 'border-emerald-200 bg-emerald-50/50';
                  const underlineClass =
                    item.tone === 'sky' ? 'bg-sky-300' : item.tone === 'amber' ? 'bg-amber-300' : 'bg-emerald-300';

                  return (
                  <div key={item.label} className={`rounded-xl border px-3 py-2 ${toneClass}`}>
                    <div className="text-[11px] font-semibold text-slate-500">{item.label}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
                    <div className="text-[11px] font-medium text-slate-500">{item.hint}</div>
                    <div className={`mt-1 h-1 w-16 rounded-full ${underlineClass}`} />
                  </div>
                )})}
              </div>
            </div>
          </ClickableCard>
        </div>

        <div className="rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <button
                type="button"
                className="text-sm font-semibold text-slate-900 hover:underline"
                onClick={() => navigate('/bookings')}
              >
                Booking List
              </button>
              <div className="mt-1 text-xs font-semibold text-slate-500">Filtered by {dashboardRangeLabel}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={bookingSearch}
                  onChange={(e) => setBookingSearch(e.target.value)}
                  className="w-56 rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm placeholder-slate-400 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Search guest, status, etc"
                />
              </div>
              <select
                value={bookingStatus}
                onChange={(e) => setBookingStatus(e.target.value as any)}
                className="rounded-xl bg-lime-200 px-3 py-2 text-xs font-semibold text-slate-900"
              >
                <option>All Status</option>
                <option>Checked-In</option>
                <option>Checked-Out</option>
                <option>Pending</option>
              </select>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Booking ID</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Guest Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Room Type</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Room Number</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Duration</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Check-In & Check-Out</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.map((b) => (
                  <tr key={b.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate('/bookings')}>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">{b.bookingId}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{b.guestName}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      <RoomTypeBadge roomType={b.roomType} />
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">{b.roomNumber}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{b.duration}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{b.dates}</td>
                    <td className="px-5 py-4 text-sm">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-slate-50 p-6 text-sm text-slate-600">No bookings match your search.</div>
          ) : null}
        </div>

        </div>

        <div className="min-w-0 flex h-full flex-col gap-5">
          <ClickableCard to="/reviews" ariaLabel="Go to reviews" className="min-h-[460px] rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Overall Rating</div>
                <div className="text-xs font-semibold text-slate-500">Based on {dashboardRangeLabel.toLowerCase()} reviews</div>
              </div>
              <button
                type="button"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-50"
                aria-label="More"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
                </svg>
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="rounded-2xl bg-lime-200 px-3 py-2 text-lg font-extrabold text-slate-900">
                {reviewSummary.rating.toFixed(1)}
                <span className="text-xs font-bold text-slate-700">/5</span>
              </div>
              <div className="text-sm">
                <div className="font-extrabold text-slate-900">Impressive</div>
                <div className="text-xs font-semibold text-slate-500">from {reviewSummary.reviewsCount.toLocaleString()} reviews</div>
              </div>
            </div>

            <div className="mt-3 space-y-2.5">
              {reviewSummary.categories.map((c) => (
                <div key={c.name} className="grid grid-cols-[96px_1fr_30px] items-center gap-3">
                  <div className="text-xs font-semibold text-slate-600">{c.name}</div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-lime-200" style={{ width: `${(c.value / 5) * 100}%` }} />
                  </div>
                  <div className="text-xs font-semibold text-slate-700 text-right">{c.value.toFixed(1)}</div>
                </div>
              ))}
            </div>

            <div className="mt-7 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/70 px-3 py-2 ring-1 ring-emerald-200">
                <div className="text-[11px] font-semibold text-emerald-800/80">Positive</div>
                <div className="mt-1 text-sm font-semibold text-emerald-700">
                  {reviewSummary.sentiment.positive.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-sky-50 to-sky-100/70 px-3 py-2 ring-1 ring-sky-200">
                <div className="text-[11px] font-semibold text-sky-800/80">Neutral</div>
                <div className="mt-1 text-sm font-semibold text-sky-700">
                  {reviewSummary.sentiment.neutral.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-rose-50 to-rose-100/70 px-3 py-2 ring-1 ring-rose-200">
                <div className="text-[11px] font-semibold text-rose-800/80">Negative</div>
                <div className="mt-1 text-sm font-semibold text-rose-700">
                  {reviewSummary.sentiment.negative.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-lime-50 to-lime-100/80 px-3 py-2 ring-1 ring-lime-200">
                <div className="text-[11px] font-semibold text-lime-900/80">Response Rate</div>
                <div className="mt-1 text-sm font-semibold text-lime-700">{reviewSummary.responseRate}%</div>
              </div>
            </div>
          </ClickableCard>

          <ClickableCard to="/housekeeping" ariaLabel="Go to housekeeping tasks" className="min-h-[420px] rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Tasks</div>
              <button
                type="button"
                className="rounded-full bg-lime-200 p-2 text-slate-900 hover:bg-lime-300"
                aria-label="Add"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/housekeeping');
                }}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className={`group flex items-start gap-3 rounded-2xl p-3 ring-1 transition ${
                    t.completed ? 'bg-slate-50 ring-slate-100' : 'bg-lime-50 ring-lime-100 hover:bg-lime-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={t.completed}
                    onChange={(e) => {
                      e.stopPropagation();
                      const checked = e.target.checked;
                      setTaskCompletionById((prev) => ({ ...prev, [t.id]: checked }));
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-lime-600"
                  />
                  <div className="min-w-0">
                    <div className="inline-flex rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                      {t.dateLabel}
                    </div>
                    <div className={`mt-1 text-sm font-extrabold ${t.completed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                      {t.title}
                    </div>
                    {t.subtitle ? <div className="mt-1 text-xs font-semibold text-slate-600">{t.subtitle}</div> : null}
                  </div>
                  <button
                    type="button"
                    className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-white"
                    aria-label="More"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </ClickableCard>

          <ClickableCard to="/settings?tab=audit-trail" ariaLabel="Go to audit trail" className="min-h-[500px] rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Recent Activities</div>
              <button
                type="button"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-50"
                aria-label="More"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
                </svg>
              </button>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {recentActivities.map((a) => (
                <div key={a.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-lime-100 text-lime-800">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-extrabold text-slate-900">{a.title}</div>
                      <div className="shrink-0 text-xs font-semibold text-slate-500">{a.time}</div>
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-600">{a.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </ClickableCard>
        </div>

      </div>

    </div>
  );
}

