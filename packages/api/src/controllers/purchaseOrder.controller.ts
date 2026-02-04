import { Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { prisma } from '../config/database.js';
import { sendEmail } from '../services/email.service.js';

function generateReference() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PO-${timestamp}-${random}`;
}

function buildCsv(items: { name: string; unit: string; quantity: number; unitCost: number; totalCost: number }[]) {
  const lines = [
    'Item,Unit,Quantity,Unit Cost,Total Cost',
    ...items.map((item) =>
      `${item.name},${item.unit},${item.quantity},${item.unitCost.toFixed(2)},${item.totalCost.toFixed(2)}`
    ),
  ];
  return lines.join('\n');
}

function buildPdfBuffer(order: {
  reference: string;
  vendorName: string;
  vendorEmail: string | null;
  notes: string | null;
  totalCost: number;
  items: { name: string; unit: string; quantity: number; unitCost: number; totalCost: number }[];
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Purchase Order', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#475569');
    doc.text(`Reference: ${order.reference}`);
    doc.text(`Vendor: ${order.vendorName}`);
    doc.text(`Email: ${order.vendorEmail || '-'}`);
    if (order.notes) {
      doc.moveDown(0.4);
      doc.text(`Notes: ${order.notes}`);
    }
    doc.moveDown(0.8);

    doc.fillColor('#0f172a').fontSize(11);
    doc.text('Item', 48, doc.y, { continued: true, width: 220 });
    doc.text('Unit', { continued: true, width: 80 });
    doc.text('Qty', { continued: true, width: 60 });
    doc.text('Unit Cost', { continued: true, width: 80 });
    doc.text('Total', { width: 80 });
    doc.moveDown(0.3);
    doc.moveTo(48, doc.y).lineTo(548, doc.y).strokeColor('#e2e8f0').stroke();
    doc.moveDown(0.3);

    order.items.forEach((item) => {
      doc.fillColor('#0f172a').fontSize(10);
      doc.text(item.name, 48, doc.y, { continued: true, width: 220 });
      doc.text(item.unit, { continued: true, width: 80 });
      doc.text(item.quantity.toString(), { continued: true, width: 60 });
      doc.text(item.unitCost.toFixed(2), { continued: true, width: 80 });
      doc.text(item.totalCost.toFixed(2), { width: 80 });
    });

    doc.moveDown(0.8);
    doc.fontSize(12).fillColor('#0f172a').text(`Total: ${order.totalCost.toFixed(2)}`, {
      align: 'right',
    });
    doc.end();
  });
}

export async function listPurchaseOrders(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const orders = await prisma.purchaseOrder.findMany({
      where: { hotelId },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
}

export async function createPurchaseOrder(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const { vendorName, vendorEmail, notes, items } = req.body;

    const reference = generateReference();
    const normalizedItems = (items || []).map((item: any) => ({
      inventoryItemId: item.inventoryItemId || null,
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalCost: item.unitCost * item.quantity,
    }));

    const totalCost = normalizedItems.reduce((sum: number, item: any) => sum + item.totalCost, 0);

    const order = await prisma.purchaseOrder.create({
      data: {
        hotelId,
        requestedById: userId,
        reference,
        vendorName,
        vendorEmail,
        notes,
        totalCost,
        items: {
          create: normalizedItems,
        },
      },
      include: { items: true },
    });

    res.status(201).json({ success: true, data: order, message: 'Purchase order created' });
  } catch (error) {
    next(error);
  }
}

export async function getPurchaseOrder(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const order = await prisma.purchaseOrder.findFirst({
      where: { id, hotelId },
      include: { items: true },
    });

    if (!order) {
      res.status(404).json({ success: false, error: 'Purchase order not found' });
      return;
    }

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

export async function exportPurchaseOrder(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;
    const format = (req.query.format as string) || 'csv';

    const order = await prisma.purchaseOrder.findFirst({
      where: { id, hotelId },
      include: { items: true },
    });

    if (!order) {
      res.status(404).json({ success: false, error: 'Purchase order not found' });
      return;
    }

    const items = order.items.map((item) => ({
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      unitCost: Number(item.unitCost),
      totalCost: Number(item.totalCost),
    }));

    if (format === 'pdf') {
      const pdfBuffer = await buildPdfBuffer({
        reference: order.reference,
        vendorName: order.vendorName,
        vendorEmail: order.vendorEmail,
        notes: order.notes,
        totalCost: Number(order.totalCost),
        items,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="purchase-order-${order.reference}.pdf"`);
      res.send(pdfBuffer);
      return;
    }

    const csv = buildCsv(items);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="purchase-order-${order.reference}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
}

export async function emailPurchaseOrder(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;
    const { recipientEmail } = req.body;

    const order = await prisma.purchaseOrder.findFirst({
      where: { id, hotelId },
      include: { items: true },
    });

    if (!order) {
      res.status(404).json({ success: false, error: 'Purchase order not found' });
      return;
    }

    const resolvedRecipient = recipientEmail || order.vendorEmail;
    if (!resolvedRecipient) {
      res.status(400).json({ success: false, error: 'Recipient email is required' });
      return;
    }

    const items = order.items.map((item) => ({
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      unitCost: Number(item.unitCost),
      totalCost: Number(item.totalCost),
    }));
    const csv = buildCsv(items);
    const pdfBuffer = await buildPdfBuffer({
      reference: order.reference,
      vendorName: order.vendorName,
      vendorEmail: order.vendorEmail,
      notes: order.notes,
      totalCost: Number(order.totalCost),
      items,
    });

    await sendEmail({
      to: resolvedRecipient,
      subject: `Purchase order ${order.reference}`,
      html: `
        <p>Attached is purchase order ${order.reference}.</p>
        <p>Total cost: ${Number(order.totalCost).toFixed(2)}</p>
      `,
      text: `Purchase order ${order.reference} attached.`,
      attachments: [
        {
          filename: `purchase-order-${order.reference}.csv`,
          content: csv,
          contentType: 'text/csv',
        },
        {
          filename: `purchase-order-${order.reference}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    res.json({ success: true, message: 'Purchase order emailed' });
  } catch (error) {
    next(error);
  }
}
