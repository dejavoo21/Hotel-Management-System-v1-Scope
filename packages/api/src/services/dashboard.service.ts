import { prisma } from '../config/database.js';
import { DashboardSummary, DashboardArrival, DashboardDeparture, HousekeepingSummary, PriorityRoom } from '../types/index.js';
import { startOfDay, endOfDay, subDays, format } from '../utils/date.js';

/**
 * Get dashboard summary for a hotel
 */
export async function getDashboardSummary(hotelId: string): Promise<DashboardSummary> {
  const today = new Date();
  const startOfToday = startOfDay(today);
  const endOfToday = endOfDay(today);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Get room counts
  const roomCounts = await prisma.room.groupBy({
    by: ['status'],
    where: { hotelId, isActive: true },
    _count: true,
  });

  const totalRooms = roomCounts.reduce((sum, r) => sum + r._count, 0);
  const occupiedRooms = roomCounts.find(r => r.status === 'OCCUPIED')?._count || 0;
  const availableRooms = roomCounts.find(r => r.status === 'AVAILABLE')?._count || 0;
  const outOfServiceRooms = roomCounts.find(r => r.status === 'OUT_OF_SERVICE')?._count || 0;

  // Get today's arrivals count
  const todayArrivals = await prisma.booking.count({
    where: {
      hotelId,
      checkInDate: { gte: startOfToday, lte: endOfToday },
      status: { in: ['CONFIRMED', 'CHECKED_IN'] },
    },
  });

  // Get today's departures count
  const todayDepartures = await prisma.booking.count({
    where: {
      hotelId,
      checkOutDate: { gte: startOfToday, lte: endOfToday },
      status: { in: ['CHECKED_IN', 'CHECKED_OUT'] },
    },
  });

  // Get in-house guests count
  const inHouseGuests = await prisma.booking.aggregate({
    where: {
      hotelId,
      status: 'CHECKED_IN',
    },
    _sum: {
      numberOfAdults: true,
      numberOfChildren: true,
    },
  });

  // Get today's revenue
  const todayPayments = await prisma.payment.aggregate({
    where: {
      booking: { hotelId },
      status: 'COMPLETED',
      processedAt: { gte: startOfToday, lte: endOfToday },
    },
    _sum: { amount: true },
  });

  // Get month's revenue
  const monthPayments = await prisma.payment.aggregate({
    where: {
      booking: { hotelId },
      status: 'COMPLETED',
      processedAt: { gte: startOfMonth, lte: endOfToday },
    },
    _sum: { amount: true },
  });

  return {
    todayArrivals,
    todayDepartures,
    currentOccupancy: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
    totalRooms,
    occupiedRooms,
    availableRooms,
    outOfServiceRooms,
    inHouseGuests: (inHouseGuests._sum.numberOfAdults || 0) + (inHouseGuests._sum.numberOfChildren || 0),
    todayRevenue: Number(todayPayments._sum.amount || 0),
    monthRevenue: Number(monthPayments._sum.amount || 0),
  };
}

/**
 * Get today's arrivals
 */
export async function getTodayArrivals(hotelId: string): Promise<DashboardArrival[]> {
  const today = new Date();
  const startOfToday = startOfDay(today);
  const endOfToday = endOfDay(today);

  const bookings = await prisma.booking.findMany({
    where: {
      hotelId,
      checkInDate: { gte: startOfToday, lte: endOfToday },
      status: { in: ['CONFIRMED', 'CHECKED_IN'] },
    },
    include: {
      guest: { select: { firstName: true, lastName: true } },
      room: { select: { number: true, roomType: { select: { name: true } } } },
    },
    orderBy: { checkInDate: 'asc' },
  });

  return bookings.map(booking => ({
    id: booking.id,
    time: format(booking.checkInDate, 'HH:mm'),
    guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
    roomType: booking.room?.roomType.name || 'Not assigned',
    roomNumber: booking.room?.number,
    status: booking.status,
    bookingRef: booking.bookingRef,
  }));
}

/**
 * Get today's departures
 */
export async function getTodayDepartures(hotelId: string): Promise<DashboardDeparture[]> {
  const today = new Date();
  const startOfToday = startOfDay(today);
  const endOfToday = endOfDay(today);

  const bookings = await prisma.booking.findMany({
    where: {
      hotelId,
      checkOutDate: { gte: startOfToday, lte: endOfToday },
      status: { in: ['CHECKED_IN', 'CHECKED_OUT'] },
    },
    include: {
      guest: { select: { firstName: true, lastName: true } },
      room: { select: { number: true, roomType: { select: { name: true } } } },
    },
    orderBy: { checkOutDate: 'asc' },
  });

  return bookings.map(booking => ({
    id: booking.id,
    time: format(booking.checkOutDate, 'HH:mm'),
    guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
    roomType: booking.room?.roomType.name || 'Unknown',
    roomNumber: booking.room?.number || 'N/A',
    status: booking.status,
    balanceDue: Number(booking.totalAmount) - Number(booking.paidAmount),
  }));
}

/**
 * Get housekeeping summary
 */
export async function getHousekeepingSummary(hotelId: string): Promise<HousekeepingSummary> {
  const statusCounts = await prisma.room.groupBy({
    by: ['housekeepingStatus'],
    where: { hotelId, isActive: true },
    _count: true,
  });

  const today = new Date();
  const startOfToday = startOfDay(today);
  const endOfToday = endOfDay(today);

  // Get priority rooms (dirty rooms needed for arrivals)
  const priorityRooms = await prisma.room.findMany({
    where: {
      hotelId,
      isActive: true,
      housekeepingStatus: 'DIRTY',
      bookings: {
        some: {
          checkInDate: { gte: startOfToday, lte: endOfToday },
          status: 'CONFIRMED',
        },
      },
    },
    select: {
      number: true,
      floor: true,
      housekeepingStatus: true,
      bookings: {
        where: {
          checkInDate: { gte: startOfToday, lte: endOfToday },
          status: 'CONFIRMED',
        },
        select: { checkInDate: true },
        take: 1,
      },
    },
    take: 5,
  });

  return {
    clean: statusCounts.find(s => s.housekeepingStatus === 'CLEAN')?._count || 0,
    dirty: statusCounts.find(s => s.housekeepingStatus === 'DIRTY')?._count || 0,
    inspection: statusCounts.find(s => s.housekeepingStatus === 'INSPECTION')?._count || 0,
    outOfService: statusCounts.find(s => s.housekeepingStatus === 'OUT_OF_SERVICE')?._count || 0,
    priorityRooms: priorityRooms.map(room => ({
      roomNumber: room.number,
      floor: room.floor,
      status: room.housekeepingStatus,
      reason: 'Needed for arrival',
      neededBy: room.bookings[0] ? format(room.bookings[0].checkInDate, 'HH:mm') : undefined,
    })),
  };
}

/**
 * Get priority alerts
 */
export async function getPriorityAlerts(hotelId: string) {
  const today = new Date();
  const startOfToday = startOfDay(today);
  const endOfToday = endOfDay(today);

  const alerts: { id: string; level: 'high' | 'medium' | 'low'; title: string; description: string; actionLabel: string }[] = [];

  // Check for dirty rooms needed for arrivals
  const dirtyRoomsForArrivals = await prisma.room.count({
    where: {
      hotelId,
      isActive: true,
      housekeepingStatus: 'DIRTY',
      bookings: {
        some: {
          checkInDate: { gte: startOfToday, lte: endOfToday },
          status: 'CONFIRMED',
        },
      },
    },
  });

  if (dirtyRoomsForArrivals > 0) {
    alerts.push({
      id: 'dirty-arrivals',
      level: 'high',
      title: `${dirtyRoomsForArrivals} room${dirtyRoomsForArrivals > 1 ? 's' : ''} needed for arrivals still dirty`,
      description: 'Housekeeping needs to clean before check-in.',
      actionLabel: 'View rooms',
    });
  }

  // Check for VIP arrivals
  const vipArrivals = await prisma.booking.count({
    where: {
      hotelId,
      checkInDate: { gte: startOfToday, lte: endOfToday },
      status: 'CONFIRMED',
      guest: { vipStatus: true },
    },
  });

  if (vipArrivals > 0) {
    alerts.push({
      id: 'vip-arrivals',
      level: 'medium',
      title: `${vipArrivals} VIP arrival${vipArrivals > 1 ? 's' : ''} today`,
      description: 'Ensure special preparations are ready.',
      actionLabel: 'View VIPs',
    });
  }

  // Check for out of service rooms
  const oosRooms = await prisma.room.count({
    where: {
      hotelId,
      isActive: true,
      status: 'OUT_OF_SERVICE',
    },
  });

  if (oosRooms > 0) {
    alerts.push({
      id: 'oos-rooms',
      level: 'low',
      title: `${oosRooms} room${oosRooms > 1 ? 's' : ''} out of service`,
      description: 'Maintenance scheduled.',
      actionLabel: 'View issues',
    });
  }

  return alerts;
}

/**
 * Get occupancy trend for past N days
 */
export async function getOccupancyTrend(hotelId: string, days: number) {
  const totalRooms = await prisma.room.count({
    where: { hotelId, isActive: true },
  });

  const trend: { date: string; occupancy: number; occupiedRooms: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const start = startOfDay(date);
    const end = endOfDay(date);

    const occupiedRooms = await prisma.booking.count({
      where: {
        hotelId,
        status: { in: ['CHECKED_IN', 'CHECKED_OUT'] },
        checkInDate: { lte: end },
        checkOutDate: { gte: start },
      },
    });

    trend.push({
      date: format(date, 'yyyy-MM-dd'),
      occupancy: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
      occupiedRooms,
    });
  }

  return trend;
}

/**
 * Get booking mix by source
 */
export async function getBookingMix(hotelId: string) {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const sources = await prisma.booking.groupBy({
    by: ['source'],
    where: {
      hotelId,
      createdAt: { gte: startOfMonth },
    },
    _count: true,
  });

  const total = sources.reduce((sum, s) => sum + s._count, 0);

  return sources.map(s => ({
    source: s.source,
    count: s._count,
    percentage: total > 0 ? Math.round((s._count / total) * 100) : 0,
  }));
}
