import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import * as floorService from '../services/floor.service.js';

export async function getFloors(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const floors = await floorService.getFloors(hotelId);
    res.json({ success: true, data: floors });
  } catch (error) {
    next(error);
  }
}

export async function createFloor(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const floor = await floorService.createFloor(hotelId, userId, req.body);

    res.status(201).json({
      success: true,
      data: floor,
      message: 'Floor created',
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteFloor(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const { id } = req.params;
    await floorService.deleteFloor(hotelId, userId, id);

    res.json({
      success: true,
      message: 'Floor deleted',
    });
  } catch (error) {
    next(error);
  }
}
