import { Request, Response, NextFunction } from 'express';
import { logger, errorLogger } from '@/utils/logger';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

export class CustomError extends Error implements AppError {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'INTERNAL_ERROR';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends CustomError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
  details?: any;
}

export class NotFoundError extends CustomError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends CustomError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends CustomError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends CustomError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends CustomError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export const errorHandler = (
  error: AppError | Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  _next: NextFunction
): void => {
  let appError: AppError;

  // Log the error
  errorLogger(error, req);

  // Handle different types of errors
  if (error instanceof CustomError) {
    appError = error;
  } else if (error instanceof ZodError) {
    appError = new ValidationError('Validation failed', error.errors);
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    appError = handlePrismaError(error);
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    logger.error({ 
      error: error.message, 
      stack: error.stack,
      name: error.name 
    }, 'Prisma validation error details');
    appError = new ValidationError(`Database validation failed: ${error.message}`);
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    appError = new CustomError('Database connection failed', 503, 'DATABASE_ERROR');
  } else if (error.name === 'JsonWebTokenError') {
    appError = new UnauthorizedError('Invalid token');
  } else if (error.name === 'TokenExpiredError') {
    appError = new UnauthorizedError('Token expired');
  } else if (error.name === 'SyntaxError' && 'body' in error) {
    appError = new ValidationError('Invalid JSON payload');
  } else {
    // Default error
    appError = new CustomError(
      process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : error.message,
      500,
      'INTERNAL_ERROR'
    );
  }

  // Send error response
  const errorResponse: any = {
    success: false,
    error: appError.code,
    message: appError.message,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  };

  // Add request ID if available
  if ((req as any).requestId) {
    errorResponse.requestId = (req as any).requestId;
  }

  // Add details for validation errors
  if (appError instanceof ValidationError && appError.details) {
    errorResponse.details = appError.details;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }

  res.status(appError.statusCode).json(errorResponse);
};

function handlePrismaError(error: Prisma.PrismaClientKnownRequestError): AppError {
  switch (error.code) {
    case 'P2002':
      return new ConflictError('Unique constraint violation');
    case 'P2003':
      return new ValidationError('Foreign key constraint violation');
    case 'P2025':
      return new NotFoundError('Record');
    case 'P2021':
      return new CustomError('Database table not found', 500, 'DATABASE_ERROR');
    case 'P2022':
      return new CustomError('Database column not found', 500, 'DATABASE_ERROR');
    default:
      return new CustomError('Database error', 500, 'DATABASE_ERROR');
  }
}

export const notFoundHandler = (req: Request, res: Response): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.path}`);
  
  res.status(404).json({
    success: false,
    error: error.code,
    message: error.message,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    requestId: (req as any).requestId,
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
