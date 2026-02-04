import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { prisma } from '../config/database.js';

export async function listInventoryItems(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { search, active } = req.query;

    const items = await prisma.inventoryItem.findMany({
      where: {
        hotelId,
        isActive: active === 'false' ? false : true,
        ...(search
          ? {
              OR: [
                { name: { contains: String(search), mode: 'insensitive' } },
                { category: { contains: String(search), mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

export async function createInventoryItem(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const item = await prisma.inventoryItem.create({
      data: {
        hotelId,
        name: req.body.name,
        category: req.body.category,
        unit: req.body.unit,
        quantityOnHand: req.body.quantityOnHand,
        reorderPoint: req.body.reorderPoint ?? 0,
        cost: req.body.cost ?? 0,
        location: req.body.location || null,
        isActive: true,
      },
    });

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function updateInventoryItem(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const existing = await prisma.inventoryItem.findFirst({ where: { id, hotelId } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Inventory item not found' });
      return;
    }

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        name: req.body.name ?? existing.name,
        category: req.body.category ?? existing.category,
        unit: req.body.unit ?? existing.unit,
        quantityOnHand: req.body.quantityOnHand ?? existing.quantityOnHand,
        reorderPoint: req.body.reorderPoint ?? existing.reorderPoint,
        cost: req.body.cost ?? existing.cost,
        location: req.body.location ?? existing.location,
        isActive: req.body.isActive ?? existing.isActive,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

export async function deactivateInventoryItem(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const existing = await prisma.inventoryItem.findFirst({ where: { id, hotelId } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Inventory item not found' });
      return;
    }

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}
