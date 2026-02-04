import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../config/logger.js';
import { config } from '../config/index.js';
import { ApiResponse } from '../types/index.js';

/**
 * Custom application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors?: { field: string; message: string }[];

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    errors?: { field: string; message: string }[]
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  constructor(message: string, errors?: { field: string; message: string }[]) {
    super(message, 400, true, errors);
  }
}

/**
 * Unauthorized error
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

/**
 * Forbidden error
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

/**
 * Conflict error (e.g., duplicate entry)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409);
  }
}

/**
 * Handle Zod validation errors
 */
function handleZodError(error: ZodError): AppError {
  const errors = error.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));

  return new ValidationError('Validation failed', errors);
}

/**
 * Handle Prisma errors
 */
function handlePrismaError(error: Prisma.PrismaClientKnownRequestError): AppError {
  switch (error.code) {
    case 'P2002': {
      const target = (error.meta?.target as string[]) || ['field'];
      return new ConflictError(`Duplicate value for ${target.join(', ')}`);
    }
    case 'P2025':
      return new NotFoundError('Record');
    case 'P2003':
      return new ValidationError('Invalid reference - related record not found');
    case 'P2014':
      return new ValidationError('Invalid relation');
    default:
      logger.error('Unhandled Prisma error:', { code: error.code, meta: error.meta });
      return new AppError('Database error', 500);
  }
}

/**
 * 404 handler for unmatched routes
 */
export function notFoundHandler(
  req: Request,
  res: Response<ApiResponse>,
  _next: NextFunction
): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
}

/**
 * Global error handler
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response<ApiResponse>,
  _next: NextFunction
): void {
  let error: AppError;

  // Convert known errors to AppError
  if (err instanceof AppError) {
    error = err;
  } else if (err instanceof ZodError) {
    error = handleZodError(err);
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    error = handlePrismaError(err);
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    error = new ValidationError('Invalid data provided');
  } else {
    // Unknown error
    error = new AppError(
      config.nodeEnv === 'production' ? 'Internal server error' : err.message,
      500,
      false
    );
  }

  // Log error
  if (!error.isOperational) {
    logger.error('Unexpected error:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  } else if (error.statusCode >= 500) {
    logger.error('Server error:', {
      message: error.message,
      statusCode: error.statusCode,
      path: req.path,
      method: req.method,
    });
  }

  // Send response
  const response: ApiResponse = {
    success: false,
    error: error.message,
  };

  if (error.errors) {
    response.errors = error.errors;
  }

  // Include stack trace in development
  if (config.nodeEnv === 'development' && err.stack) {
    (response as Record<string, unknown>).stack = err.stack;
  }

  res.status(error.statusCode).json(response);
}
