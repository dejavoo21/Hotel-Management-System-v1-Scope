import { Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { prisma } from '../config/database.js';
import { config } from '../config/index.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { sendEmail } from '../services/email.service.js';
import { logger } from '../config/logger.js';
import Stripe from 'stripe';
import { renderLafloEmail } from '../utils/emailTemplates.js';

const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null;

function buildReceiptPdfBuffer(receipt: {
  hotelName: string;
  bookingRef: string;
  guestName: string;
  roomLabel?: string;
  paymentId: string;
  amount: number;
  method: string;
  reference?: string | null;
  processedAt: Date;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(receipt.hotelName, { align: 'left' });
    doc.fontSize(14).text('Payment Receipt', { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#475569');
    doc.text(`Receipt ID: ${receipt.paymentId}`);
    doc.text(`Date: ${receipt.processedAt.toDateString()}`);
    doc.text(`Booking: ${receipt.bookingRef}`);
    doc.text(`Guest: ${receipt.guestName}`);
    if (receipt.roomLabel) {
      doc.text(`Room: ${receipt.roomLabel}`);
    }
    doc.moveDown(0.8);
    doc.fillColor('#0f172a').fontSize(11);
    doc.text('Amount', 48, doc.y, { continued: true, width: 160 });
    doc.text('Method', { continued: true, width: 160 });
    doc.text('Reference', { width: 160 });
    doc.moveDown(0.3);
    doc.moveTo(48, doc.y).lineTo(548, doc.y).strokeColor('#e2e8f0').stroke();
    doc.moveDown(0.3);

    doc.fontSize(10).fillColor('#0f172a');
    doc.text(receipt.amount.toFixed(2), 48, doc.y, { continued: true, width: 160 });
    doc.text(receipt.method.replace('_', ' '), { continued: true, width: 160 });
    doc.text(receipt.reference || '-', { width: 160 });

    doc.moveDown(0.8);
    doc.fontSize(12).text(`Paid: ${receipt.amount.toFixed(2)}`, { align: 'right' });
    doc.end();
  });
}

export async function getAllPayments(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { bookingId, method, status, startDate, endDate, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = { booking: { hotelId } };
    if (bookingId) where.bookingId = bookingId;
    if (method) where.method = method;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.processedAt = {};
      if (startDate) (where.processedAt as Record<string, Date>).gte = new Date(startDate as string);
      if (endDate) (where.processedAt as Record<string, Date>).lte = new Date(endDate as string);
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          booking: {
            select: {
              bookingRef: true,
              guest: { select: { firstName: true, lastName: true } },
            },
          },
        },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { processedAt: 'desc' },
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      success: true,
      data: payments,
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

export async function getPaymentById(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const payment = await prisma.payment.findFirst({
      where: { id, booking: { hotelId } },
      include: {
        booking: {
          include: {
            guest: true,
            room: { include: { roomType: true } },
          },
        },
      },
    });

    if (!payment) throw new NotFoundError('Payment');
    res.json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
}

export async function downloadReceiptPdf(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const payment = await prisma.payment.findFirst({
      where: { id, booking: { hotelId } },
      include: {
        booking: {
          include: {
            guest: true,
            room: { include: { roomType: true } },
            hotel: { select: { name: true } },
          },
        },
      },
    });

    if (!payment) throw new NotFoundError('Payment');

    const receiptBuffer = await buildReceiptPdfBuffer({
      hotelName: payment.booking.hotel.name,
      bookingRef: payment.booking.bookingRef,
      guestName: `${payment.booking.guest.firstName} ${payment.booking.guest.lastName}`,
      roomLabel: payment.booking.room
        ? `Room ${payment.booking.room.number} - ${payment.booking.room.roomType.name}`
        : undefined,
      paymentId: payment.id,
      amount: Number(payment.amount),
      method: payment.method,
      reference: payment.reference,
      processedAt: payment.processedAt || payment.createdAt,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${payment.id}.pdf"`);
    res.send(receiptBuffer);
  } catch (error) {
    next(error);
  }
}

export async function emailReceipt(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;
    const { recipientEmail } = req.body;

    const payment = await prisma.payment.findFirst({
      where: { id, booking: { hotelId } },
      include: {
        booking: {
          include: {
            guest: true,
            room: { include: { roomType: true } },
            hotel: { select: { name: true } },
          },
        },
      },
    });

    if (!payment) throw new NotFoundError('Payment');

    const recipient = recipientEmail || payment.booking.guest.email;
    if (!recipient) {
      res.status(400).json({ success: false, error: 'Recipient email is required' });
      return;
    }

    const receiptBuffer = await buildReceiptPdfBuffer({
      hotelName: payment.booking.hotel.name,
      bookingRef: payment.booking.bookingRef,
      guestName: `${payment.booking.guest.firstName} ${payment.booking.guest.lastName}`,
      roomLabel: payment.booking.room
        ? `Room ${payment.booking.room.number} - ${payment.booking.room.roomType.name}`
        : undefined,
      paymentId: payment.id,
      amount: Number(payment.amount),
      method: payment.method,
      reference: payment.reference,
      processedAt: payment.processedAt || payment.createdAt,
    });

    const { html, text } = renderLafloEmail({
      preheader: `Your payment receipt for booking ${payment.booking.bookingRef} is attached.`,
      title: 'Payment receipt',
      greeting: `Hello ${payment.booking.guest.firstName},`,
      intro: 'Attached is your payment receipt.',
      meta: [
        { label: 'Booking', value: payment.booking.bookingRef },
        { label: 'Payment ID', value: payment.id },
        { label: 'Amount', value: Number(payment.amount).toFixed(2) },
      ],
      footerNote: 'Thank you for staying with LaFlo.',
    });

    await sendEmail({
      to: recipient,
      subject: `Payment receipt for ${payment.booking.bookingRef}`,
      html,
      text,
      attachments: [
        {
          filename: `receipt-${payment.id}.pdf`,
          content: receiptBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    res.json({ success: true, message: 'Receipt emailed' });
  } catch (error) {
    next(error);
  }
}

export async function recordPayment(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const { bookingId, amount, method, reference, notes } = req.body;

    const booking = await prisma.booking.findFirst({ where: { id: bookingId, hotelId } });
    if (!booking) throw new NotFoundError('Booking');

    const payment = await prisma.payment.create({
      data: {
        bookingId,
        amount,
        method,
        reference,
        notes,
        status: 'COMPLETED',
      },
    });

    // Update booking paid amount
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        paidAmount: { increment: amount },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        bookingId,
        action: 'PAYMENT_RECORDED',
        entity: 'payment',
        entityId: payment.id,
        details: { amount, method },
      },
    });

    res.status(201).json({ success: true, data: payment, message: 'Payment recorded' });
  } catch (error) {
    next(error);
  }
}

export async function refundPayment(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const { id } = req.params;
    const { reason } = req.body;

    const payment = await prisma.payment.findFirst({
      where: { id, booking: { hotelId } },
    });

    if (!payment) throw new NotFoundError('Payment');
    if (payment.status !== 'COMPLETED') {
      throw new ValidationError('Can only refund completed payments');
    }

    // If Stripe payment, process refund through Stripe
    if (payment.stripePaymentId && stripe) {
      await stripe.refunds.create({
        payment_intent: payment.stripePaymentId,
      });
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: { status: 'REFUNDED', notes: `Refund reason: ${reason}` },
    });

    // Update booking paid amount
    await prisma.booking.update({
      where: { id: payment.bookingId },
      data: {
        paidAmount: { decrement: payment.amount },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId,
        bookingId: payment.bookingId,
        action: 'PAYMENT_REFUNDED',
        entity: 'payment',
        entityId: id,
        details: { amount: payment.amount, reason },
      },
    });

    res.json({ success: true, data: updated, message: 'Payment refunded' });
  } catch (error) {
    next(error);
  }
}

export async function createPaymentIntent(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    if (!stripe) {
      throw new ValidationError('Stripe is not configured');
    }

    const hotelId = req.user!.hotelId;
    const { bookingId, amount } = req.body;

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, hotelId },
      include: { guest: true, hotel: true },
    });

    if (!booking) throw new NotFoundError('Booking');

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: booking.hotel.currency.toLowerCase(),
      metadata: {
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        hotelId,
      },
      description: `Booking ${booking.bookingRef}`,
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function confirmPayment(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    if (!stripe) {
      throw new ValidationError('Stripe is not configured');
    }

    const { paymentIntentId } = req.params;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      const bookingId = paymentIntent.metadata.bookingId;
      const amount = paymentIntent.amount / 100;

      const payment = await prisma.payment.create({
        data: {
          bookingId,
          amount,
          method: 'STRIPE',
          stripePaymentId: paymentIntentId,
          status: 'COMPLETED',
        },
      });

      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          paidAmount: { increment: amount },
        },
      });

      res.json({ success: true, data: payment, message: 'Payment confirmed' });
    } else {
      res.json({
        success: false,
        error: `Payment status: ${paymentIntent.status}`,
      });
    }
  } catch (error) {
    next(error);
  }
}

export async function handleStripeWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!stripe) {
      res.status(400).json({ error: 'Stripe not configured' });
      return;
    }

    const sig = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        config.stripe.webhookSecret
      );
    } catch (err) {
      logger.error('Stripe webhook signature verification failed');
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logger.info(`Payment succeeded: ${paymentIntent.id}`);
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logger.warn(`Payment failed: ${paymentIntent.id}`);
        break;
      }
      default:
        logger.debug(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
}
