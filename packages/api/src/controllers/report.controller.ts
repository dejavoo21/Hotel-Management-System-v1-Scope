import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { prisma } from '../config/database.js';
import { startOfDay, endOfDay, getDateRange } from '../utils/date.js';
import PDFDocument from 'pdfkit';
import { sendEmail } from '../services/email.service.js';
import { renderLafloEmail } from '../utils/emailTemplates.js';

export async function getRevenueReport(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { startDate, endDate } = req.query;

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    const payments = await prisma.payment.findMany({
      where: {
        booking: { hotelId },
        status: 'COMPLETED',
        processedAt: { gte: startOfDay(start), lte: endOfDay(end) },
      },
      select: {
        amount: true,
        method: true,
        processedAt: true,
      },
    });

    const bookings = payments.length === 0
      ? await prisma.booking.findMany({
          where: {
            hotelId,
            checkInDate: { gte: startOfDay(start), lte: endOfDay(end) },
          },
          select: {
            totalAmount: true,
            paymentMethod: true,
            checkInDate: true,
          },
        })
      : [];

    const revenueEvents = payments.length > 0
      ? payments.map((payment) => ({
          amount: Number(payment.amount),
          method: payment.method,
          date: payment.processedAt,
        }))
      : bookings.map((booking) => ({
          amount: Number(booking.totalAmount),
          method: booking.paymentMethod || 'UNKNOWN',
          date: booking.checkInDate,
        }));

    const dates = getDateRange(start, end);
    const breakdown = dates.map((date) => {
      const dateStart = startOfDay(date);
      const dateEnd = endOfDay(date);
      const dayPayments = revenueEvents.filter(
        (p) => p.date >= dateStart && p.date <= dateEnd
      );
      return {
        date: date.toISOString().split('T')[0],
        revenue: dayPayments.reduce((sum, p) => sum + p.amount, 0),
        bookings: dayPayments.length,
      };
    });

    const total = revenueEvents.reduce((sum, p) => sum + p.amount, 0);
    const byMethod = revenueEvents.reduce((acc, p) => {
      const method = p.method || 'UNKNOWN';
      acc[method] = (acc[method] || 0) + p.amount;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      success: true,
      data: { total, byMethod, transactionCount: revenueEvents.length, breakdown },
    });
  } catch (error) {
    next(error);
  }
}

export async function getOccupancyReport(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { startDate, endDate } = req.query;

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    const totalRooms = await prisma.room.count({ where: { hotelId, isActive: true } });

    const dates = getDateRange(start, end);
    const occupancyData = await Promise.all(
      dates.map(async (date) => {
        const occupied = await prisma.booking.count({
          where: {
            hotelId,
            status: { in: ['CHECKED_IN', 'CHECKED_OUT'] },
            checkInDate: { lte: endOfDay(date) },
            checkOutDate: { gte: startOfDay(date) },
          },
        });
        return {
          date: date.toISOString().split('T')[0],
          occupied,
          total: totalRooms,
          rate: totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0,
        };
      })
    );

    const avgOccupancy = occupancyData.reduce((sum, d) => sum + d.rate, 0) / occupancyData.length;

    res.json({
      success: true,
      data: { averageRate: Math.round(avgOccupancy), breakdown: occupancyData },
    });
  } catch (error) {
    next(error);
  }
}

export async function getBookingsReport(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { startDate, endDate } = req.query;

    const where = {
      hotelId,
      createdAt: {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      },
    };

    const [total, byStatus] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.groupBy({ by: ['status'], where, _count: true }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        byStatus: byStatus.reduce((acc, s) => {
          acc[s.status] = s._count;
          return acc;
        }, {} as Record<string, number>),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getBookingSourcesReport(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { startDate, endDate } = req.query;

    const sources = await prisma.booking.groupBy({
      by: ['source'],
      where: {
        hotelId,
        createdAt: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        },
      },
      _count: true,
      _sum: { totalAmount: true },
    });

    res.json({
      success: true,
      data: sources.map(s => ({
        source: s.source,
        count: s._count,
        revenue: Number(s._sum.totalAmount || 0),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function getRoomTypePerformance(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { startDate, endDate } = req.query;

    const roomTypes = await prisma.roomType.findMany({
      where: { hotelId },
      include: {
        rooms: {
          include: {
            bookings: {
              where: {
                checkInDate: { lte: new Date(endDate as string) },
                checkOutDate: { gte: new Date(startDate as string) },
                status: { in: ['CHECKED_IN', 'CHECKED_OUT'] },
              },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      data: roomTypes.map(rt => ({
        id: rt.id,
        name: rt.name,
        roomCount: rt.rooms.length,
        bookings: rt.rooms.reduce((sum, r) => sum + r.bookings.length, 0),
        baseRate: Number(rt.baseRate),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function getGuestReport(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { startDate, endDate } = req.query;

    const [totalGuests, newGuests, topGuests] = await Promise.all([
      prisma.guest.count({ where: { hotelId } }),
      prisma.guest.count({
        where: {
          hotelId,
          createdAt: {
            gte: new Date(startDate as string),
            lte: new Date(endDate as string),
          },
        },
      }),
      prisma.guest.findMany({
        where: { hotelId },
        orderBy: { totalSpent: 'desc' },
        take: 10,
        select: { id: true, firstName: true, lastName: true, totalStays: true, totalSpent: true },
      }),
    ]);

    res.json({ success: true, data: { totalGuests, newGuests, topGuests } });
  } catch (error) {
    next(error);
  }
}

export async function getSummaryReport(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { startDate, endDate } = req.query;

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    const [revenue, bookings, guests] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          booking: { hotelId },
          status: 'COMPLETED',
          processedAt: { gte: start, lte: end },
        },
        _sum: { amount: true },
      }),
      prisma.booking.count({
        where: { hotelId, createdAt: { gte: start, lte: end } },
      }),
      prisma.guest.count({
        where: { hotelId, createdAt: { gte: start, lte: end } },
      }),
    ]);

    res.json({
      success: true,
      data: {
        revenue: Number(revenue._sum.amount || 0),
        bookings,
        newGuests: guests,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function exportReport(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { type } = req.params;
    const { startDate, endDate, format } = req.query;

    const report = await buildReport(type, hotelId, startDate as string, endDate as string);
    const outputFormat = (format as string) || 'csv';

    if (outputFormat === 'pdf') {
      const pdfBuffer = await buildPdf(report.title, report.headers, report.rows);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${report.title.replace(/\s+/g, '-').toLowerCase()}.pdf"`
      );
      res.end(pdfBuffer);
      return;
    }

    const csv = buildCsv(report.headers, report.rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${report.title.replace(/\s+/g, '-').toLowerCase()}.csv"`
    );
    res.send(csv);
  } catch (error) {
    next(error);
  }
}

export async function emailReport(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { type, recipientEmail, format } = req.body;
    const { startDate, endDate } = req.body;

    const report = await buildReport(type, hotelId, startDate, endDate);
    const outputFormat = format || 'csv';

    let attachmentContent: Buffer | string;
    let contentType = 'text/csv';
    let extension = 'csv';

    if (outputFormat === 'pdf') {
      attachmentContent = await buildPdf(report.title, report.headers, report.rows);
      contentType = 'application/pdf';
      extension = 'pdf';
    } else {
      attachmentContent = buildCsv(report.headers, report.rows);
    }

    const { html, text } = renderLafloEmail({
      preheader: `Your ${report.title} report is attached.`,
      title: `${report.title} report`,
      greeting: 'Hello,',
      intro: `Your ${report.title} report is attached.`,
      footerNote: 'Generated by LaFlo.',
    });

    await sendEmail({
      to: recipientEmail,
      subject: `${report.title} report`,
      html,
      text,
      attachments: [
        {
          filename: `${report.title.replace(/\s+/g, '-').toLowerCase()}.${extension}`,
          content: attachmentContent,
          contentType,
        },
      ],
    });

    res.json({ success: true, message: 'Report emailed' });
  } catch (error) {
    next(error);
  }
}

async function buildReport(type: string, hotelId: string, startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  switch (type) {
    case 'revenue': {
      const payments = await prisma.payment.findMany({
        where: {
          booking: { hotelId },
          status: 'COMPLETED',
          processedAt: { gte: startOfDay(start), lte: endOfDay(end) },
        },
        select: { amount: true, method: true, processedAt: true },
      });

      const rows = payments.map((payment) => [
        payment.processedAt.toISOString(),
        payment.method,
        Number(payment.amount).toFixed(2),
      ]);

      return {
        title: 'Revenue',
        headers: ['Date', 'Method', 'Amount'],
        rows,
      };
    }
    case 'occupancy': {
      const totalRooms = await prisma.room.count({ where: { hotelId, isActive: true } });
      const dates = getDateRange(start, end);
      const rows = await Promise.all(
        dates.map(async (date) => {
          const occupied = await prisma.booking.count({
            where: {
              hotelId,
              status: { in: ['CHECKED_IN', 'CHECKED_OUT'] },
              checkInDate: { lte: endOfDay(date) },
              checkOutDate: { gte: startOfDay(date) },
            },
          });
          const rate = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;
          return [date.toISOString().split('T')[0], occupied.toString(), totalRooms.toString(), `${rate}%`];
        })
      );
      return {
        title: 'Occupancy',
        headers: ['Date', 'Occupied', 'Total Rooms', 'Rate'],
        rows,
      };
    }
    case 'bookings': {
      const bookings = await prisma.booking.findMany({
        where: {
          hotelId,
          createdAt: { gte: start, lte: end },
        },
        include: { guest: true },
      });
      const rows = bookings.map((booking) => [
        booking.bookingRef,
        `${booking.guest.firstName} ${booking.guest.lastName}`,
        booking.status,
        booking.checkInDate.toISOString().split('T')[0],
        booking.checkOutDate.toISOString().split('T')[0],
      ]);
      return {
        title: 'Bookings',
        headers: ['Booking Ref', 'Guest', 'Status', 'Check-in', 'Check-out'],
        rows,
      };
    }
    case 'sources': {
      const sources = await prisma.booking.groupBy({
        by: ['source'],
        where: {
          hotelId,
          createdAt: { gte: start, lte: end },
        },
        _count: true,
        _sum: { totalAmount: true },
      });
      const rows = sources.map((source) => [
        source.source,
        source._count.toString(),
        Number(source._sum.totalAmount || 0).toFixed(2),
      ]);
      return {
        title: 'Booking Sources',
        headers: ['Source', 'Count', 'Revenue'],
        rows,
      };
    }
    case 'room-types': {
      const roomTypes = await prisma.roomType.findMany({
        where: { hotelId },
        include: { rooms: true },
      });
      const rows = roomTypes.map((roomType) => [
        roomType.name,
        roomType.rooms.length.toString(),
        Number(roomType.baseRate).toFixed(2),
      ]);
      return {
        title: 'Room Type Performance',
        headers: ['Room Type', 'Rooms', 'Base Rate'],
        rows,
      };
    }
    case 'guests': {
      const guests = await prisma.guest.findMany({
        where: { hotelId },
        orderBy: { totalSpent: 'desc' },
      });
      const rows = guests.map((guest) => [
        `${guest.firstName} ${guest.lastName}`,
        guest.email || '-',
        guest.totalStays.toString(),
        Number(guest.totalSpent).toFixed(2),
      ]);
      return {
        title: 'Guest Report',
        headers: ['Guest', 'Email', 'Total Stays', 'Total Spent'],
        rows,
      };
    }
    case 'summary': {
      const [revenue, bookings, guests] = await Promise.all([
        prisma.payment.aggregate({
          where: {
            booking: { hotelId },
            status: 'COMPLETED',
            processedAt: { gte: start, lte: end },
          },
          _sum: { amount: true },
        }),
        prisma.booking.count({
          where: { hotelId, createdAt: { gte: start, lte: end } },
        }),
        prisma.guest.count({
          where: { hotelId, createdAt: { gte: start, lte: end } },
        }),
      ]);
      const rows = [
        ['Revenue', Number(revenue._sum.amount || 0).toFixed(2)],
        ['Bookings', bookings.toString()],
        ['New Guests', guests.toString()],
      ];
      return {
        title: 'Summary',
        headers: ['Metric', 'Value'],
        rows,
      };
    }
    default:
      throw new Error('Unsupported report type');
  }
}

function buildCsv(headers: string[], rows: (string | number)[][]) {
  const headerRow = headers.join(',');
  const dataRows = rows.map((row) => row.map((value) => `"${value}"`).join(','));
  return [headerRow, ...dataRows].join('\n');
}

async function buildPdf(title: string, headers: string[], rows: (string | number)[][]) {
  const doc = new PDFDocument({ margin: 40 });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  doc.fontSize(18).text(title, { align: 'left' });
  doc.moveDown();

  doc.fontSize(10).text(headers.join(' | '));
  doc.moveDown(0.5);

  rows.forEach((row) => {
    doc.text(row.join(' | '));
  });

  doc.end();

  await new Promise<void>((resolve) => {
    doc.on('end', () => resolve());
  });

  return Buffer.concat(chunks);
}
