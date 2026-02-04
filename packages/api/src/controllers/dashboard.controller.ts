import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse, DashboardSummary, DashboardArrival, DashboardDeparture, HousekeepingSummary } from '../types/index.js';
import * as dashboardService from '../services/dashboard.service.js';

/**
 * Get dashboard summary
 */
export async function getSummary(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<DashboardSummary>>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const summary = await dashboardService.getDashboardSummary(hotelId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get today's arrivals
 */
export async function getTodayArrivals(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<DashboardArrival[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const arrivals = await dashboardService.getTodayArrivals(hotelId);

    res.json({
      success: true,
      data: arrivals,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get today's departures
 */
export async function getTodayDepartures(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<DashboardDeparture[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const departures = await dashboardService.getTodayDepartures(hotelId);

    res.json({
      success: true,
      data: departures,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get housekeeping summary
 */
export async function getHousekeepingSummary(
  req: AuthenticatedRequest,
  res: Response<ApiResponse<HousekeepingSummary>>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const summary = await dashboardService.getHousekeepingSummary(hotelId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get priority alerts
 */
export async function getPriorities(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const priorities = await dashboardService.getPriorityAlerts(hotelId);

    res.json({
      success: true,
      data: priorities,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get occupancy trend
 */
export async function getOccupancyTrend(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const days = parseInt(req.query.days as string) || 7;
    const trend = await dashboardService.getOccupancyTrend(hotelId, days);

    res.json({
      success: true,
      data: trend,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get booking mix by source
 */
export async function getBookingMix(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const mix = await dashboardService.getBookingMix(hotelId);

    res.json({
      success: true,
      data: mix,
    });
  } catch (error) {
    next(error);
  }
}
