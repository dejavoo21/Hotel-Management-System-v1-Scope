import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardService } from '@/services';
import { useAuthStore } from '@/stores/authStore';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const buildQuery = (params?: Record<string, string>) =>
    params ? `?${new URLSearchParams(params).toString()}` : '';

  const navigateToBookings = (params?: Record<string, string>) => {
    navigate(`/bookings${buildQuery(params)}`);
  };

  const navigateToRooms = (params?: Record<string, string>) => {
    navigate(`/rooms${buildQuery(params)}`);
  };

  const navigateToHousekeeping = (params?: Record<string, string>) => {
    navigate(`/housekeeping${buildQuery(params)}`);
  };

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: dashboardService.getSummary,
  });

  const { data: arrivals, isLoading: arrivalsLoading } = useQuery({
    queryKey: ['dashboard', 'arrivals'],
    queryFn: dashboardService.getArrivals,
  });

  const { data: departures, isLoading: departuresLoading } = useQuery({
    queryKey: ['dashboard', 'departures'],
    queryFn: dashboardService.getDepartures,
  });

  const { data: housekeeping } = useQuery({
    queryKey: ['dashboard', 'housekeeping'],
    queryFn: dashboardService.getHousekeepingSummary,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: user?.hotel?.currency || 'USD',
    }).format(amount);
  };

  const formatDate = () => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date());
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const occupancyRate = summary ? Math.round((summary.occupiedRooms / summary.totalRooms) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMCAwdi02aC02djZoNnptLTYgNmgtNnY2aDZ2LTZ6bTYgMGg2djZoLTZ2LTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        <div className="relative z-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-300">{formatDate()}</p>
              <h1 className="mt-1 text-2xl font-bold">
                {getGreeting()}, {user?.firstName}!
              </h1>
              <p className="mt-1 text-slate-300">
                Here's what's happening at {user?.hotel?.name || 'your hotel'} today.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/bookings?action=new')}
                className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Booking
              </button>
              <button
                type="button"
                onClick={() => navigate('/guests?action=add')}
                className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Add Guest
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Occupancy Card */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Occupancy</p>
              {summaryLoading ? (
                <div className="mt-2 h-8 w-20 animate-pulse rounded bg-slate-200" />
              ) : (
                <>
                  <p className="mt-1 text-3xl font-bold text-slate-900">{occupancyRate}%</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {summary?.occupiedRooms || 0} / {summary?.totalRooms || 0} rooms
                  </p>
                </>
              )}
            </div>
            <div className="relative h-16 w-16">
              <svg className="h-16 w-16 -rotate-90 transform" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="3"
                  strokeDasharray={`${occupancyRate}, 100`}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Arrivals Card */}
        <button
          type="button"
          onClick={() => navigateToBookings({ status: 'CONFIRMED' })}
          className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-left"
        >
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 translate-y-[-8px] rounded-full bg-emerald-50" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-500">Arrivals Today</p>
            </div>
            {summaryLoading ? (
              <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-200" />
            ) : (
              <>
                <p className="mt-3 text-3xl font-bold text-slate-900">{summary?.todayArrivals || 0}</p>
                <p className="mt-1 text-sm text-emerald-600">Expected check-ins</p>
              </>
            )}
          </div>
        </button>

        {/* Departures Card */}
        <button
          type="button"
          onClick={() => navigateToBookings({ status: 'CHECKED_IN' })}
          className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-left"
        >
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 translate-y-[-8px] rounded-full bg-amber-50" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-500">Departures Today</p>
            </div>
            {summaryLoading ? (
              <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-200" />
            ) : (
              <>
                <p className="mt-3 text-3xl font-bold text-slate-900">{summary?.todayDepartures || 0}</p>
                <p className="mt-1 text-sm text-amber-600">Expected check-outs</p>
              </>
            )}
          </div>
        </button>

        {/* Revenue Card */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 translate-y-[-8px] rounded-full bg-purple-50" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-500">Today's Revenue</p>
            </div>
            {summaryLoading ? (
              <div className="mt-3 h-8 w-24 animate-pulse rounded bg-slate-200" />
            ) : (
              <>
                <p className="mt-3 text-3xl font-bold text-slate-900">
                  {formatCurrency(summary?.todayRevenue || 0)}
                </p>
                <p className="mt-1 text-sm text-purple-600">
                  MTD: {formatCurrency(summary?.monthRevenue || 0)}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Room Status & Housekeeping */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Room Status Visual */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Room Status Overview</h2>
            <Link to="/rooms" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              View All Rooms
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            <button
              type="button"
              onClick={() => navigateToRooms({ status: 'AVAILABLE' })}
              className="group cursor-pointer rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 transition-all hover:shadow-md text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500 text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="mt-3 text-2xl font-bold text-emerald-700">{summary?.availableRooms || 0}</p>
              <p className="text-sm font-medium text-emerald-600">Available</p>
            </button>
            <button
              type="button"
              onClick={() => navigateToRooms({ status: 'OCCUPIED' })}
              className="group cursor-pointer rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 p-4 transition-all hover:shadow-md text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500 text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="mt-3 text-2xl font-bold text-blue-700">{summary?.occupiedRooms || 0}</p>
              <p className="text-sm font-medium text-blue-600">Occupied</p>
            </button>
            <button
              type="button"
              onClick={() => navigateToRooms({ status: 'OUT_OF_SERVICE' })}
              className="group cursor-pointer rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 p-4 transition-all hover:shadow-md text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-500 text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-700">{summary?.outOfServiceRooms || 0}</p>
              <p className="text-sm font-medium text-slate-600">Maintenance</p>
            </button>
            <button
              type="button"
              onClick={() => navigateToBookings({ status: 'CHECKED_IN' })}
              className="group cursor-pointer rounded-xl bg-gradient-to-br from-primary-50 to-primary-100 p-4 transition-all hover:shadow-md text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500 text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="mt-3 text-2xl font-bold text-primary-700">{summary?.inHouseGuests || 0}</p>
              <p className="text-sm font-medium text-primary-600">In-House Guests</p>
            </button>
          </div>
        </div>

        {/* Housekeeping Summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Housekeeping</h2>
            <Link to="/housekeeping" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              Manage
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={() => navigateToHousekeeping({ status: 'CLEAN' })}
              className="flex flex-col justify-between rounded-lg bg-emerald-50 p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                  <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="font-medium text-emerald-700">Clean</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{housekeeping?.clean || 0}</p>
            </button>
            <button
              type="button"
              onClick={() => navigateToHousekeeping({ status: 'DIRTY' })}
              className="flex flex-col justify-between rounded-lg bg-amber-50 p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                  <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <span className="font-medium text-amber-700">Dirty</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-amber-700">{housekeeping?.dirty || 0}</p>
            </button>
            <button
              type="button"
              onClick={() => navigateToHousekeeping({ status: 'INSPECTION' })}
              className="flex flex-col justify-between rounded-lg bg-blue-50 p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                  <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <span className="font-medium text-blue-700">Inspection</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-blue-700">{housekeeping?.inspection || 0}</p>
            </button>
            <button
              type="button"
              onClick={() => navigateToHousekeeping({ status: 'OUT_OF_SERVICE' })}
              className="flex flex-col justify-between rounded-lg bg-slate-100 p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200">
                  <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <span className="font-medium text-slate-700">Out of Service</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-700">{housekeeping?.outOfService || 0}</p>
            </button>
          </div>
        </div>
      </div>

      {/* Arrivals & Departures */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Arrivals */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
                <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Today's Arrivals</h2>
                <p className="text-sm text-slate-500">{arrivals?.length || 0} expected</p>
              </div>
            </div>
            <Link to="/bookings?status=CONFIRMED" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              View All
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {arrivalsLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                  </div>
                </div>
              ))
            ) : arrivals?.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                  <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="mt-3 text-sm text-slate-500">No arrivals scheduled for today</p>
              </div>
            ) : (
              arrivals?.slice(0, 5).map((arrival) => (
                <div key={arrival.id} className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                      {arrival.guestName.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{arrival.guestName}</p>
                      <p className="text-sm text-slate-500">
                        {arrival.roomType} {arrival.roomNumber && `• Room ${arrival.roomNumber}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-900">{arrival.time}</p>
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      {arrival.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Today's Departures */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
                <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Today's Departures</h2>
                <p className="text-sm text-slate-500">{departures?.length || 0} expected</p>
              </div>
            </div>
            <Link to="/bookings?status=CHECKED_IN" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              View All
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {departuresLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                  </div>
                </div>
              ))
            ) : departures?.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                  <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="mt-3 text-sm text-slate-500">No departures scheduled for today</p>
              </div>
            ) : (
              departures?.slice(0, 5).map((departure) => (
                <div key={departure.id} className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700">
                      {departure.guestName.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{departure.guestName}</p>
                      <p className="text-sm text-slate-500">Room {departure.roomNumber}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-900">{departure.time}</p>
                    {departure.balanceDue > 0 ? (
                      <span className="text-sm font-medium text-red-600">
                        {formatCurrency(departure.balanceDue)} due
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Paid
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Priority Rooms Alert */}
      {housekeeping?.priorityRooms && housekeeping.priorityRooms.length > 0 && (
        <div className="rounded-xl border-l-4 border-l-amber-500 bg-amber-50 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800">Priority Rooms Need Attention</h3>
              <p className="mt-1 text-sm text-amber-700">
                {housekeeping.priorityRooms.length} room(s) need cleaning before upcoming arrivals
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {housekeeping.priorityRooms.map((room) => (
                  <Link
                    key={room.roomNumber}
                    to={`/housekeeping?room=${room.roomNumber}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-amber-700 shadow-sm transition-colors hover:bg-amber-100"
                  >
                    <span>Room {room.roomNumber}</span>
                    <span className="text-xs text-amber-500">Floor {room.floor}</span>
                  </Link>
                ))}
              </div>
            </div>
            <Link
              to="/housekeeping"
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
            >
              Manage Housekeeping
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
