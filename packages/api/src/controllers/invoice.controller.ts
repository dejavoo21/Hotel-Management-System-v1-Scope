import { Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { prisma } from '../config/database.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { sendEmail } from '../services/email.service.js';
import { v4 as uuidv4 } from 'uuid';
import { renderLafloEmail } from '../utils/emailTemplates.js';

type LineItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function resolveInvoiceDetails(booking: any) {
  const nights = Math.max(
    1,
    Math.ceil(
      (booking.checkOutDate.getTime() - booking.checkInDate.getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
  const roomRate =
    safeNumber(booking.roomRate) || safeNumber(booking.room?.roomType?.baseRate);
  const roomLabel = booking.room
    ? `Room ${booking.room.number} - ${booking.room.roomType.name}`
    : undefined;
  const stayLabel = `${booking.checkInDate.toDateString()} - ${booking.checkOutDate.toDateString()}`;

  const lineItems: LineItem[] = [];

  if (roomRate > 0) {
    lineItems.push({
      name: `Room Charge (${nights} night${nights > 1 ? 's' : ''})`,
      quantity: nights,
      unitPrice: roomRate,
      total: roomRate * nights,
    });
  }

  const charges = Array.isArray(booking.charges) ? booking.charges : [];
  for (const charge of charges) {
    const quantity = Math.max(1, safeNumber(charge.quantity));
    const unitPrice = safeNumber(charge.unitPrice);
    const total = safeNumber(charge.amount);
    if (total <= 0 && unitPrice <= 0) {
      continue;
    }
    lineItems.push({
      name: charge.description || 'Charge',
      quantity,
      unitPrice,
      total,
    });
  }

  if (lineItems.length === 0) {
    lineItems.push({
      name: 'Booking details',
      quantity: 1,
      unitPrice: 0,
      total: 0,
    });
  }

  return {
    lineItems,
    roomLabel,
    stayLabel,
    nights,
    roomRate,
  };
}

function buildInvoicePdfBuffer(invoice: {
  invoiceNo: string;
  issuedAt: Date;
  subtotal: number;
  tax: number;
  total: number;
  hotelName: string;
  guestName: string;
  bookingRef: string;
  roomLabel?: string;
  stayLabel?: string;
  lineItems: { name: string; quantity: number; unitPrice: number; total: number }[];
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(invoice.hotelName, { align: 'left' });
    doc.fontSize(14).text('Invoice', { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#475569');
    doc.text(`Invoice: ${invoice.invoiceNo}`);
    doc.text(`Issued: ${invoice.issuedAt.toDateString()}`);
    doc.text(`Booking: ${invoice.bookingRef}`);
    doc.text(`Guest: ${invoice.guestName}`);
    if (invoice.roomLabel) {
      doc.text(`Room: ${invoice.roomLabel}`);
    }
    if (invoice.stayLabel) {
      doc.text(`Stay: ${invoice.stayLabel}`);
    }

    doc.moveDown(0.8);
    doc.fillColor('#0f172a').fontSize(11);
    doc.text('Item', 48, doc.y, { continued: true, width: 260 });
    doc.text('Qty', { continued: true, width: 60 });
    doc.text('Unit', { continued: true, width: 80 });
    doc.text('Total', { width: 80 });
    doc.moveDown(0.3);
    doc.moveTo(48, doc.y).lineTo(548, doc.y).strokeColor('#e2e8f0').stroke();
    doc.moveDown(0.3);

    invoice.lineItems.forEach((item) => {
      doc.fontSize(10).fillColor('#0f172a');
      doc.text(item.name, 48, doc.y, { continued: true, width: 260 });
      doc.text(item.quantity.toString(), { continued: true, width: 60 });
      doc.text(item.unitPrice.toFixed(2), { continued: true, width: 80 });
      doc.text(item.total.toFixed(2), { width: 80 });
    });

    doc.moveDown(0.8);
    doc.fontSize(11).fillColor('#0f172a');
    doc.text(`Subtotal: ${invoice.subtotal.toFixed(2)}`, { align: 'right' });
    doc.text(`Tax: ${invoice.tax.toFixed(2)}`, { align: 'right' });
    doc.fontSize(12).text(`Total: ${invoice.total.toFixed(2)}`, { align: 'right' });
    doc.end();
  });
}

export async function getAllInvoices(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { status, startDate, endDate, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = { hotelId };
    if (status) where.status = status;
    if (startDate || endDate) {
      where.issuedAt = {};
      if (startDate) (where.issuedAt as Record<string, Date>).gte = new Date(startDate as string);
      if (endDate) (where.issuedAt as Record<string, Date>).lte = new Date(endDate as string);
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          booking: {
            include: { guest: { select: { firstName: true, lastName: true } } },
          },
        },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { issuedAt: 'desc' },
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      success: true,
      data: invoices,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
        hasMore: parseInt(page as string) * parseInt(limit as string) < total,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getInvoiceById(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const invoice = await prisma.invoice.findFirst({
      where: { id, hotelId },
      include: {
        hotel: true,
        booking: {
          include: {
            guest: true,
            room: { include: { roomType: true } },
            charges: { where: { isVoided: false } },
            payments: true,
          },
        },
      },
    });

    if (!invoice) throw new NotFoundError('Invoice');
    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
}

export async function createInvoice(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { bookingId } = req.params;

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, hotelId },
      include: {
        charges: { where: { isVoided: false } },
        hotel: { select: { taxRate: true } },
      },
    });

    if (!booking) throw new NotFoundError('Booking');

    const subtotal = booking.charges.reduce((sum, c) => sum + Number(c.amount) * c.quantity, 0);
    const tax = subtotal * (Number(booking.hotel.taxRate) / 100);
    const total = subtotal + tax;

    const invoiceNo = `INV-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`;

    const invoice = await prisma.invoice.create({
      data: {
        hotelId,
        bookingId,
        invoiceNo,
        subtotal,
        tax,
        total,
      },
    });

    res.status(201).json({ success: true, data: invoice, message: 'Invoice created' });
  } catch (error) {
    next(error);
  }
}

export async function generatePdf(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const invoice = await prisma.invoice.findFirst({
      where: { id, hotelId },
      include: {
        hotel: true,
        booking: {
          include: {
            guest: true,
            room: { include: { roomType: true } },
            charges: { where: { isVoided: false } },
          },
        },
      },
    });

    if (!invoice) throw new NotFoundError('Invoice');

    const booking = invoice.booking;
    const details = resolveInvoiceDetails(booking);

    const pdfBuffer = await buildInvoicePdfBuffer({
      invoiceNo: invoice.invoiceNo,
      issuedAt: invoice.issuedAt,
      subtotal: safeNumber(invoice.subtotal),
      tax: safeNumber(invoice.tax),
      total: safeNumber(invoice.total),
      hotelName: invoice.hotel.name,
      guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
      bookingRef: booking.bookingRef,
      roomLabel: details.roomLabel,
      stayLabel: details.stayLabel,
      lineItems: details.lineItems,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNo}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}

export async function updateInvoiceStatus(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;
    const { status } = req.body;

    const invoice = await prisma.invoice.findFirst({ where: { id, hotelId } });
    if (!invoice) throw new NotFoundError('Invoice');

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status,
        ...(status === 'PAID' ? { paidAt: new Date() } : {}),
      },
    });

    res.json({ success: true, data: updated, message: 'Invoice status updated' });
  } catch (error) {
    next(error);
  }
}

export async function sendInvoiceEmail(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;
    const { recipientEmail } = req.body;

    const invoice = await prisma.invoice.findFirst({
      where: { id, hotelId },
      include: {
        hotel: true,
        booking: {
          include: {
            guest: true,
            room: { include: { roomType: true } },
            charges: { where: { isVoided: false } },
          },
        },
      },
    });

    if (!invoice) throw new NotFoundError('Invoice');

    const booking = invoice.booking;
    const recipient = recipientEmail || booking.guest.email;
    if (!recipient) {
      res.status(400).json({ success: false, error: 'Recipient email is required' });
      return;
    }

    const details = resolveInvoiceDetails(booking);
    const isReceipt = invoice.status === 'PAID';

    const pdfBuffer = await buildInvoicePdfBuffer({
      invoiceNo: invoice.invoiceNo,
      issuedAt: invoice.issuedAt,
      subtotal: safeNumber(invoice.subtotal),
      tax: safeNumber(invoice.tax),
      total: safeNumber(invoice.total),
      hotelName: invoice.hotel.name,
      guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
      bookingRef: booking.bookingRef,
      roomLabel: details.roomLabel,
      stayLabel: details.stayLabel,
      lineItems: details.lineItems,
    });

    const { html, text } = renderLafloEmail({
      preheader: isReceipt
        ? `Your receipt ${invoice.invoiceNo} is attached.`
        : `Your invoice ${invoice.invoiceNo} is attached.`,
      title: isReceipt ? `Receipt ${invoice.invoiceNo}` : `Invoice ${invoice.invoiceNo}`,
      greeting: `Hello ${booking.guest.firstName},`,
      intro: isReceipt
        ? `Attached is your receipt for booking ${booking.bookingRef}.`
        : `Attached is your invoice for booking ${booking.bookingRef}.`,
      meta: [
        { label: 'Booking', value: booking.bookingRef },
        { label: 'Invoice', value: invoice.invoiceNo },
        { label: 'Total', value: Number(invoice.total).toFixed(2) },
      ],
      footerNote: 'Thank you for staying with LaFlo.',
    });

    await sendEmail({
      to: recipient,
      subject: `${isReceipt ? 'Receipt' : 'Invoice'} ${invoice.invoiceNo}`,
      html,
      text,
      attachments: [
        {
          filename: `invoice-${invoice.invoiceNo}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    res.json({ success: true, message: 'Invoice email sent' });
  } catch (error) {
    next(error);
  }
}
