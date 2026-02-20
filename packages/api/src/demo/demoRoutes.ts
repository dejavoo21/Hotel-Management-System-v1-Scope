/**
 * Demo mode routes - serves mock data without database
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { sendEmail } from '../services/email.service.js';
import { sendSms } from '../services/sms.service.js';
import { renderLafloEmail, renderOtpEmail, escapeEmailText } from '../utils/emailTemplates.js';
import {
  mockUsers,
  mockHotel,
  mockRooms,
  mockRoomTypes,
  mockInventory,
  mockGuests,
  mockBookings,
  mockInvoices,
  mockFloors,
  mockPayments,
  getRoomWithType,
  getBookingWithRelations,
  getBookingCharges,
  getBookingInvoices,
  getUserWithHotel,
  mockConversations,
  getConversationSummary,
  getConversationDetail,
} from './mockData.js';

const router = Router();

// Store for demo session
let demoRefreshTokens: string[] = [];
let demoCalendarExtras: any[] = [];
let demoPurchaseOrders: any[] = [];
let demoFloors = [...mockFloors]; // Mutable copy for adding/removing floors

// Use Railway volume if available, otherwise use local data folder
const demoStorePath = process.env.NODE_ENV === 'production' 
  ? '/app/data/demo-store.json'
  : path.resolve(__dirname, '..', '..', 'data', 'demo-store.json');

const hydrateArray = <T>(target: T[], source?: T[]) => {
  if (!Array.isArray(source)) return;
  target.splice(0, target.length, ...source);
};

const loadDemoStore = () => {
  if (!fs.existsSync(demoStorePath)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(demoStorePath, 'utf-8')) as Record<string, any>;
    
    // Convert date strings back to Date objects
    if (Array.isArray(raw.mockBookings)) {
      raw.mockBookings.forEach((b: any) => {
        if (b.checkInDate) b.checkInDate = new Date(b.checkInDate);
        if (b.checkOutDate) b.checkOutDate = new Date(b.checkOutDate);
        if (b.createdAt) b.createdAt = new Date(b.createdAt);
        if (b.updatedAt) b.updatedAt = new Date(b.updatedAt);
      });
    }
    if (Array.isArray(raw.mockPayments)) {
      raw.mockPayments.forEach((p: any) => {
        if (p.createdAt) p.createdAt = new Date(p.createdAt);
        if (p.updatedAt) p.updatedAt = new Date(p.updatedAt);
      });
    }
    if (Array.isArray(raw.mockInvoices)) {
      raw.mockInvoices.forEach((i: any) => {
        if (i.issueDate) i.issueDate = new Date(i.issueDate);
        if (i.dueDate) i.dueDate = new Date(i.dueDate);
        if (i.createdAt) i.createdAt = new Date(i.createdAt);
        if (i.updatedAt) i.updatedAt = new Date(i.updatedAt);
      });
    }
    if (Array.isArray(raw.mockGuests)) {
      raw.mockGuests.forEach((g: any) => {
        if (g.createdAt) g.createdAt = new Date(g.createdAt);
        if (g.updatedAt) g.updatedAt = new Date(g.updatedAt);
      });
    }
    if (Array.isArray(raw.demoCalendarExtras)) {
      raw.demoCalendarExtras.forEach((e: any) => {
        if (e.startAt) e.startAt = new Date(e.startAt);
        if (e.endAt) e.endAt = new Date(e.endAt);
      });
    }
    
    // Convert user date strings back to Date objects
    if (Array.isArray(raw.mockUsers)) {
      raw.mockUsers.forEach((u: any) => {
        if (u.createdAt) u.createdAt = new Date(u.createdAt);
        if (u.updatedAt) u.updatedAt = new Date(u.updatedAt);
        if (u.lastLoginAt) u.lastLoginAt = new Date(u.lastLoginAt);
      });
    }

    hydrateArray(mockUsers, raw.mockUsers);
    hydrateArray(mockGuests, raw.mockGuests);
    hydrateArray(mockBookings, raw.mockBookings);
    hydrateArray(mockPayments, raw.mockPayments);
    hydrateArray(mockInvoices, raw.mockInvoices);
    hydrateArray(mockRooms, raw.mockRooms);
    if (Array.isArray(raw.demoFloors)) demoFloors = raw.demoFloors;
    if (Array.isArray(raw.demoCalendarExtras)) demoCalendarExtras = raw.demoCalendarExtras;
    if (Array.isArray(raw.demoPurchaseOrders)) demoPurchaseOrders = raw.demoPurchaseOrders;
    if (Array.isArray(raw.mockAccessRequests)) hydrateArray(mockAccessRequests, raw.mockAccessRequests);
    if (Array.isArray(raw.mockAccessRequestReplies)) hydrateArray(mockAccessRequestReplies, raw.mockAccessRequestReplies);
    console.log('[DEMO STORE] Loaded persisted data - Users:', mockUsers.length, 'Access Requests:', mockAccessRequests.length);
  } catch (error) {
    console.error('[DEMO STORE] Failed to load demo data:', (error as Error).message);
  }
};

const saveDemoStore = () => {
  try {
    fs.mkdirSync(path.dirname(demoStorePath), { recursive: true });
    const payload = {
      mockUsers,
      mockGuests,
      mockBookings,
      mockPayments,
      mockInvoices,
      mockRooms,
      demoFloors,
      demoCalendarExtras,
      demoPurchaseOrders,
      mockAccessRequests,
      mockAccessRequestReplies,
    };
    fs.writeFileSync(demoStorePath, JSON.stringify(payload, null, 2));
    console.log('[DEMO STORE] Saved data - Users:', mockUsers.length, 'Access Requests:', mockAccessRequests.length);
  } catch (error) {
    console.error('[DEMO STORE] Failed to save demo data:', (error as Error).message);
  }
};

// NOTE: loadDemoStore() is called after mockAccessRequests is defined below

function findMockPayment(paymentId: string) {
  return mockPayments.find((payment) => payment.id === paymentId);
}

function updateInvoiceStatusFromPayments(invoice: typeof mockInvoices[0]) {
  const paidTotal = mockPayments
    .filter((payment) => payment.bookingId === invoice.bookingId)
    .reduce((sum, payment) => sum + (payment.amount || 0), 0);

  if (paidTotal >= invoice.total) {
    invoice.status = 'PAID';
    invoice.updatedAt = new Date();
  }
}

function toCalendarDate(dateString: string): string {
  if (!dateString) return new Date().toISOString();
  try {
    return new Date(dateString).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function buildBookingCalendarEvents() {
  return mockBookings.map((booking) => {
    // Map booking status to calendar status
    let calendarStatus = 'SCHEDULED';
    if (booking.status === 'CHECKED_IN') {
      calendarStatus = 'CHECKED_IN';
    } else if (booking.status === 'CONFIRMED') {
      calendarStatus = 'CONFIRMED';
    } else if (booking.status === 'CHECKED_OUT') {
      calendarStatus = 'COMPLETED';
    } else if (booking.status === 'CANCELLED') {
      calendarStatus = 'CANCELLED';
    }

    return {
      id: `cal-${booking.id}`,
      title: `${booking.bookingRef} - Room ${booking.room?.number || 'TBD'}`,
      type: 'BOOKING',
      status: calendarStatus,
      startAt: booking.checkInDate,
      endAt: booking.checkOutDate,
      room: booking.room || null,
      booking: { id: booking.id, bookingRef: booking.bookingRef },
      notes: null,
    };
  });
}

function buildDemoReceiptPdf(
  payment: typeof mockPayments[0],
  booking: typeof mockBookings[0]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 45 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const guest = mockGuests.find((g) => g.id === booking.guestId);
    const processedAt = new Date(payment.processedAt);
    const hotelName = mockHotel.name.replace(' Demo', '');
    const formatMoney = (value: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

    doc.fontSize(28).font('Helvetica-Bold').fillColor('#1e293b').text(hotelName, 45, 44);
    doc.fontSize(13).font('Helvetica').fillColor('#64748b').text('PAYMENT RECEIPT', 45, 76);
    doc.moveTo(45, 98).lineTo(555, 98).lineWidth(2).strokeColor('#3b82f6').stroke();

    doc.font('Helvetica').fontSize(9).fillColor('#94a3b8');
    doc.text('RECEIPT #', 45, 114);
    doc.text('DATE', 300, 114);
    doc.text('STATUS', 440, 114);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a');
    doc.text(payment.id, 45, 128, { width: 240 });
    doc.text(processedAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), 300, 128, { width: 130 });
    doc.fillColor('#059669').text('COMPLETED', 440, 128);

    doc.moveTo(45, 160).lineTo(555, 160).lineWidth(1).strokeColor('#e2e8f0').stroke();

    let y = 178;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b').text('GUEST', 45, y);
    doc.font('Helvetica').fontSize(11).fillColor('#0f172a');
    doc.text(guest ? `${guest.firstName} ${guest.lastName}` : 'Guest', 45, y + 18);
    if (guest?.email) doc.text(`Email: ${guest.email}`, 45, y + 35);
    if (guest?.phone) doc.text(`Phone: ${guest.phone}`, 45, y + 52);

    y += 84;
    doc.moveTo(45, y).lineTo(555, y).lineWidth(1).strokeColor('#e2e8f0').stroke();
    y += 18;

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b').text('BOOKING', 45, y);
    doc.font('Helvetica').fontSize(11).fillColor('#0f172a');
    doc.text(`Check-in: ${new Date(booking.checkInDate).toLocaleDateString()}`, 45, y + 18);
    doc.text(`Check-out: ${new Date(booking.checkOutDate).toLocaleDateString()}`, 45, y + 35);
    if (booking.room) doc.text(`Room: ${booking.room.number} - ${booking.room.roomType.name}`, 45, y + 52);

    y += 84;
    doc.moveTo(45, y).lineTo(555, y).lineWidth(1).strokeColor('#e2e8f0').stroke();
    y += 18;

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b').text('PAYMENT DETAILS', 45, y);
    y += 16;

    doc.rect(45, y, 510, 30).fill('#f1f5f9');
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1f2937');
    doc.text('Description', 60, y + 10);
    doc.text('Qty', 290, y + 10, { width: 40, align: 'center' });
    doc.text('Unit Price', 370, y + 10, { width: 90, align: 'right' });
    doc.text('Amount', 480, y + 10, { width: 65, align: 'right' });
    y += 30;

    doc.rect(45, y, 510, 36).fillAndStroke('#ffffff', '#e2e8f0');
    doc.font('Helvetica').fontSize(11).fillColor('#0f172a');
    doc.text('Payment Received', 60, y + 12);
    doc.text('1', 290, y + 12, { width: 40, align: 'center' });
    doc.text(formatMoney(payment.amount), 370, y + 12, { width: 90, align: 'right' });
    doc.text(formatMoney(payment.amount), 480, y + 12, { width: 65, align: 'right' });

    y += 64;
    doc.moveTo(45, y).lineTo(555, y).lineWidth(1).strokeColor('#e2e8f0').stroke();
    y += 14;
    doc.font('Helvetica').fontSize(11).fillColor('#64748b');
    doc.text('Subtotal', 400, y, { width: 80, align: 'right' });
    doc.text(formatMoney(payment.amount), 480, y, { width: 65, align: 'right' });
    y += 24;
    doc.text('Tax', 400, y, { width: 80, align: 'right' });
    doc.text(formatMoney(0), 480, y, { width: 65, align: 'right' });
    y += 30;
    doc.moveTo(370, y).lineTo(555, y).lineWidth(2).strokeColor('#0f172a').stroke();
    y += 10;
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#1e293b');
    doc.text('TOTAL', 400, y, { width: 80, align: 'right' });
    doc.text(formatMoney(payment.amount), 480, y, { width: 65, align: 'right' });
    
    doc.end();
  });
}

function buildDemoInvoicePdf(
  invoice: typeof mockInvoices[0],
  booking: typeof mockBookings[0]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 45 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const guest = mockGuests.find((g) => g.id === booking.guestId);
    const charges = getBookingCharges(booking);
    const hotelName = mockHotel.name.replace(' Demo', '');
    const formatMoney = (value: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

    doc.fontSize(28).font('Helvetica-Bold').fillColor('#1e293b').text(hotelName, 45, 44);
    doc.fontSize(13).font('Helvetica').fillColor('#64748b').text('INVOICE', 45, 76);
    doc.moveTo(45, 98).lineTo(555, 98).lineWidth(2).strokeColor('#3b82f6').stroke();

    doc.font('Helvetica').fontSize(9).fillColor('#94a3b8');
    doc.text('INVOICE #', 45, 114);
    doc.text('ISSUED', 300, 114);
    doc.text('BOOKING', 440, 114);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a');
    doc.text(invoice.invoiceNo, 45, 128, { width: 240 });
    doc.text(
      new Date(invoice.issuedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      300,
      128,
      { width: 130 }
    );
    doc.text(booking.bookingRef, 440, 128);

    doc.moveTo(45, 160).lineTo(555, 160).lineWidth(1).strokeColor('#e2e8f0').stroke();

    let y = 178;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b').text('GUEST', 45, y);
    doc.font('Helvetica').fontSize(11).fillColor('#0f172a');
    doc.text(guest ? `${guest.firstName} ${guest.lastName}` : 'Guest', 45, y + 18);
    if (guest?.email) doc.text(`Email: ${guest.email}`, 45, y + 35);
    if (booking.room) doc.text(`Room: ${booking.room.number} - ${booking.room.roomType.name}`, 45, y + 52);

    y += 84;
    doc.moveTo(45, y).lineTo(555, y).lineWidth(1).strokeColor('#e2e8f0').stroke();
    y += 18;

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b').text('CHARGES', 45, y);
    y += 16;

    doc.rect(45, y, 510, 30).fill('#f1f5f9');
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1f2937');
    doc.text('Description', 60, y + 10);
    doc.text('Qty', 290, y + 10, { width: 40, align: 'center' });
    doc.text('Unit Price', 370, y + 10, { width: 90, align: 'right' });
    doc.text('Amount', 480, y + 10, { width: 65, align: 'right' });
    y += 30;

    charges.forEach((charge) => {
      const qty = charge.quantity || 1;
      const amount = charge.amount || 0;
      const unitPrice = qty > 0 ? amount / qty : amount;
      doc.rect(45, y, 510, 30).fillAndStroke('#ffffff', '#e2e8f0');
      doc.font('Helvetica').fontSize(10).fillColor('#0f172a');
      doc.text(charge.description || 'Charge', 60, y + 9, { width: 215, ellipsis: true });
      doc.text(String(qty), 290, y + 9, { width: 40, align: 'center' });
      doc.text(formatMoney(unitPrice), 370, y + 9, { width: 90, align: 'right' });
      doc.text(formatMoney(amount), 480, y + 9, { width: 65, align: 'right' });
      y += 30;
    });

    y += 16;
    doc.moveTo(45, y).lineTo(555, y).lineWidth(1).strokeColor('#e2e8f0').stroke();
    y += 14;
    doc.font('Helvetica').fontSize(11).fillColor('#64748b');
    doc.text('Subtotal', 400, y, { width: 80, align: 'right' });
    doc.text(formatMoney(invoice.subtotal), 480, y, { width: 65, align: 'right' });
    y += 24;
    doc.text('Tax', 400, y, { width: 80, align: 'right' });
    doc.text(formatMoney(invoice.tax), 480, y, { width: 65, align: 'right' });
    y += 30;
    doc.moveTo(370, y).lineTo(555, y).lineWidth(2).strokeColor('#0f172a').stroke();
    y += 10;
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#1e293b');
    doc.text('TOTAL', 400, y, { width: 80, align: 'right' });
    doc.text(formatMoney(invoice.total), 480, y, { width: 65, align: 'right' });

    doc.end();
  });
}

function formatPoReference() {
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `PO-${random}`;
}

function buildCsv(order: any) {
  const header = ['Item', 'Unit', 'Quantity', 'Unit Cost', 'Total'];
  const lines = order.items.map((item: any) => {
    const total = (item.quantity || 0) * (item.unitCost || 0);
    return [item.name, item.unit, item.quantity, item.unitCost, total].join(',');
  });
  return [header.join(','), ...lines].join('\n');
}

function buildPdfBuffer(order: any) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      resolve(pdfBuffer);
    });
    doc.on('error', reject);

    // Header
    doc.fontSize(20).text(mockHotel.name, { align: 'center' });
    doc.fontSize(16).text('PURCHASE ORDER', { align: 'center' });
    doc.moveDown();

    // Order details
    doc.fontSize(10);
    doc.text(`PO Reference: ${order.reference}`);
    doc.text(`Order Date: ${new Date(order.createdAt).toLocaleDateString()}`);
    doc.text(`Status: ${order.status}`);
    doc.moveDown();

    // Vendor information
    doc.fontSize(12).text('Vendor Information', { underline: true });
    doc.fontSize(10);
    doc.text(`Vendor: ${order.vendorName}`);
    doc.text(`Contact: ${order.vendorContact || 'N/A'}`);
    doc.moveDown();

    // Items table
    doc.fontSize(12).text('Items', { underline: true });
    doc.fontSize(10);

    const tableTop = doc.y;
    const itemX = 50;
    const unitX = 280;
    const qtyX = 350;
    const costX = 420;
    const totalX = 500;

    // Table header
    doc.text('Item', itemX, tableTop);
    doc.text('Unit', unitX, tableTop);
    doc.text('Qty', qtyX, tableTop);
    doc.text('Unit Cost', costX, tableTop);
    doc.text('Total', totalX, tableTop);
    doc.moveDown();

    // Line separator
    const y = doc.y;
    doc.strokeColor('#000').lineWidth(0.5);
    doc.moveTo(50, y).lineTo(550, y).stroke();
    doc.moveDown(0.5);

    // Table rows
    let subtotal = 0;
    order.items.forEach((item: any) => {
      const itemTotal = (item.quantity || 0) * (item.unitCost || 0);
      subtotal += itemTotal;
      const rowY = doc.y;
      doc.text(item.name.substring(0, 25), itemX, rowY, { width: 220 });
      doc.text(item.unit || 'unit', unitX, rowY);
      doc.text((item.quantity || 0).toString(), qtyX, rowY);
      doc.text(`$${(item.unitCost || 0).toFixed(2)}`, costX, rowY);
      doc.text(`$${itemTotal.toFixed(2)}`, totalX, rowY, { align: 'right' });
      doc.moveDown();
    });

    doc.moveDown();

    // Totals
    const tax = subtotal * 0.1;
    const total = subtotal + tax;
    
    doc.fontSize(10);
    doc.text(`Subtotal: $${subtotal.toFixed(2)}`, { align: 'right' });
    doc.text(`Tax (10%): $${tax.toFixed(2)}`, { align: 'right' });
    doc.fontSize(12).text(`TOTAL: $${total.toFixed(2)}`, { align: 'right' });

    doc.moveDown(2);
    doc.fontSize(10).text(`Generated by ${mockHotel.name}`, { align: 'center' });

    doc.end();
  });
}

const DEMO_TAX_RATE = 10;

function buildInvoiceFromBooking(booking: typeof mockBookings[0]) {
  const charges = getBookingCharges(booking);
  const subtotal = charges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
  const tax = subtotal * (DEMO_TAX_RATE / 100);
  const total = subtotal + tax;
  const invoiceNo = `INV-${Date.now()}-${Math.floor(Math.random() * 8999 + 1000)}`;
  return {
    id: `invoice-${Date.now()}-${Math.floor(Math.random() * 8999 + 1000)}`,
    hotelId: booking.hotelId,
    bookingId: booking.id,
    invoiceNo,
    subtotal,
    tax,
    total,
    issuedAt: new Date(),
    status: 'PENDING' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const mockAccessRequests = [
  {
    id: 'access-1',
    fullName: 'Emily Johnson',
    email: 'emily.johnson@demo.hotel',
    company: 'Grand Hotel Demo',
    role: 'General Manager',
    message: 'Need access for special events tracker',
    adminNotes: 'VIP request',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'access-2',
    fullName: 'Lena Parker',
    email: 'lena.parker@demo.hotel',
    company: 'Concierge Agency',
    role: 'Concierge',
    message: 'Requires temporary concierge permissions',
    adminNotes: 'Requires approval from manager',
    status: 'INFO_RECEIVED',
    createdAt: new Date().toISOString(),
  },
];

const mockAccessRequestReplies = [
  {
    id: 'reply-1',
    accessRequestId: 'access-2',
    fromEmail: 'admin@demo.hotel',
    subject: 'More info',
    bodyText: 'Please provide your staff ID and confirmation of training.',
    bodyHtml: null,
    attachments: null,
    receivedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
];

// Load persisted demo data now that all arrays are defined
loadDemoStore();

// Auth Routes
router.post('/auth/login', async (req: Request, res: Response) => {
  const { email, password, twoFactorCode } = req.body;

  console.log('Login attempt:', { email, password: password ? '***' : 'missing' });
  console.log('Available users:', mockUsers.map(u => u.email));

  const user = mockUsers.find(u => u.email.toLowerCase() === email?.toLowerCase());
  if (!user) {
    console.log('User not found for email:', email);
    return res.status(401).json({ success: false, error: 'Invalid email or password' });
  }

  console.log('Found user:', user.email, 'Hash:', user.passwordHash.substring(0, 20) + '...');

  // Check password (Demo123!)
  const validPassword = await bcrypt.compare(password, user.passwordHash);
  console.log('Password valid:', validPassword);

  if (!validPassword) {
    return res.status(401).json({ success: false, error: 'Invalid email or password' });
  }

  // Check if 2FA is enabled
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    if (!twoFactorCode) {
      // Return special response indicating 2FA is required
      return res.status(200).json({
        success: false,
        requiresTwoFactor: true,
        message: 'Two-factor authentication code required'
      });
    }

    // Verify the 2FA code
    const timeStep = Math.floor(Date.now() / 30000);
    let hash = 0;
    const combined = user.twoFactorSecret + timeStep.toString();
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const expectedCode = Math.abs(hash % 1000000).toString().padStart(6, '0');

    if (twoFactorCode !== expectedCode) {
      return res.status(401).json({ success: false, error: 'Invalid two-factor authentication code' });
    }
  }

  // Generate tokens
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, hotelId: user.hotelId },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );

  demoRefreshTokens.push(refreshToken);

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        hotelId: user.hotelId,
        hotel: mockHotel,
      },
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
    },
  });
});

router.get('/auth/me', authenticateDemo, (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({ success: true, data: getUserWithHotel(user) });
});

router.post('/auth/logout', (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  demoRefreshTokens = demoRefreshTokens.filter(t => t !== refreshToken);
  res.json({ success: true, message: 'Logged out successfully' });
});

router.post('/auth/refresh', (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken || !demoRefreshTokens.includes(refreshToken)) {
    return res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }

  try {
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as any;
    const user = mockUsers.find(u => u.id === decoded.userId);

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    const newAccessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, hotelId: user.hotelId },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    const newRefreshToken = jwt.sign(
      { userId: user.id },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );

    demoRefreshTokens = demoRefreshTokens.filter(t => t !== refreshToken);
    demoRefreshTokens.push(newRefreshToken);

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: config.jwt.expiresIn,
      },
    });
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
});

// OTP Store for demo
const demoOtpStore: Map<string, { code: string; expiresAt: Date; userId?: string }> = new Map();
const demoResetTokenStore: Map<string, { userId: string; expiresAt: Date }> = new Map();

// Email OTP Login - Request OTP
router.post('/auth/otp/request', async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  const user = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    // For security, don't reveal if user exists
    return res.json({ success: true, message: 'If an account exists, a verification code has been sent' });
  }

  // Generate 6-digit OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  demoOtpStore.set(email.toLowerCase(), { code: otpCode, expiresAt, userId: user.id });

  // Send OTP email
  try {
    const { html, text } = renderOtpEmail({
      firstName: user.firstName || 'User',
      code: otpCode,
    });
    await sendEmail({
      to: email,
      subject: 'Your LaFlo verification code',
      html,
      text,
    });
  } catch (err) {
    console.error('Failed to send OTP email:', err);
  }

  console.log(`[Demo OTP] Code for ${email}: ${otpCode}`);

  res.json({ success: true, message: 'If an account exists, a verification code has been sent' });
});

// Email OTP Login - Verify OTP
router.post('/auth/otp/verify', async (req: Request, res: Response) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ success: false, error: 'Email and code are required' });
  }

  const storedOtp = demoOtpStore.get(email.toLowerCase());

  if (!storedOtp) {
    return res.status(401).json({ success: false, error: 'No verification code found. Please request a new one.' });
  }

  if (new Date() > storedOtp.expiresAt) {
    demoOtpStore.delete(email.toLowerCase());
    return res.status(401).json({ success: false, error: 'Verification code expired. Please request a new one.' });
  }

  if (storedOtp.code !== code) {
    return res.status(401).json({ success: false, error: 'Invalid verification code' });
  }

  // OTP is valid - log the user in
  const user = mockUsers.find(u => u.id === storedOtp.userId);
  if (!user) {
    return res.status(401).json({ success: false, error: 'User not found' });
  }

  // Clear used OTP
  demoOtpStore.delete(email.toLowerCase());

  // Generate tokens
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, hotelId: user.hotelId },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );

  demoRefreshTokens.push(refreshToken);

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        hotelId: user.hotelId,
        hotel: mockHotel,
      },
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
    },
  });
});

// Forgot Password - Request Reset
router.post('/auth/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  const user = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  // Always return success for security (don't reveal if user exists)
  if (!user) {
    return res.json({ success: true, message: 'If an account exists, a password reset link has been sent' });
  }

  // Generate reset token
  const resetToken = jwt.sign(
    { userId: user.id, type: 'password-reset' },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  demoResetTokenStore.set(resetToken, { userId: user.id, expiresAt });

  // Build reset URL
  const resetUrl = `${config.appUrl || 'https://laflo-web-production.up.railway.app'}/reset-password?token=${resetToken}`;

  // Send reset email
  try {
    const resetEmail = renderLafloEmail({
      preheader: 'Use this link to reset your password (expires in 60 minutes).',
      title: 'Reset your password',
      greeting: `Hello ${user.firstName || 'User'},`,
      intro: 'Use the button below to reset your password. This link expires in 60 minutes.',
      cta: { label: 'Reset password', url: resetUrl },
      footerNote: 'If you did not request a password reset, you can ignore this email.',
    });
    await sendEmail({
      to: email,
      subject: 'Reset your LaFlo password',
      html: resetEmail.html,
      text: resetEmail.text,
    });
  } catch (err) {
    console.error('Failed to send password reset email:', err);
  }

  console.log(`[Demo Reset] Token for ${email}: ${resetToken}`);

  res.json({ success: true, message: 'If an account exists, a password reset link has been sent' });
});

// Reset Password - Verify Token and Set New Password
router.post('/auth/reset-password', async (req: Request, res: Response) => {
  const { token, password } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, error: 'Reset token is missing' });
  }

  if (!password) {
    return res.status(400).json({ success: false, error: 'New password is required' });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    
    if (decoded.type !== 'password-reset') {
      return res.status(401).json({ success: false, error: 'Invalid reset token' });
    }

    const storedReset = demoResetTokenStore.get(token);
    if (!storedReset || new Date() > storedReset.expiresAt) {
      demoResetTokenStore.delete(token);
      return res.status(401).json({ success: false, error: 'Reset token has expired. Please request a new one.' });
    }

    const user = mockUsers.find(u => u.id === decoded.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Update password
    const newPasswordHash = await bcrypt.hash(password, 10);
    user.passwordHash = newPasswordHash;

    // Clear used token
    demoResetTokenStore.delete(token);

    // Save updated user
    saveDemoStore();

    res.json({ success: true, message: 'Password has been reset successfully. You can now sign in.' });
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired reset token' });
  }
});

// 2FA Store for demo (stores pending 2FA secrets before verification)
const demo2FASecretStore: Map<string, string> = new Map();

// Helper to generate TOTP code (simplified for demo - in production use a proper library like speakeasy)
function generateTOTPCode(secret: string): string {
  const timeStep = Math.floor(Date.now() / 30000);
  // Simple hash for demo - creates a consistent 6-digit code based on secret and time
  let hash = 0;
  const combined = secret + timeStep.toString();
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash % 1000000).toString().padStart(6, '0');
}

// Generate a random base32 secret for demo
function generateBase32Secret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < 16; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

// 2FA Setup - Generate QR code and secret
router.post('/auth/2fa/setup', authenticateDemo, (req: Request, res: Response) => {
  const authUser = (req as any).user;
  const userId = authUser?.id as string | undefined;
  const user = mockUsers.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  if (user.twoFactorEnabled) {
    return res.status(400).json({ success: false, error: '2FA is already enabled for this account' });
  }

  // Generate a new secret
  const secret = generateBase32Secret();
  demo2FASecretStore.set(userId, secret);

  // Generate otpauth URL for QR code
  const issuer = 'Laflo';
  const accountName = encodeURIComponent(user.email);
  const otpauthUrl = `otpauth://totp/${issuer}:${accountName}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

  // For demo, also return the current code so user can test without a real authenticator app
  const currentCode = generateTOTPCode(secret);

  res.json({
    success: true,
    data: {
      secret,
      otpauthUrl,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`,
      // Demo only: provide a valid code for testing
      demoCode: currentCode,
      message: 'Scan the QR code with your authenticator app, or use the demo code provided'
    }
  });
});

// 2FA Verify - Confirm setup with a code
router.post('/auth/2fa/verify', authenticateDemo, (req: Request, res: Response) => {
  const authUser = (req as any).user;
  const userId = authUser?.id as string | undefined;
  const { code } = req.body;

  if (!code || typeof code !== 'string' || code.length !== 6) {
    return res.status(400).json({ success: false, error: 'A valid 6-digit code is required' });
  }

  const user = mockUsers.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  // Get the pending secret
  const pendingSecret = demo2FASecretStore.get(userId);
  if (!pendingSecret) {
    return res.status(400).json({ success: false, error: 'No 2FA setup in progress. Please start setup first.' });
  }

  // Verify the code
  const expectedCode = generateTOTPCode(pendingSecret);
  if (code !== expectedCode) {
    return res.status(400).json({ success: false, error: 'Invalid verification code. Please try again.' });
  }

  // Enable 2FA for the user
  user.twoFactorEnabled = true;
  user.twoFactorSecret = pendingSecret;
  demo2FASecretStore.delete(userId);

  // Save to persistent store
  saveDemoStore();

  res.json({
    success: true,
    message: '2FA has been enabled successfully. You will need to enter a code on your next login.'
  });
});

// 2FA Disable - Turn off 2FA with verification
router.post('/auth/2fa/disable', authenticateDemo, (req: Request, res: Response) => {
  const authUser = (req as any).user;
  const userId = authUser?.id as string | undefined;
  const { code } = req.body;

  if (!code || typeof code !== 'string' || code.length !== 6) {
    return res.status(400).json({ success: false, error: 'A valid 6-digit code is required' });
  }

  const user = mockUsers.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    return res.status(400).json({ success: false, error: '2FA is not enabled for this account' });
  }

  // Verify the code
  const expectedCode = generateTOTPCode(user.twoFactorSecret);
  if (code !== expectedCode) {
    return res.status(400).json({ success: false, error: 'Invalid verification code. Please try again.' });
  }

  // Disable 2FA
  user.twoFactorEnabled = false;
  user.twoFactorSecret = null;

  // Save to persistent store
  saveDemoStore();

  res.json({
    success: true,
    message: '2FA has been disabled successfully.'
  });
});

// 2FA Status - Check if 2FA is enabled for current user
router.get('/auth/2fa/status', authenticateDemo, (req: Request, res: Response) => {
  const authUser = (req as any).user;
  const userId = authUser?.id as string | undefined;
  const user = mockUsers.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  res.json({
    success: true,
    data: {
      enabled: user.twoFactorEnabled || false,
      setupPending: demo2FASecretStore.has(userId)
    }
  });
});

// Dashboard Routes
router.get('/dashboard/summary', authenticateDemo, (req: Request, res: Response) => {
  const totalRooms = mockRooms.length;
  const occupiedRooms = mockRooms.filter(r => r.status === 'OCCUPIED').length;
  const availableRooms = mockRooms.filter(r => r.status === 'AVAILABLE').length;
  const outOfService = mockRooms.filter(r => r.status === 'OUT_OF_SERVICE').length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayArrivals = mockBookings.filter(b => {
    const checkIn = new Date(b.checkInDate);
    checkIn.setHours(0, 0, 0, 0);
    return checkIn.getTime() === today.getTime() && b.status === 'CONFIRMED';
  });

  const todayDepartures = mockBookings.filter(b => {
    const checkOut = new Date(b.checkOutDate);
    checkOut.setHours(0, 0, 0, 0);
    return checkOut.getTime() === today.getTime() && b.status === 'CHECKED_IN';
  });

  const inHouseGuests = mockBookings.filter(b => b.status === 'CHECKED_IN').reduce((sum, b) => sum + b.numberOfGuests, 0);
  const todayRevenue = mockBookings
    .filter(b => b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT')
    .reduce((sum, b) => sum + b.paidAmount, 0);

  res.json({
    success: true,
    data: {
      todayArrivals: todayArrivals.length,
      todayDepartures: todayDepartures.length,
      currentOccupancy: Math.round((occupiedRooms / (totalRooms - outOfService)) * 100),
      totalRooms,
      occupiedRooms,
      availableRooms,
      outOfServiceRooms: outOfService,
      inHouseGuests,
      todayRevenue,
      monthRevenue: 12450.00,
    },
  });
});

router.get('/dashboard/arrivals', authenticateDemo, (req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const arrivals = mockBookings.filter(b => {
    const checkIn = new Date(b.checkInDate);
    checkIn.setHours(0, 0, 0, 0);
    return (checkIn.getTime() === today.getTime() || checkIn.getTime() === tomorrow.getTime()) &&
           (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN');
  }).map(booking => {
    const guest = mockGuests.find(g => g.id === booking.guestId);
    const room = mockRooms.find(r => r.id === booking.roomId);
    const roomType = room ? mockRoomTypes.find(rt => rt.id === room.roomTypeId) : null;
    return {
      id: booking.id,
      time: '14:00',
      guestName: guest ? `${guest.firstName} ${guest.lastName}` : 'Unknown Guest',
      roomType: roomType?.name || 'Standard Room',
      roomNumber: room?.number,
      status: booking.status,
      bookingRef: booking.bookingRef,
    };
  });

  res.json({ success: true, data: arrivals });
});

router.get('/dashboard/departures', authenticateDemo, (req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const departures = mockBookings.filter(b => {
    const checkOut = new Date(b.checkOutDate);
    checkOut.setHours(0, 0, 0, 0);
    return (checkOut.getTime() === today.getTime() || checkOut.getTime() === tomorrow.getTime()) &&
           b.status === 'CHECKED_IN';
  }).map(booking => {
    const guest = mockGuests.find(g => g.id === booking.guestId);
    const room = mockRooms.find(r => r.id === booking.roomId);
    const roomType = room ? mockRoomTypes.find(rt => rt.id === room.roomTypeId) : null;
    return {
      id: booking.id,
      time: '11:00',
      guestName: guest ? `${guest.firstName} ${guest.lastName}` : 'Unknown Guest',
      roomType: roomType?.name || 'Standard Room',
      roomNumber: room?.number || 'N/A',
      status: booking.status,
      balanceDue: booking.totalAmount - booking.paidAmount,
    };
  });

  res.json({ success: true, data: departures });
});

router.get('/dashboard/housekeeping-summary', authenticateDemo, (req: Request, res: Response) => {
  const clean = mockRooms.filter(r => r.housekeepingStatus === 'CLEAN').length;
  const dirty = mockRooms.filter(r => r.housekeepingStatus === 'DIRTY').length;
  const inspection = mockRooms.filter(r => r.housekeepingStatus === 'INSPECTION').length;
  const outOfService = mockRooms.filter(r => r.housekeepingStatus === 'OUT_OF_SERVICE').length;

  // Get priority rooms (dirty rooms with upcoming arrivals)
  const priorityRooms = mockRooms
    .filter(r => r.housekeepingStatus === 'DIRTY' || r.housekeepingStatus === 'INSPECTION')
    .map(room => ({
      roomNumber: room.number,
      floor: room.floor,
      status: room.housekeepingStatus,
      reason: room.housekeepingStatus === 'DIRTY' ? 'Guest checkout' : 'Needs inspection',
      neededBy: '14:00',
    }));

  res.json({
    success: true,
    data: {
      clean,
      dirty,
      inspection,
      outOfService,
      priorityRooms,
    },
  });
});

router.get('/dashboard/alerts', authenticateDemo, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      {
        id: 'alert-1',
        level: 'high',
        title: 'VIP Arrival Today',
        description: 'Emily Johnson (Suite 302) arrives at 2:00 PM',
        actionLabel: 'View Booking',
      },
      {
        id: 'alert-2',
        level: 'medium',
        title: 'Rooms Need Cleaning',
        description: '2 rooms need immediate attention before check-in',
        actionLabel: 'View Housekeeping',
      },
    ],
  });
});

// Rooms Routes
router.get('/rooms', authenticateDemo, (req: Request, res: Response) => {
  let rooms = mockRooms.map(getRoomWithType);

  const { status, floor, housekeepingStatus } = req.query;
  if (status) rooms = rooms.filter(r => r.status === status);
  if (floor) rooms = rooms.filter(r => r.floor === parseInt(floor as string));
  if (housekeepingStatus) rooms = rooms.filter(r => r.housekeepingStatus === housekeepingStatus);

  res.json({ success: true, data: rooms });
});

router.get('/rooms/:id', authenticateDemo, (req: Request, res: Response) => {
  const room = mockRooms.find(r => r.id === req.params.id);
  if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
  res.json({ success: true, data: getRoomWithType(room) });
});

router.post('/rooms', authenticateDemo, (req: Request, res: Response) => {
  const { roomTypeId, number, floor, notes } = req.body || {};

  if (!roomTypeId || !number || floor === undefined || floor === null) {
    return res.status(400).json({ success: false, error: 'roomTypeId, number, and floor are required' });
  }

  const parsedFloor = Number(floor);
  if (!Number.isFinite(parsedFloor) || !Number.isInteger(parsedFloor)) {
    return res.status(400).json({ success: false, error: 'Floor must be an integer' });
  }

  const roomType = mockRoomTypes.find(rt => rt.id === roomTypeId);
  if (!roomType) {
    return res.status(400).json({ success: false, error: 'Invalid room type' });
  }

  const existing = mockRooms.find(r => r.number === number);
  if (existing) {
    return res.status(409).json({ success: false, error: 'Room number already exists' });
  }

  const newRoom = {
    id: `room-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    hotelId: mockHotel.id,
    roomTypeId,
    number: String(number),
    floor: parsedFloor,
    status: 'AVAILABLE',
    housekeepingStatus: 'CLEAN',
    notes: notes || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  mockRooms.push(newRoom);

  res.status(201).json({ success: true, data: getRoomWithType(newRoom) });
});

router.patch('/rooms/:id/status', authenticateDemo, (req: Request, res: Response) => {
  const room = mockRooms.find(r => r.id === req.params.id);
  if (!room) return res.status(404).json({ success: false, error: 'Room not found' });

  const { status, housekeepingStatus } = req.body;
  if (status) (room as any).status = status;
  if (housekeepingStatus) (room as any).housekeepingStatus = housekeepingStatus;

  res.json({ success: true, data: getRoomWithType(room) });
});

// Room Types Routes
router.get('/room-types', authenticateDemo, (req: Request, res: Response) => {
  res.json({ success: true, data: mockRoomTypes });
});

// Floor Routes
router.get('/floors', authenticateDemo, (_req: Request, res: Response) => {
  res.json({ success: true, data: demoFloors });
});

router.post('/floors', authenticateDemo, (req: Request, res: Response) => {
  try {
    const { number, name } = req.body || {};

    if (number === undefined || number === null || number === '') {
      return res.status(400).json({ success: false, error: 'Floor number is required' });
    }

    const parsedNumber = Number(number);
    if (!Number.isFinite(parsedNumber) || !Number.isInteger(parsedNumber)) {
      return res.status(400).json({ success: false, error: 'Floor number must be a valid integer' });
    }

    const existing = demoFloors.find((floor) => floor.number === parsedNumber);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Floor already exists' });
    }

    const newFloor = {
      id: `floor-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      hotelId: mockHotel.id,
      number: parsedNumber,
      name: name?.trim() || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    demoFloors.push(newFloor);
    console.log('[FLOOR] Created floor:', newFloor);

    res.status(201).json({ success: true, data: newFloor, message: 'Floor created' });
  } catch (error) {
    console.error('[FLOOR ERROR]', error);
    res.status(500).json({ success: false, error: 'Failed to create floor: ' + (error as any).message });
  }
});

router.delete('/floors/:id', authenticateDemo, (req: Request, res: Response) => {
  const index = demoFloors.findIndex((floor) => floor.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Floor not found' });
  }

  const floor = demoFloors[index];
  const hasRooms = mockRooms.some((room) => room.floor === floor.number);
  if (hasRooms) {
    return res
      .status(409)
      .json({ success: false, error: 'Cannot delete floor with existing rooms (demo)' });
  }

  demoFloors.splice(index, 1);
  res.json({ success: true, message: 'Floor deleted (demo)' });
});

// Bookings Routes
router.get('/bookings', authenticateDemo, (req: Request, res: Response) => {
  let bookings = mockBookings.map(getBookingWithRelations);

  const { status, guestId } = req.query;
  if (status) bookings = bookings.filter(b => b.status === status);
  if (guestId) bookings = bookings.filter(b => b.guestId === guestId);

  res.json({
    success: true,
    data: bookings,
    pagination: { page: 1, limit: 20, total: bookings.length, totalPages: 1 },
  });
});

router.post('/bookings', authenticateDemo, (req: Request, res: Response) => {
  const {
    guestId,
    guest,
    roomTypeId,
    roomId,
    checkInDate,
    checkOutDate,
    numberOfAdults,
    numberOfChildren,
    source,
    paymentMethod,
    specialRequests,
    roomRate,
  } = req.body || {};

  if (!guestId && !guest) {
    return res.status(400).json({ success: false, error: 'Guest information is required' });
  }

  let bookingGuestId = guestId;

  if (!bookingGuestId && guest) {
    const newGuest = {
      id: `guest-${Date.now()}`,
      hotelId: mockHotel.id,
      firstName: guest.firstName || 'Guest',
      lastName: guest.lastName || 'Guest',
      email: guest.email || `guest-${Date.now()}@demo.com`,
      phone: guest.phone || null,
      address: guest.address || 'Demo Address',
      idType: 'Passport',
      idNumber: `P-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      nationality: 'US',
      vipStatus: false,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockGuests.push(newGuest);
    bookingGuestId = newGuest.id;
  }

  const selectedRoomType = roomTypeId ? mockRoomTypes.find((type) => type.id === roomTypeId) : undefined;
  let assignedRoomId = roomId;

  if (!assignedRoomId && roomTypeId) {
    const availableRoom = mockRooms.find((room) => room.roomTypeId === roomTypeId && room.status === 'AVAILABLE');
    if (availableRoom) {
      assignedRoomId = availableRoom.id;
      availableRoom.status = 'OCCUPIED';
      availableRoom.housekeepingStatus = 'CLEAN';
    }
  }

  const inHouseGuests = Number(numberOfAdults || 1) + Number(numberOfChildren || 0);
  const nights = checkInDate && checkOutDate
    ? Math.max(1, Math.ceil((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24)))
    : 1;

  const totalAmount = (roomRate || selectedRoomType?.baseRate || 0) * nights;

  const newBooking = {
    id: `booking-${Date.now()}`,
    hotelId: mockHotel.id,
    guestId: bookingGuestId,
    roomId: assignedRoomId || null,
    bookingRef: `BK-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`,
    checkInDate: checkInDate ? new Date(checkInDate) : new Date(),
    checkOutDate: checkOutDate ? new Date(checkOutDate) : new Date(Date.now() + 24 * 60 * 60 * 1000),
    numberOfGuests: inHouseGuests,
    status: 'CONFIRMED',
    source: source || 'DIRECT',
    specialRequests: specialRequests || null,
    totalAmount,
    paidAmount: totalAmount,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  mockBookings.push(newBooking);
  saveDemoStore();

  res.json({
    success: true,
    data: getBookingWithRelations(newBooking),
  });
});

// Access Request Routes
router.get('/access-requests', authenticateDemo, (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: mockAccessRequests,
  });
});

router.post('/access-requests', (req: Request, res: Response) => {
  const { fullName, email, company, role, message } = req.body || {};
  if (!fullName || !email) {
    return res.status(400).json({ success: false, error: 'Full name and email are required' });
  }

  const newRequest = {
    id: `access-${Date.now()}`,
    fullName,
    email,
    company: company || 'Demo Hotel',
    role: role || 'Receptionist',
    message: message || '',
    adminNotes: null,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  mockAccessRequests.push(newRequest);
  saveDemoStore();

  const notifyRecipients = config.accessRequestNotifyEmails.length
    ? config.accessRequestNotifyEmails
    : [config.email.fromAddress];

  // Demo mode should mirror production notifications for new access requests.
  const adminUrl = `${config.appUrl}/settings?tab=access-requests`;
  const adminEmail = renderLafloEmail({
    preheader: `New access request from ${fullName}.`,
    title: 'New access request',
    greeting: 'Hello,',
    intro: 'A new access request was submitted. Review and take action in the admin console.',
    meta: [
      { label: 'Name', value: fullName },
      { label: 'Email', value: email },
      { label: 'Company', value: company || '-' },
      { label: 'Role', value: role || '-' },
      { label: 'Message', value: message || '-' },
      { label: 'Reference', value: `AR-${newRequest.id}` },
    ],
    cta: { label: 'Open access requests', url: adminUrl },
  });

  sendEmail({
    to: notifyRecipients.join(','),
    subject: 'New access request',
    html: adminEmail.html,
    text: adminEmail.text,
  }).catch((error) => {
    console.error('[ACCESS-REQUEST] Failed to send admin notification email:', error);
  });

  const requesterEmail = renderLafloEmail({
    preheader: `We received your access request. Reference AR-${newRequest.id}.`,
    title: 'We received your access request',
    greeting: `Hello ${fullName},`,
    intro:
      'Thanks for requesting access to LaFlo. Our team will review your request and reach out with access details.',
    meta: [
      { label: 'Company', value: company || '-' },
      { label: 'Role', value: role || '-' },
      { label: 'Reference', value: `AR-${newRequest.id}` },
    ],
    cta: { label: 'Go to login', url: `${config.appUrl}/login` },
    footerNote: 'If you did not request access, you can ignore this email.',
  });

  sendEmail({
    to: email,
    subject: `We received your access request [AR-${newRequest.id}]`,
    html: requesterEmail.html,
    text: requesterEmail.text,
  }).catch((error) => {
    console.error('[ACCESS-REQUEST] Failed to send requester confirmation email:', error);
  });

  res.status(201).json({
    success: true,
    data: newRequest,
  });
});

router.get('/access-requests/:id/replies', authenticateDemo, (req: Request, res: Response) => {
  const replies = mockAccessRequestReplies.filter((reply) => reply.accessRequestId === req.params.id);
  res.json({
    success: true,
    data: replies,
  });
});

const respondSuccess = (res: Response) => res.json({ success: true });

// Approve access request - creates the user and sends them login credentials
router.post('/access-requests/:id/approve', authenticateDemo, async (req: Request, res: Response) => {
  const requestIndex = mockAccessRequests.findIndex((r) => r.id === req.params.id);
  if (requestIndex === -1) {
    return res.status(404).json({ success: false, error: 'Access request not found' });
  }

  const accessRequest = mockAccessRequests[requestIndex] as any;
  
  // Check if user already exists
  const existingUser = mockUsers.find((u) => u.email.toLowerCase() === accessRequest.email.toLowerCase());
  if (existingUser) {
    // Update status to approved and remove from list
    mockAccessRequests.splice(requestIndex, 1);
    return res.json({ success: true, message: 'User already exists, request removed' });
  }

  // Generate password (use stored temp password if available, or generate new one)
  const tempPassword = accessRequest._tempPassword || `Temp${Math.random().toString(36).slice(2, 10)}A1!`;
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  // Parse name from fullName
  const nameParts = accessRequest.fullName.split(' ');
  const firstName = nameParts[0] || 'User';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Create the user
  const newUser = {
    id: `user-${Date.now()}`,
    email: accessRequest.email.toLowerCase(),
    firstName,
    lastName,
    role: accessRequest.requestedRole || accessRequest.role || 'RECEPTIONIST',
    positionTitle: accessRequest._positionTitle || null,
    passwordHash,
    isActive: true,
    twoFactorEnabled: false,
    mustChangePassword: true,
    hotelId: mockHotel.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
  };

  mockUsers.push(newUser);
  console.log(`[APPROVE] Created user from access request: ${newUser.email}`);

  // Send approval email with login credentials
  try {
    const approved = renderLafloEmail({
      preheader: `Your access is approved. Reference AR-${accessRequest.id}.`,
      title: 'Access approved',
      greeting: `Hello ${firstName},`,
      intro:
        'Great news. Your access request to LaFlo has been approved. Use the credentials below and change your password after you sign in.',
      meta: [
        { label: 'Email', value: accessRequest.email },
        { label: 'Temporary password', value: tempPassword },
        { label: 'Reference', value: `AR-${accessRequest.id}` },
      ],
      cta: {
        label: 'Log in',
        url: `${config.appUrl || 'https://laflo-web-production.up.railway.app'}/login`,
      },
      footerNote: 'If you did not request access, contact an administrator.',
    });

    await sendEmail({
      to: accessRequest.email,
      subject: `Your LaFlo access is approved [AR-${accessRequest.id}]`,
      html: approved.html,
      text: approved.text,
    });
    console.log(`[APPROVE] OK Approval email with credentials sent to ${accessRequest.email}`);
  } catch (error) {
    console.error('[APPROVE] ERROR Failed to send approval email:', error);
  }// Update status and remove from pending list
  mockAccessRequests.splice(requestIndex, 1);
  saveDemoStore();

  res.json({ success: true, message: 'User approved and credentials email sent', data: newUser });
});

router.post('/access-requests/:id/reject', authenticateDemo, (req: Request, res: Response) => {
  const requestIndex = mockAccessRequests.findIndex((r) => r.id === req.params.id);
  if (requestIndex === -1) {
    return res.status(404).json({ success: false, error: 'Access request not found' });
  }
  mockAccessRequests[requestIndex].status = 'REJECTED';
  mockAccessRequests.splice(requestIndex, 1);
  saveDemoStore();
  res.json({ success: true, message: 'Access request rejected' });
});

router.post('/access-requests/:id/request-info', authenticateDemo, async (req: Request, res: Response) => {
  const requestIndex = mockAccessRequests.findIndex((r) => r.id === req.params.id);
  if (requestIndex === -1) {
    return res.status(404).json({ success: false, error: 'Access request not found' });
  }
  
  const accessRequest = mockAccessRequests[requestIndex] as any;
  const { notes } = req.body || {};
  
  // Update status and save the notes
  mockAccessRequests[requestIndex].status = 'NEEDS_INFO';
  if (notes) {
    mockAccessRequests[requestIndex].adminNotes = notes;
  }
  
  // Send email to user requesting more information
  try {
    const first = (accessRequest.fullName || 'User').split(' ')[0] || 'User';
    const needsInfo = renderLafloEmail({
      preheader: `More information is needed. Reference AR-${accessRequest.id}.`,
      title: 'More information needed',
      greeting: `Hello ${first},`,
      intro:
        'We reviewed your access request and need a bit more information before we can proceed. Reply to this email with the requested details.',
      meta: [{ label: 'Reference', value: `AR-${accessRequest.id}` }],
      bodyHtml: notes
        ? `<p style="margin:0;"><strong>Message from administrator:</strong><br/>${escapeEmailText(
            String(notes)
          )}</p>`
        : undefined,
      footerNote: 'Reply directly to this email to provide the requested information.',
    });

    await sendEmail({
      to: accessRequest.email,
      subject: `Additional information needed for your access request [AR-${accessRequest.id}]`,
      html: needsInfo.html,
      text: needsInfo.text,
    });
    console.log(`[REQUEST-INFO] OK Info request email sent to ${accessRequest.email}`);
  } catch (error) {
    console.error('[REQUEST-INFO] ERROR Failed to send info request email:', error);
  }saveDemoStore();
  res.json({ success: true, message: 'Information requested and email sent to user' });
});

// Simulate receiving a reply from user (for demo purposes)
router.post('/access-requests/:id/simulate-reply', authenticateDemo, (req: Request, res: Response) => {
  const requestIndex = mockAccessRequests.findIndex((r) => r.id === req.params.id);
  if (requestIndex === -1) {
    return res.status(404).json({ success: false, error: 'Access request not found' });
  }
  
  const accessRequest = mockAccessRequests[requestIndex] as any;
  const { message } = req.body || {};
  
  // Create a reply
  const newReply = {
    id: `reply-${Date.now()}`,
    accessRequestId: req.params.id,
    fromEmail: accessRequest.email,
    subject: `Re: Additional Information Required - LaFlo Access Request`,
    bodyText: message || 'Here is the additional information you requested.',
    bodyHtml: null,
    attachments: null,
    receivedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  
  mockAccessRequestReplies.push(newReply);
  
  // Update status to INFO_RECEIVED
  mockAccessRequests[requestIndex].status = 'INFO_RECEIVED';
  saveDemoStore();
  
  console.log(`[SIMULATE-REPLY] Reply added for ${accessRequest.email}, status changed to INFO_RECEIVED`);
  
  res.json({ success: true, message: 'Reply received, status updated to INFO_RECEIVED', data: newReply });
});

// Add reply to access request (for real IMAP integration)
router.post('/access-requests/:id/replies', authenticateDemo, (req: Request, res: Response) => {
  const requestIndex = mockAccessRequests.findIndex((r) => r.id === req.params.id);
  if (requestIndex === -1) {
    return res.status(404).json({ success: false, error: 'Access request not found' });
  }
  
  const accessRequest = mockAccessRequests[requestIndex] as any;
  const { subject, bodyText, fromEmail } = req.body || {};
  
  const newReply = {
    id: `reply-${Date.now()}`,
    accessRequestId: req.params.id,
    fromEmail: fromEmail || accessRequest.email,
    subject: subject || 'Re: Access Request',
    bodyText: bodyText || '',
    bodyHtml: null,
    attachments: null,
    receivedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  
  mockAccessRequestReplies.push(newReply);
  mockAccessRequests[requestIndex].status = 'INFO_RECEIVED';
  saveDemoStore();
  
  res.status(201).json({ success: true, data: newReply });
});

router.delete('/access-requests/:id', authenticateDemo, (req: Request, res: Response) => {
  const requestIndex = mockAccessRequests.findIndex((r) => r.id === req.params.id);
  if (requestIndex === -1) {
    return res.status(404).json({ success: false, error: 'Access request not found' });
  }
  mockAccessRequests.splice(requestIndex, 1);
  saveDemoStore();
  res.json({ success: true, message: 'Access request deleted' });
});

// Calendar Routes
router.get('/calendar', authenticateDemo, (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  const start = startDate ? new Date(String(startDate)) : null;
  const end = endDate ? new Date(String(endDate)) : null;
  const events = [...buildBookingCalendarEvents(), ...demoCalendarExtras];

  const filtered = events.filter((event) => {
    if (!start || !end) return true;
    const eventStart = new Date(event.startAt);
    return eventStart >= start && eventStart <= end;
  });

  res.json({ success: true, data: filtered });
});

router.post('/calendar', authenticateDemo, (req: Request, res: Response) => {
  try {
    const { title, type, status, startAt, endAt, room, booking, notes } = req.body || {};
    
    if (!title) return res.status(400).json({ success: false, error: 'Title is required' });
    if (!type) return res.status(400).json({ success: false, error: 'Type is required' });
    if (!startAt) return res.status(400).json({ success: false, error: 'Start date/time is required' });
    if (!endAt) return res.status(400).json({ success: false, error: 'End date/time is required' });

    const newEvent = {
      id: `event-${Date.now()}`,
      title,
      type,
      status: status || 'SCHEDULED',
      startAt: toCalendarDate(startAt),
      endAt: toCalendarDate(endAt),
      room,
      booking,
      notes: notes || null,
    };

    demoCalendarExtras.push(newEvent);
    saveDemoStore();
    console.log('[CALENDAR] Created event:', newEvent);
    res.status(201).json({ success: true, data: newEvent });
  } catch (error) {
    console.error('[CALENDAR ERROR]', error);
    res.status(500).json({ success: false, error: 'Failed to create calendar event: ' + (error as any).message });
  }
});

router.patch('/calendar/:id', authenticateDemo, (req: Request, res: Response) => {
  const index = demoCalendarExtras.findIndex((event) => event.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Calendar event not found' });
  }

  demoCalendarExtras[index] = {
    ...demoCalendarExtras[index],
    ...req.body,
  };
  saveDemoStore();

  res.json({ success: true, data: demoCalendarExtras[index] });
});

router.delete('/calendar/:id', authenticateDemo, (req: Request, res: Response) => {
  demoCalendarExtras = demoCalendarExtras.filter((event) => event.id !== req.params.id);
  saveDemoStore();
  res.json({ success: true, message: 'Calendar event deleted' });
});

router.get('/bookings/:id', authenticateDemo, (req: Request, res: Response) => {
  const booking = mockBookings.find(b => b.id === req.params.id);
  if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
  res.json({ success: true, data: getBookingWithRelations(booking) });
});

router.post('/bookings/:id/check-in', authenticateDemo, (req: Request, res: Response) => {
  const booking = mockBookings.find(b => b.id === req.params.id);
  if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

  (booking as any).status = 'CHECKED_IN';
  const room = mockRooms.find(r => r.id === booking.roomId);
  if (room) (room as any).status = 'OCCUPIED';
  saveDemoStore();

  res.json({ success: true, data: getBookingWithRelations(booking) });
});

router.post('/bookings/:id/check-out', authenticateDemo, (req: Request, res: Response) => {
  const booking = mockBookings.find(b => b.id === req.params.id);
  if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

  (booking as any).status = 'CHECKED_OUT';
  const room = mockRooms.find(r => r.id === booking.roomId);
  if (room) {
    (room as any).status = 'AVAILABLE';
    (room as any).housekeepingStatus = 'DIRTY';
  }
  saveDemoStore();

  res.json({ success: true, data: getBookingWithRelations(booking) });
});

router.post('/invoices/booking/:bookingId', authenticateDemo, (req: Request, res: Response) => {
  const booking = mockBookings.find((b) => b.id === req.params.bookingId);
  if (!booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }

  const existing = mockInvoices.find((invoice) => invoice.bookingId === booking.id);
  if (existing) {
    return res.json({ success: true, data: existing });
  }

  const invoice = buildInvoiceFromBooking(booking);
  mockInvoices.push(invoice);
  saveDemoStore();
  res.status(201).json({ success: true, data: invoice, message: 'Invoice created (demo)' });
});

router.get('/invoices/:id', authenticateDemo, (req: Request, res: Response) => {
  const invoice = mockInvoices.find((inv) => inv.id === req.params.id);
  if (!invoice) {
    return res.status(404).json({ success: false, error: 'Invoice not found' });
  }

  updateInvoiceStatusFromPayments(invoice);

  res.json({ success: true, data: invoice });
});

router.get('/invoices/:id/pdf', authenticateDemo, (req: Request, res: Response) => {
  const invoice = mockInvoices.find((inv) => inv.id === req.params.id);
  if (!invoice) {
    return res.status(404).json({ success: false, error: 'Invoice not found' });
  }

  updateInvoiceStatusFromPayments(invoice);

  const booking = mockBookings.find((b) => b.id === invoice.bookingId);
  if (!booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }

  buildDemoInvoicePdf(invoice, booking)
    .then((pdfBuffer) => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNo}.pdf"`);
      res.send(pdfBuffer);
    })
    .catch((error) => {
      console.error('[DEMO INVOICE PDF ERROR]', error);
      res.status(500).json({ success: false, error: 'Failed to generate invoice PDF' });
    });
});

router.post('/invoices/:id/send', authenticateDemo, async (req: Request, res: Response) => {
  const invoice = mockInvoices.find((inv) => inv.id === req.params.id);
  if (!invoice) {
    return res.status(404).json({ success: false, error: 'Invoice not found' });
  }

  updateInvoiceStatusFromPayments(invoice);

  // Find the booking and guest
  const booking = mockBookings.find((b) => b.id === invoice.bookingId);
  if (!booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }

  const guest = mockGuests.find((g) => g.id === booking.guestId);
  if (!guest || !guest.email) {
    return res.status(400).json({ success: false, error: 'Guest email not found' });
  }

  // Build invoice HTML email
  const charges = getBookingCharges(booking);
  const chargesHtml = charges.map(charge => 
    `<tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${charge.description}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${charge.category}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${charge.quantity || 1}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${(charge.amount || 0).toFixed(2)}</td>
    </tr>`
  ).join('');

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; background: white; }
        .report-container { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
        
        /* Header Section */
        .report-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #ddd; }
        .header-left { font-size: 16px; font-weight: 600; color: #333; }
        .header-right { font-size: 18px; font-weight: 600; color: #333; }
        
        /* Metadata Section */
        .metadata { display: flex; gap: 60px; margin-bottom: 30px; padding: 15px 0; border-bottom: 1px solid #ddd; }
        .metadata-item { flex: 1; }
        .metadata-label { font-size: 11px; color: #666; text-transform: uppercase; font-weight: 600; margin-bottom: 3px; }
        .metadata-value { font-size: 13px; color: #333; }
        
        /* Section Headers */
        .section-header { font-size: 12px; font-weight: 700; color: #333; text-transform: uppercase; margin-top: 25px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #ddd; }
        
        /* Information Rows */
        .info-row { display: flex; margin-bottom: 8px; font-size: 13px; }
        .info-label { width: 150px; color: #666; font-weight: 500; }
        .info-value { flex: 1; color: #333; }
        
        /* Table Styles */
        table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px; }
        th { background: #f0f0f0; padding: 10px; text-align: left; font-weight: 600; font-size: 12px; color: #333; text-transform: uppercase; border-bottom: 2px solid #333; }
        td { padding: 8px 10px; border-bottom: 1px solid #ddd; color: #333; }
        
        .col-desc { width: 50%; }
        .col-qty { width: 12%; text-align: center; }
        .col-price { width: 18%; text-align: right; }
        .col-amount { width: 20%; text-align: right; }
        
        /* Summary Section */
        .summary { margin-top: 20px; width: 100%; }
        .summary-row { display: flex; padding: 8px 0; border-bottom: 1px solid #ddd; font-size: 13px; }
        .summary-label { width: 60%; text-align: right; padding-right: 20px; color: #666; }
        .summary-amount { width: 40%; text-align: right; color: #333; font-weight: 500; }
        
        .total-row { padding: 12px 0; border-top: 2px solid #333; border-bottom: 2px solid #333; background: #f9f9f9; }
        .total-row .summary-label { font-weight: 700; color: #333; font-size: 14px; }
        .total-row .summary-amount { font-weight: 700; color: #333; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="report-container">
        <!-- Report Header -->
        <div class="report-header">
          <div class="header-left">${mockHotel.name}</div>
          <div class="header-right">Invoice Report</div>
        </div>
        
        <!-- Metadata Section -->
        <div class="metadata">
          <div class="metadata-item">
            <div class="metadata-label">Invoice Number</div>
            <div class="metadata-value">${invoice.invoiceNo}</div>
          </div>
          <div class="metadata-item">
            <div class="metadata-label">Invoice Date</div>
            <div class="metadata-value">${new Date(invoice.issuedAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</div>
          </div>
          <div class="metadata-item">
            <div class="metadata-label">Booking Reference</div>
            <div class="metadata-value">${booking.bookingRef}</div>
          </div>
          <div class="metadata-item">
            <div class="metadata-label">Status</div>
            <div class="metadata-value">${invoice.status}</div>
          </div>
        </div>
        
        <!-- Guest Information Section -->
        <div class="section-header">Guest Information</div>
        <div class="info-row">
          <div class="info-label">Name</div>
          <div class="info-value">${guest.firstName} ${guest.lastName}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Email</div>
          <div class="info-value">${guest.email}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Phone</div>
          <div class="info-value">${guest.phone || 'N/A'}</div>
        </div>
        
        <!-- Booking Details Section -->
        <div class="section-header">Booking Details</div>
        <div class="info-row">
          <div class="info-label">Check-in</div>
          <div class="info-value">${new Date(booking.checkInDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Check-out</div>
          <div class="info-value">${new Date(booking.checkOutDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</div>
        </div>
        ${booking.room ? `
        <div class="info-row">
          <div class="info-label">Room</div>
          <div class="info-value">${booking.room.number} - ${booking.room.roomType.name}</div>
        </div>
        ` : ''}
        
        <!-- Charges Table Section -->
        <div class="section-header">Charges</div>
        <table>
          <thead>
            <tr>
              <th class="col-desc">Description</th>
              <th class="col-qty">Quantity</th>
              <th class="col-price">Unit Price</th>
              <th class="col-amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${charges.map(charge => `
            <tr>
              <td class="col-desc">${charge.description}</td>
              <td class="col-qty">${charge.quantity || 1}</td>
              <td class="col-price">$${((charge.amount || 0) / (charge.quantity || 1)).toFixed(2)}</td>
              <td class="col-amount">$${(charge.amount || 0).toFixed(2)}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
        
        <!-- Summary Section -->
        <div class="summary">
          <div class="summary-row">
            <div class="summary-label">Subtotal</div>
            <div class="summary-amount">$${invoice.subtotal.toFixed(2)}</div>
          </div>
          <div class="summary-row">
            <div class="summary-label">Tax</div>
            <div class="summary-amount">$${invoice.tax.toFixed(2)}</div>
          </div>
          <div class="summary-row total-row">
            <div class="summary-label">Total</div>
            <div class="summary-amount">$${invoice.total.toFixed(2)}</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    // In demo mode, we'll try to send if SMTP is configured, otherwise just log
    if (config.smtp.host && config.smtp.user && config.smtp.pass) {
      await sendEmail({
        to: guest.email,
        subject: `Invoice ${invoice.invoiceNo}`,
        html: emailHtml,
        text: `Invoice ${invoice.invoiceNo}\n\nGuest: ${guest.firstName} ${guest.lastName}\nBooking: ${booking.bookingRef}\nTotal: $${invoice.total.toFixed(2)}\nStatus: ${invoice.status}\n\nThank you for your stay!`,
      });
      console.log(`âœ“ Invoice email sent to ${guest.email}`);
      res.json({ success: true, message: 'Invoice emailed successfully' });
    } else {
      // Demo mode without SMTP - just log and simulate success
      console.log('\n=== DEMO MODE: Invoice Email ===');
      console.log(`To: ${guest.email}`);
      console.log(`Subject: Invoice ${invoice.invoiceNo} - ${mockHotel.name}`);
      console.log(`Invoice Total: $${invoice.total.toFixed(2)}`);
      console.log(`Status: ${invoice.status}`);
      console.log('\nNote: Configure SMTP_HOST, SMTP_USER, SMTP_PASS environment variables to send real emails.');
      console.log('================================\n');
      res.json({ success: true, message: 'Invoice email logged (demo mode - no SMTP configured)' });
    }
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ success: false, error: 'Failed to send invoice email' });
  }
});

// Record Payment
router.post('/payments/record', authenticateDemo, (req: Request, res: Response) => {
  const { bookingId, amount, method, reference, cardNumber, cardExpiry, cardCvv, notes } = req.body;

  const booking = mockBookings.find((b) => b.id === bookingId);
  if (!booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }

  // Create new payment
  const newPayment = {
    id: `payment-${Date.now()}-${Math.floor(Math.random() * 8999 + 1000)}`,
    bookingId,
    amount: parseFloat(amount),
    method: method.toUpperCase().replace(' ', '_'),
    reference: reference || `PMT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    status: 'COMPLETED' as const,
    processedAt: new Date(),
    metadata: {
      cardLast4: cardNumber ? cardNumber.slice(-4) : undefined,
      notes: notes || undefined,
    },
  };

  mockPayments.push(newPayment);

  const bookingInvoices = getBookingInvoices(booking);
  bookingInvoices.forEach((invoice) => {
    if (newPayment.amount >= invoice.total) {
      invoice.status = 'PAID';
      invoice.updatedAt = new Date();
    }
  });

  saveDemoStore();

  res.status(201).json({ 
    success: true, 
    data: newPayment,
    message: 'Payment recorded successfully' 
  });
});

// Add Charge to Booking
router.post('/bookings/:id/charges', authenticateDemo, (req: Request, res: Response) => {
  const booking = mockBookings.find((b) => b.id === req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }

  const { description, category, quantity, amount } = req.body;

  // In demo mode, we'll just return success since we can't persist charges
  // In real mode, this would create a charge in the database
  const newCharge = {
    id: `charge-${Date.now()}-${Math.floor(Math.random() * 8999 + 1000)}`,
    bookingId: booking.id,
    description: description.trim(),
    category: category.toUpperCase(),
    quantity: parseInt(quantity) || 1,
    amount: parseFloat(amount),
    createdAt: new Date(),
  };

  res.status(201).json({ 
    success: true, 
    data: newCharge,
    message: 'Charge added successfully' 
  });
});

router.get('/payments/:id/receipt/pdf', authenticateDemo, async (req: Request, res: Response) => {
  const payment = findMockPayment(req.params.id);
  if (!payment) {
    return res.status(404).json({ success: false, error: 'Payment not found' });
  }
  const booking = mockBookings.find((b) => b.id === payment.bookingId);
  if (!booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }
  const buffer = await buildDemoReceiptPdf(payment, booking);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="receipt-${payment.id}.pdf"`);
  res.send(buffer);
});

router.post('/payments/:id/receipt/email', authenticateDemo, (req: Request, res: Response) => {
  const payment = findMockPayment(req.params.id);
  if (!payment) {
    return res.status(404).json({ success: false, error: 'Payment not found' });
  }
  const booking = mockBookings.find((b) => b.id === payment.bookingId);
  if (!booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }
  const guest = mockGuests.find((g) => g.id === booking.guestId);
  if (!guest?.email) {
    return res.status(400).json({ success: false, error: 'Guest email not found' });
  }

  const processedAt = new Date(payment.processedAt).toLocaleDateString();
  const receiptHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .wrap { max-width: 700px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; border-bottom: 1px solid #ddd; padding: 12px 0; }
        .title { font-weight: 700; }
        .meta { display: flex; gap: 24px; padding: 12px 0; border-bottom: 1px solid #ddd; font-size: 12px; }
        .section { padding: 12px 0; border-bottom: 1px solid #eee; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #e5e7eb; text-align: left; padding: 8px; font-size: 12px; }
        td { padding: 8px; border-bottom: 1px solid #eee; font-size: 12px; }
        .right { text-align: right; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="header">
          <div class="title">${mockHotel.name}</div>
          <div class="title">Receipt Report</div>
        </div>
        <div class="meta">
          <div><div>Receipt Number</div><strong>${payment.id}</strong></div>
          <div><div>Receipt Date</div><strong>${processedAt}</strong></div>
          <div><div>Status</div><strong>${payment.status}</strong></div>
          <div><div>Booking Reference</div><strong>${booking.bookingRef}</strong></div>
        </div>
        <div class="section">
          <strong>Guest Information</strong><br />
          ${guest.firstName} ${guest.lastName} Â· ${guest.email} Â· ${guest.phone || 'N/A'}
        </div>
        <div class="section">
          <strong>Booking Details</strong><br />
          Check-in: ${new Date(booking.checkInDate).toLocaleDateString()} Â· Check-out: ${new Date(booking.checkOutDate).toLocaleDateString()}
        </div>
        <div class="section">
          <strong>Charges</strong>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th class="right">Quantity</th>
                <th class="right">Unit Price</th>
                <th class="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Payment</td>
                <td class="right">1</td>
                <td class="right">$${payment.amount.toFixed(2)}</td>
                <td class="right">$${payment.amount.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="section">
          <strong>Total</strong> <span style="float:right;">$${payment.amount.toFixed(2)}</span>
        </div>
      </div>
    </body>
    </html>
  `;

  if (config.smtp.host && config.smtp.user && config.smtp.pass) {
    sendEmail({
      to: guest.email,
      subject: `Payment Receipt ${payment.id}`,
      html: receiptHtml,
      text: `Payment Receipt ${payment.id}\nBooking: ${booking.bookingRef}\nAmount: $${payment.amount.toFixed(2)}\nStatus: ${payment.status}`,
    })
      .then(() => {
        console.log(`[EMAIL] Receipt sent successfully to ${guest.email}`);
        res.json({ success: true, message: `Payment receipt emailed to ${guest.email}` });
      })
      .catch((err) => {
        console.error(`[EMAIL ERROR] Failed to send receipt to ${guest.email}:`, err.message);
        res.status(500).json({ success: false, error: 'Failed to send receipt email: ' + err.message });
      });
    return;
  }

  res.json({ success: true, message: `Payment receipt logged (demo) to ${guest.email}` });
});

// Guests Routes
router.get('/guests', authenticateDemo, (req: Request, res: Response) => {
  const { search, page = '1', limit = '20' } = req.query;
  const normalizedSearch = String(search || '').trim().toLowerCase();
  let guests = mockGuests.map((guest) => {
    const guestBookings = mockBookings.filter((booking) => booking.guestId === guest.id);
    const totalSpent = guestBookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
    const manualStays = Number((guest as any).manualStays || 0);
    return {
      ...guest,
      totalStays: Math.max(guestBookings.length, manualStays),
      totalSpent,
      country: guest.country ?? guest.nationality ?? null,
    };
  });

  if (normalizedSearch) {
    guests = guests.filter((guest) => {
      return [
        guest.firstName,
        guest.lastName,
        guest.email,
        guest.phone,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });
  }

  const pageNumber = Math.max(parseInt(String(page), 10) || 1, 1);
  const limitNumber = Math.max(parseInt(String(limit), 10) || 20, 1);
  const startIndex = (pageNumber - 1) * limitNumber;
  const pagedGuests = guests.slice(startIndex, startIndex + limitNumber);

  res.json({
    success: true,
    data: pagedGuests,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total: guests.length,
      totalPages: Math.max(Math.ceil(guests.length / limitNumber), 1),
    },
  });
});

router.get('/guests/:id', authenticateDemo, (req: Request, res: Response) => {
  const guest = mockGuests.find(g => g.id === req.params.id);
  if (!guest) return res.status(404).json({ success: false, error: 'Guest not found' });
  const guestBookings = mockBookings.filter((booking) => booking.guestId === guest.id);
  const totalSpent = guestBookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
  const manualStays = Number((guest as any).manualStays || 0);
  res.json({
    success: true,
    data: {
      ...guest,
      totalStays: Math.max(guestBookings.length, manualStays),
      totalSpent,
      country: guest.country ?? guest.nationality ?? null,
    },
  });
});

router.post('/guests', authenticateDemo, (req: Request, res: Response) => {
  const { firstName, lastName } = req.body;
  if (!firstName || !lastName) {
    return res.status(400).json({ success: false, error: 'First name and last name are required' });
  }

  const newGuest = {
    id: `guest-${Date.now()}`,
    hotelId: mockHotel.id,
    firstName,
    lastName,
    email: req.body.email || null,
    phone: req.body.phone || null,
    address: req.body.address || null,
    city: req.body.city || null,
    country: req.body.country || null,
    idType: req.body.idType || null,
    idNumber: req.body.idNumber || null,
    nationality: req.body.nationality || null,
    vipStatus: Boolean(req.body.vipStatus),
    notes: req.body.notes || null,
    manualStays: Number(req.body.manualStays || 0),
    preferredRoomTypeId: req.body.preferredRoomTypeId || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  mockGuests.push(newGuest);
  saveDemoStore();

  res.json({
    success: true,
    data: {
      ...newGuest,
      totalStays: Number(req.body.manualStays || 0),
      totalSpent: 0,
    },
  });
});

router.patch('/guests/:id', authenticateDemo, (req: Request, res: Response) => {
  const guestIndex = mockGuests.findIndex((g) => g.id === req.params.id);
  if (guestIndex === -1) {
    return res.status(404).json({ success: false, error: 'Guest not found' });
  }

  const guest = mockGuests[guestIndex];
  const updatedGuest = {
    ...guest,
    ...req.body,
    manualStays: req.body.manualStays !== undefined ? Number(req.body.manualStays || 0) : guest.manualStays,
    updatedAt: new Date(),
  };

  mockGuests[guestIndex] = updatedGuest;
  saveDemoStore();

  const guestBookings = mockBookings.filter((booking) => booking.guestId === updatedGuest.id);
  const totalSpent = guestBookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
  const manualStays = Number((updatedGuest as any).manualStays || 0);

  res.json({
    success: true,
    data: {
      ...updatedGuest,
      totalStays: Math.max(guestBookings.length, manualStays),
      totalSpent,
      country: updatedGuest.country ?? updatedGuest.nationality ?? null,
    },
  });
});

router.delete('/guests/:id', authenticateDemo, (req: Request, res: Response) => {
  const guestIndex = mockGuests.findIndex((g) => g.id === req.params.id);
  if (guestIndex === -1) {
    return res.status(404).json({ success: false, error: 'Guest not found' });
  }

  mockGuests.splice(guestIndex, 1);
  saveDemoStore();
  res.json({ success: true, message: 'Guest deleted' });
});

// Inventory Routes
router.get('/inventory', authenticateDemo, (req: Request, res: Response) => {
  const { search } = req.query;
  const normalizedSearch = String(search || '').trim().toLowerCase();
  let inventory = mockInventory.filter((item) => item.isActive);

  if (normalizedSearch) {
    inventory = inventory.filter((item) =>
      [item.name, item.category, item.location]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch))
    );
  }

  res.json({ success: true, data: inventory });
});

// Purchase Orders Routes
router.get('/purchase-orders', authenticateDemo, (_req: Request, res: Response) => {
  res.json({ success: true, data: demoPurchaseOrders });
});

router.post('/purchase-orders', authenticateDemo, (req: Request, res: Response) => {
  const { vendorName, vendorEmail, notes, items } = req.body || {};
  if (!vendorName || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Vendor name and items are required' });
  }

  const normalizedItems = items.map((item: any) => ({
    inventoryItemId: item.inventoryItemId || null,
    name: item.name || 'Item',
    unit: item.unit || 'unit',
    quantity: Number(item.quantity) || 1,
    unitCost: Number(item.unitCost) || 0,
  }));

  const newOrder = {
    id: `po-${Date.now()}`,
    reference: formatPoReference(),
    vendorName,
    vendorEmail: vendorEmail || null,
    notes: notes || null,
    status: 'DRAFT',
    items: normalizedItems,
    createdAt: new Date().toISOString(),
  };

  demoPurchaseOrders.unshift(newOrder);
  res.json({ success: true, data: newOrder });
});

router.get('/purchase-orders/:id/export', authenticateDemo, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { format = 'csv' } = req.query;
  const order = demoPurchaseOrders.find((po) => po.id === id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Purchase order not found' });
  }

  if (format === 'pdf') {
    try {
      const pdf = await buildPdfBuffer(order);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${order.reference}.pdf"`);
      res.send(pdf);
      return;
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Failed to generate PDF' });
    }
  }

  const csv = buildCsv(order);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${order.reference}.csv"`);
  res.send(csv);
});

router.post('/purchase-orders/:id/email', authenticateDemo, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { recipientEmail } = req.body;
  const order = demoPurchaseOrders.find((po) => po.id === id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Purchase order not found' });
  }

  if (!recipientEmail) {
    return res.status(400).json({ success: false, error: 'Recipient email is required' });
  }

  // Build HTML email with PO details
  const itemsHtml = order.items.map((item: any) => {
    const itemTotal = (item.quantity || 0) * (item.unitCost || 0);
    return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.unit}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${(item.unitCost || 0).toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${itemTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const subtotal = order.items.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.unitCost || 0)), 0);
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  const poHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .wrap { max-width: 700px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding: 12px 0; margin-bottom: 20px; }
        .title { font-weight: 700; font-size: 18px; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; font-size: 12px; }
        .meta-item { }
        .meta-label { color: #666; margin-bottom: 4px; }
        .section { margin-bottom: 20px; }
        .section-title { font-weight: 700; font-size: 14px; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        thead { background: #f5f5f5; }
        th { padding: 8px; text-align: left; font-size: 12px; font-weight: bold; border-bottom: 2px solid #ddd; }
        .total-section { margin-top: 20px; text-align: right; }
        .total-row { padding: 8px 0; font-size: 12px; }
        .total-label { display: inline-block; width: 150px; text-align: left; }
        .total-amount { display: inline-block; width: 100px; text-align: right; font-weight: bold; }
        .final-total { font-size: 14px; margin-top: 12px; border-top: 2px solid #000; padding-top: 12px; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="header">
          <div class="title">${mockHotel.name}</div>
          <div class="title">Purchase Order</div>
        </div>

        <div class="meta">
          <div class="meta-item">
            <div class="meta-label">PO Reference</div>
            <div><strong>${order.reference}</strong></div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Date</div>
            <div><strong>${new Date(order.createdAt).toLocaleDateString()}</strong></div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Vendor</div>
            <div><strong>${order.vendorName}</strong></div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Status</div>
            <div><strong>${order.status}</strong></div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Order Items</div>
          <table>
            <thead>
              <tr>
                <th>Item Description</th>
                <th>Unit</th>
                <th>Quantity</th>
                <th style="text-align: right;">Unit Cost</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>

        <div class="total-section">
          <div class="total-row">
            <span class="total-label">Subtotal:</span>
            <span class="total-amount">$${subtotal.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span class="total-label">Tax (10%):</span>
            <span class="total-amount">$${tax.toFixed(2)}</span>
          </div>
          <div class="total-row final-total">
            <span class="total-label">TOTAL:</span>
            <span class="total-amount">$${total.toFixed(2)}</span>
          </div>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #666;">
          <p>This is an automated purchase order from ${mockHotel.name}. Please confirm receipt and any questions to the hotel.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  if (config.smtp.host && config.smtp.user && config.smtp.pass) {
    sendEmail({
      to: recipientEmail,
      subject: `Purchase Order ${order.reference} from ${mockHotel.name}`,
      html: poHtml,
      text: `Purchase Order ${order.reference}\nVendor: ${order.vendorName}\nTotal: $${total.toFixed(2)}`,
    })
      .then(() => res.json({ success: true, message: `Purchase order emailed to ${recipientEmail}` }))
      .catch((err) => {
        console.error('PO email error:', err);
        res.status(500).json({ success: false, error: 'Failed to send purchase order email' });
      });
    return;
  }

  res.json({ success: true, message: `Purchase order logged (demo) to ${recipientEmail}` });
});

router.post('/inventory', authenticateDemo, (req: Request, res: Response) => {
  const { name, category, unit } = req.body;
  const quantityOnHand = Number(req.body.quantityOnHand);
  const reorderPoint = Number(req.body.reorderPoint);
  const cost = Number(req.body.cost);

  if (!name || !category || !unit) {
    return res.status(400).json({ success: false, error: 'Name, category, and unit are required' });
  }

  if (!Number.isFinite(quantityOnHand) || !Number.isFinite(reorderPoint) || !Number.isFinite(cost)) {
    return res.status(400).json({ success: false, error: 'Quantity, reorder point, and cost are required' });
  }

  const newItem = {
    id: `inv-${Date.now()}`,
    hotelId: mockHotel.id,
    name,
    category,
    unit,
    quantityOnHand,
    reorderPoint,
    cost,
    location: req.body.location || null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  mockInventory.push(newItem);
  res.json({ success: true, data: newItem });
});

router.patch('/inventory/:id', authenticateDemo, (req: Request, res: Response) => {
  const itemIndex = mockInventory.findIndex((item) => item.id === req.params.id);
  if (itemIndex === -1) {
    return res.status(404).json({ success: false, error: 'Inventory item not found' });
  }

  const item = mockInventory[itemIndex];
  const updatedItem = {
    ...item,
    ...req.body,
    updatedAt: new Date(),
  };
  mockInventory[itemIndex] = updatedItem;

  res.json({ success: true, data: updatedItem });
});

router.delete('/inventory/:id', authenticateDemo, (req: Request, res: Response) => {
  const itemIndex = mockInventory.findIndex((item) => item.id === req.params.id);
  if (itemIndex === -1) {
    return res.status(404).json({ success: false, error: 'Inventory item not found' });
  }

  mockInventory[itemIndex] = {
    ...mockInventory[itemIndex],
    isActive: false,
    updatedAt: new Date(),
  };

  res.json({ success: true, message: 'Inventory item deactivated' });
});

// Housekeeping Routes
router.get('/housekeeping/rooms', authenticateDemo, (req: Request, res: Response) => {
  const rooms = mockRooms.map(getRoomWithType);
  res.json({ success: true, data: rooms });
});

router.patch('/housekeeping/rooms/:id', authenticateDemo, (req: Request, res: Response) => {
  const room = mockRooms.find(r => r.id === req.params.id);
  if (!room) return res.status(404).json({ success: false, error: 'Room not found' });

  const { housekeepingStatus } = req.body;
  if (housekeepingStatus) (room as any).housekeepingStatus = housekeepingStatus;

  res.json({ success: true, data: getRoomWithType(room) });
});

router.get('/messages', authenticateDemo, (req: Request, res: Response) => {
  const { search, limit } = req.query;
  const searchTerm = (search as string | undefined)?.trim().toLowerCase();
  const max = limit ? Math.max(1, Math.min(50, Number(limit))) : 50;
  const filtered = mockConversations.filter((conversation) => {
    if (!searchTerm) return true;
    const guest = mockGuests.find((g) => g.id === conversation.guestId);
    const booking = mockBookings.find((b) => b.id === conversation.bookingId);
    const subjectMatches = conversation.subject.toLowerCase().includes(searchTerm);
    const guestMatches = guest
      ? `${guest.firstName} ${guest.lastName}`.toLowerCase().includes(searchTerm) ||
        (guest.email ?? '').toLowerCase().includes(searchTerm)
      : false;
    const bookingMatches = booking?.bookingRef.toLowerCase().includes(searchTerm);
    return subjectMatches || guestMatches || Boolean(bookingMatches);
  });
  const threads = filtered.slice(0, max).map(getConversationSummary);
  res.json({ success: true, data: threads });
});

router.get('/messages/:id', authenticateDemo, (req: Request, res: Response) => {
  const thread = getConversationDetail(req.params.id);
  if (!thread) {
    return res.status(404).json({ success: false, error: 'Conversation not found' });
  }
  res.json({ success: true, data: thread });
});

router.post('/messages/live-support', authenticateDemo, (req: Request, res: Response) => {
  const initialMessage =
    typeof req.body?.initialMessage === 'string' ? req.body.initialMessage.trim() : '';
  const user = mockUsers[0];
  let thread = mockConversations.find((c) => c.subject === 'Live Support');

  if (!thread) {
    thread = {
      id: `conv-support-${Date.now()}`,
      hotelId: mockHotel.id,
      guestId: undefined,
      bookingId: undefined,
      subject: 'Live Support',
      status: 'OPEN',
      lastMessageAt: new Date(),
      messages: [
        {
          id: `msg-${Date.now()}-system`,
          senderType: 'SYSTEM' as const,
          body: `${user.firstName} ${user.lastName} opened live support chat.`,
          createdAt: new Date(),
        },
      ],
    };
    mockConversations.unshift(thread as any);
  }

  if (initialMessage) {
    const msg = {
      id: `msg-${Date.now()}`,
      senderType: 'STAFF' as const,
      body: initialMessage,
      createdAt: new Date(),
      senderUserId: user.id,
    };
    thread.messages.push(msg as any);
    thread.lastMessageAt = msg.createdAt;
    thread.status = 'OPEN';
  }

  const summary = getConversationSummary(thread as any);
  res.json({ success: true, data: summary });
});

router.post('/messages/:id/messages', authenticateDemo, (req: Request, res: Response) => {
  const thread = mockConversations.find((c) => c.id === req.params.id);
  if (!thread) {
    return res.status(404).json({ success: false, error: 'Conversation not found' });
  }
  const user = mockUsers[0];
  const message = {
    id: `msg-${Date.now()}`,
    senderType: 'STAFF' as const,
    body: req.body.body?.toString() || 'Message received',
    createdAt: new Date().toISOString(),
    senderUser: { firstName: user.firstName, lastName: user.lastName, role: user.role },
  };
  thread.messages.push({
    id: message.id,
    senderType: 'STAFF' as const,
    body: message.body,
    createdAt: new Date(message.createdAt),
    senderUserId: user.id,
  } as any);
  thread.lastMessageAt = new Date(message.createdAt);
  thread.status = 'OPEN';
  res.status(201).json({ success: true, data: message, message: 'Message recorded' });
});

// Users Routes
router.get('/users', authenticateDemo, (req: Request, res: Response) => {
  const users = mockUsers.map(u => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
  }));
  res.json({ success: true, data: users });
});

router.post('/users', authenticateDemo, async (req: Request, res: Response) => {
  console.log('[POST /users] Request body:', JSON.stringify(req.body, null, 2));
  const { email, firstName, lastName, role, password, sendInvite, positionTitle } = req.body || {};
  console.log(`[POST /users] sendInvite value: ${sendInvite}, type: ${typeof sendInvite}`);
  if (!email || !firstName || !lastName || !role) {
    return res.status(400).json({ success: false, error: 'Email, name, and role are required' });
  }
  const existingUser = mockUsers.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (existingUser) {
    return res.status(400).json({ success: false, error: 'User with this email already exists' });
  }
  const existingRequest = mockAccessRequests.find((r) => r.email.toLowerCase() === String(email).toLowerCase());
  if (existingRequest) {
    return res.status(400).json({ success: false, error: 'An access request for this email already exists' });
  }

  // Generate a temp password
  const tempPassword = password || `Temp${Math.random().toString(36).slice(2, 10)}A1!`;

  // If sendInvite is true, create an access request (requires admin approval)
  if (sendInvite) {
    const newRequest = {
      id: `access-${Date.now()}`,
      fullName: `${firstName} ${lastName}`,
      email: String(email).toLowerCase(),
      company: 'Admin Created',
      role: role,
      requestedRole: role,
      message: `User created by admin with role: ${role}`,
      adminNotes: positionTitle ? `Position: ${positionTitle}` : null,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      // Store temp password for when approved
      _tempPassword: tempPassword,
      _positionTitle: positionTitle || null,
    };

    mockAccessRequests.push(newRequest);
    saveDemoStore();
    console.log(`[POST /users] Created access request for ${email}, pending approval`);

    // Send notification email that their request is pending
    try {
      await sendEmail({
        to: String(email),
        subject: `Your access request to LaFlo has been submitted`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">Access Request Received</h2>
            <p>Hello ${firstName},</p>
            <p>Your access request to <strong>LaFlo Hotel Management System</strong> has been submitted and is pending approval.</p>
            <p>You will receive another email with your login credentials once your request has been approved.</p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">If you did not request this access, please ignore this email.</p>
          </div>
        `,
      });
      console.log(`[POST /users] âœ“ Pending notification email sent to ${email}`);
    } catch (error) {
      console.error('[POST /users] âœ— Failed to send pending notification email:', error);
    }

    return res.status(201).json({ 
      success: true, 
      data: { ...newRequest, _tempPassword: undefined }, 
      message: 'Access request created. User will be notified once approved.' 
    });
  }

  // If sendInvite is false, create user directly (no approval needed)
  const passwordHash = await bcrypt.hash(String(tempPassword), 10);
  const newUser = {
    id: `user-${Date.now()}`,
    email: String(email).toLowerCase(),
    firstName: String(firstName),
    lastName: String(lastName),
    role,
    positionTitle: positionTitle || null,
    passwordHash,
    isActive: true,
    twoFactorEnabled: false,
    mustChangePassword: !password,
    hotelId: mockHotel.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
  };

  mockUsers.push(newUser);
  saveDemoStore();
  console.log(`[POST /users] Created user directly (no approval): ${email}`);

  res.status(201).json({ success: true, data: newUser, message: 'User created successfully' });
});

router.patch('/users/:id', authenticateDemo, (req: Request, res: Response) => {
  const userIndex = mockUsers.findIndex((u) => u.id === req.params.id);
  if (userIndex === -1) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  const current = mockUsers[userIndex];
  const updated = {
    ...current,
    ...req.body,
    updatedAt: new Date(),
  };

  mockUsers[userIndex] = updated;
  res.json({ success: true, data: updated });
});

router.delete('/users/:id', authenticateDemo, (req: Request, res: Response) => {
  const userIndex = mockUsers.findIndex((u) => u.id === req.params.id);
  if (userIndex === -1) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  mockUsers.splice(userIndex, 1);
  res.json({ success: true, message: 'User deleted' });
});

// Reports Routes
router.get('/reports/revenue', authenticateDemo, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      total: 1492.00,
      currency: 'USD',
      breakdown: [
        { date: new Date().toISOString().split('T')[0], revenue: 495.00, bookings: 1 },
        { date: new Date(Date.now() - 86400000).toISOString().split('T')[0], revenue: 997.00, bookings: 2 },
      ],
    },
  });
});

router.get('/reports/occupancy', authenticateDemo, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      averageRate: 38,
      breakdown: [
        { date: new Date().toISOString().split('T')[0], rate: 38, occupied: 5, total: 13 },
      ],
    },
  });
});

// Report: Room Types Performance
router.get('/reports/room-types', authenticateDemo, (_req: Request, res: Response) => {
  const roomTypeData = [
    { name: 'Standard Room', bookings: 45, revenue: 6750, occupancy: 72 },
    { name: 'Deluxe Room', bookings: 32, revenue: 7360, occupancy: 65 },
    { name: 'Junior Suite', bookings: 18, revenue: 5940, occupancy: 58 },
    { name: 'Executive Suite', bookings: 12, revenue: 5880, occupancy: 48 },
    { name: 'Presidential Suite', bookings: 4, revenue: 3960, occupancy: 32 },
  ];

  res.json({
    success: true,
    data: roomTypeData,
  });
});

// Report: Guest Demographics
router.get('/reports/guests', authenticateDemo, (_req: Request, res: Response) => {
  const guestData = {
    totalGuests: 156,
    newGuests: 42,
    returningGuests: 114,
    averageStay: 2.8,
    guestsByCountry: [
      { country: 'United States', count: 45, percentage: 29 },
      { country: 'United Kingdom', count: 28, percentage: 18 },
      { country: 'Germany', count: 22, percentage: 14 },
      { country: 'France', count: 18, percentage: 12 },
      { country: 'Canada', count: 15, percentage: 10 },
      { country: 'Other', count: 28, percentage: 17 },
    ],
    guestsByPurpose: [
      { purpose: 'Business', count: 68, percentage: 44 },
      { purpose: 'Leisure', count: 52, percentage: 33 },
      { purpose: 'Conference', count: 24, percentage: 15 },
      { purpose: 'Other', count: 12, percentage: 8 },
    ],
  };

  res.json({
    success: true,
    data: guestData,
  });
});

// Report: Booking Sources
router.get('/reports/sources', authenticateDemo, (_req: Request, res: Response) => {
  const sourceData = [
    { source: 'Direct Website', bookings: 42, revenue: 12600, percentage: 35 },
    { source: 'Booking.com', bookings: 28, revenue: 7560, percentage: 23 },
    { source: 'Expedia', bookings: 18, revenue: 4860, percentage: 15 },
    { source: 'Phone/Email', bookings: 15, revenue: 5250, percentage: 13 },
    { source: 'Walk-in', bookings: 10, revenue: 2800, percentage: 8 },
    { source: 'Corporate', bookings: 7, revenue: 3150, percentage: 6 },
  ];

  res.json({
    success: true,
    data: sourceData,
  });
});

// Middleware to authenticate demo requests
function authenticateDemo(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    const user = mockUsers.find(u => u.id === decoded.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    (req as any).user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

// ==================== REVIEWS ====================
const mockReviews = [
  {
    id: 'rev-1',
    guestId: 'guest-1',
    guestName: 'John Smith',
    bookingId: 'booking-1',
    rating: 5,
    title: 'Exceptional Stay!',
    comment: 'The staff went above and beyond. Room was spotless and the amenities were fantastic. Will definitely return!',
    source: 'DIRECT',
    response: 'Thank you so much for your kind words! We look forward to welcoming you back.',
    respondedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'rev-2',
    guestId: 'guest-2',
    guestName: 'Sarah Johnson',
    bookingId: 'booking-2',
    rating: 4,
    title: 'Great location, minor issues',
    comment: 'Loved the central location and helpful front desk. AC was a bit noisy but overall a pleasant stay.',
    source: 'BOOKING_COM',
    response: null,
    respondedAt: null,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'rev-3',
    guestId: 'guest-3',
    guestName: 'Michael Chen',
    bookingId: 'booking-3',
    rating: 5,
    title: 'Perfect Business Trip',
    comment: 'Fast WiFi, quiet room, great breakfast. Everything a business traveler needs.',
    source: 'EXPEDIA',
    response: 'Thank you for choosing us for your business trip! Safe travels.',
    respondedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'rev-4',
    guestId: 'guest-4',
    guestName: 'Emma Wilson',
    bookingId: 'booking-4',
    rating: 4,
    title: 'Romantic Getaway',
    comment: 'Beautiful suite with city views. The spa was relaxing. Would recommend for couples.',
    source: 'TRIPADVISOR',
    response: null,
    respondedAt: null,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'rev-5',
    guestId: 'guest-5',
    guestName: 'David Brown',
    bookingId: 'booking-5',
    rating: 3,
    title: 'Average Experience',
    comment: 'Room was clean but dated. Check-in took longer than expected. Breakfast options were limited.',
    source: 'GOOGLE',
    response: 'We appreciate your feedback and are working to improve our check-in process.',
    respondedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'rev-6',
    guestId: 'guest-6',
    guestName: 'Lisa Martinez',
    bookingId: 'booking-6',
    rating: 5,
    title: 'Best Hotel in Town!',
    comment: 'From the warm welcome to the comfy bed, everything was perfect. The rooftop bar is a must-visit!',
    source: 'AIRBNB',
    response: null,
    respondedAt: null,
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
  },
];

router.get('/reviews', authenticateDemo, (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: mockReviews,
  });
});

router.patch('/reviews/:id/response', authenticateDemo, (req: Request, res: Response) => {
  const { id } = req.params;
  const { response } = req.body;

  const review = mockReviews.find(r => r.id === id);
  if (!review) {
    return res.status(404).json({ success: false, error: 'Review not found' });
  }

  review.response = response;
  review.respondedAt = new Date();
  review.updatedAt = new Date();

  res.json({ success: true, data: review });
});

// ==================== CONCIERGE ====================
const mockConciergeRequests = [
  {
    id: 'conc-1',
    guestId: 'guest-1',
    guestName: 'John Smith',
    roomNumber: '301',
    title: 'Restaurant Reservation',
    details: 'Please book a table for 2 at the rooftop restaurant for 7:30 PM tonight.',
    priority: 'MEDIUM',
    status: 'COMPLETED',
    assignedTo: 'user-2',
    assignedToName: 'Front Desk Manager',
    dueAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
  },
  {
    id: 'conc-2',
    guestId: 'guest-2',
    guestName: 'Sarah Johnson',
    roomNumber: '205',
    title: 'Airport Transfer',
    details: 'Need a car to the airport tomorrow at 6 AM. Flight is at 9 AM.',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    assignedTo: 'user-3',
    assignedToName: 'Receptionist',
    dueAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
    completedAt: null,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000),
  },
  {
    id: 'conc-3',
    guestId: 'guest-3',
    guestName: 'Michael Chen',
    roomNumber: '412',
    title: 'Extra Pillows',
    details: 'Could I please get 2 extra pillows delivered to my room?',
    priority: 'LOW',
    status: 'PENDING',
    assignedTo: null,
    assignedToName: null,
    dueAt: new Date(Date.now() + 1 * 60 * 60 * 1000),
    completedAt: null,
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000),
  },
  {
    id: 'conc-4',
    guestId: 'guest-4',
    guestName: 'Emma Wilson',
    roomNumber: '501',
    title: 'Spa Appointment',
    details: 'Would like to book a couples massage for this afternoon around 3 PM.',
    priority: 'MEDIUM',
    status: 'IN_PROGRESS',
    assignedTo: 'user-2',
    assignedToName: 'Front Desk Manager',
    dueAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
    completedAt: null,
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 45 * 60 * 1000),
  },
  {
    id: 'conc-5',
    guestId: 'guest-5',
    guestName: 'David Brown',
    roomNumber: '102',
    title: 'Late Checkout Request',
    details: 'Can I get a late checkout until 2 PM? My flight is not until evening.',
    priority: 'URGENT',
    status: 'PENDING',
    assignedTo: null,
    assignedToName: null,
    dueAt: new Date(Date.now() + 30 * 60 * 1000),
    completedAt: null,
    createdAt: new Date(Date.now() - 15 * 60 * 1000),
    updatedAt: new Date(Date.now() - 15 * 60 * 1000),
  },
  {
    id: 'conc-6',
    guestId: 'guest-6',
    guestName: 'Lisa Martinez',
    roomNumber: '308',
    title: 'City Tour Booking',
    details: 'Interested in the half-day city tour for tomorrow. 2 adults.',
    priority: 'MEDIUM',
    status: 'COMPLETED',
    assignedTo: 'user-3',
    assignedToName: 'Receptionist',
    dueAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    completedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
];

router.get('/concierge/requests', authenticateDemo, (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: mockConciergeRequests,
  });
});

router.patch('/concierge/requests/:id', authenticateDemo, (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  const request = mockConciergeRequests.find(r => r.id === id);
  if (!request) {
    return res.status(404).json({ success: false, error: 'Request not found' });
  }

  Object.assign(request, updates, { updatedAt: new Date() });

  if (updates.status === 'COMPLETED') {
    request.completedAt = new Date();
  }

  res.json({ success: true, data: request });
});

router.post('/concierge/requests', authenticateDemo, (req: Request, res: Response) => {
  const { title, details, priority, dueAt, guestId, roomNumber, source, notifySupport } = req.body;

  const newRequest = {
    id: `conc-${Date.now()}`,
    guestId: guestId || 'guest-new',
    guestName: 'Walk-in Guest',
    roomNumber: roomNumber || 'N/A',
    title,
    details,
    priority: priority || 'MEDIUM',
    status: 'PENDING',
    assignedTo: null,
    assignedToName: null,
    dueAt: dueAt ? new Date(dueAt) : new Date(Date.now() + 2 * 60 * 60 * 1000),
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  mockConciergeRequests.unshift(newRequest);

  const shouldNotifySupport =
    notifySupport === true ||
    String(source || '').toUpperCase() === 'CHATBOT' ||
    String(title || '').toLowerCase().includes('chatbot handoff');

  if (shouldNotifySupport) {
    const emails =
      config.supportNotifyEmails.length > 0
        ? config.supportNotifyEmails
        : config.accessRequestNotifyEmails;
    const phones = config.supportNotifyPhones;
    const conciergeUrl = `${config.appUrl}/concierge`;

    if (emails.length > 0) {
      const { html, text } = renderLafloEmail({
        preheader: 'New chatbot handoff requires human support follow-up.',
        title: 'New chatbot handoff request',
        intro: 'A user escalated a chatbot conversation to human support.',
        meta: [
          { label: 'Hotel', value: mockHotel.name },
          { label: 'Requester', value: 'demo-user@laflo.app' },
          { label: 'Priority', value: priority || 'MEDIUM' },
          { label: 'Request ID', value: newRequest.id },
          { label: 'Title', value: title || 'Chatbot handoff' },
        ],
        bodyHtml: details
          ? `<p style="margin:0;"><strong>Issue summary:</strong></p><p style="margin:6px 0 0;">${escapeEmailText(String(details).slice(0, 500))}</p>`
          : undefined,
        cta: { label: 'Open Concierge', url: conciergeUrl },
        footerNote: 'This alert was generated from chatbot-to-human escalation.',
      });

      sendEmail({
        to: emails.join(','),
        subject: `[LaFlo] Chatbot handoff: ${title || 'New support request'}`,
        html,
        text,
      }).catch((error) => {
        console.error('[CONCIERGE] Failed to send handoff email notifications:', error);
      });
    }

    if (phones.length > 0) {
      const smsMessage = `LaFlo support alert: ${title || 'New chatbot handoff'} (${priority || 'MEDIUM'}). Open ${conciergeUrl}`;
      Promise.all(phones.map((to: string) => sendSms({ to, message: smsMessage }))).catch((error) => {
        console.error('[CONCIERGE] Failed to send handoff SMS notifications:', error);
      });
    }
  }

  res.status(201).json({ success: true, data: newRequest });
});

// Broadcast function for access requests (placeholder - can be enhanced with WebSocket later)
function broadcastAccessRequests() {
  console.log('[BROADCAST] Access requests updated, clients should refresh');
}

export { mockAccessRequests, mockAccessRequestReplies, saveDemoStore, broadcastAccessRequests };
export default router;

