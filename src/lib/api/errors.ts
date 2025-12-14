/**
 * API error handling utilities for consistent error responses across all endpoints.
 * 
 * Usage in API routes:
 * 
 *   import { ApiError, handleApiError } from '~/lib/api/errors';
 * 
 *   export async function GET(req: Request) {
 *     try {
 *       const user = await getUserByFid(fid);
 *       if (!user) throw new ApiError('User not found', 404);
 *       return NextResponse.json(user);
 *     } catch (error) {
 *       return handleApiError(error);
 *     }
 *   }
 */

import { NextResponse } from 'next/server';
import { logger } from '../logger';

/**
 * Custom error class for API errors with HTTP status codes
 */
export class ApiError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Common API errors as factory functions
 */
export const ApiErrors = {
  NotFound: (resource: string = 'Resource') => 
    new ApiError(`${resource} not found`, 404),
  
  BadRequest: (message: string = 'Invalid request') => 
    new ApiError(message, 400),
  
  Unauthorized: (message: string = 'Unauthorized') => 
    new ApiError(message, 401),
  
  Forbidden: (message: string = 'Forbidden') => 
    new ApiError(message, 403),
  
  InsufficientResources: (resource: string) => 
    new ApiError(`Insufficient ${resource}`, 400),
  
  InvalidParameter: (param: string) => 
    new ApiError(`Invalid parameter: ${param}`, 400),
  
  AlreadyExists: (resource: string) => 
    new ApiError(`${resource} already exists`, 409),
  
  InternalError: (message: string = 'Internal server error') => 
    new ApiError(message, 500)
};

/**
 * Standard error response format
 */
interface ErrorResponse {
  error: string;
  message?: string;
  details?: any;
  timestamp?: string;
}

/**
 * Handle any error and return appropriate NextResponse
 * Logs errors appropriately based on severity
 */
export function handleApiError(error: unknown, context?: string): NextResponse {
  // Handle ApiError instances
  if (error instanceof ApiError) {
    const response: ErrorResponse = {
      error: error.message,
      timestamp: new Date().toISOString()
    };

    if (error.details) {
      response.details = error.details;
    }

    // Log based on severity
    if (error.statusCode >= 500) {
      logger.error(`API Error (${context || 'unknown'})`, error);
    } else if (error.statusCode >= 400) {
      logger.warn(`API Warning (${context || 'unknown'})`, { message: error.message, statusCode: error.statusCode });
    }

    return NextResponse.json(response, { status: error.statusCode });
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    logger.error(`Unexpected error (${context || 'unknown'})`, error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }

  // Handle unknown errors
  logger.error(`Unknown error type (${context || 'unknown'})`, error);
  return NextResponse.json(
    {
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    },
    { status: 500 }
  );
}

/**
 * Validate required parameters and throw ApiError if missing
 */
export function requireParams(
  params: Record<string, any>,
  required: string[]
): void {
  const missing = required.filter(key => !params[key]);
  if (missing.length > 0) {
    throw ApiErrors.BadRequest(`Missing required parameters: ${missing.join(', ')}`);
  }
}

/**
 * Validate and parse FID from request
 */
export function validateFid(fidParam: string | null, defaultFid?: number): number {
  if (!fidParam && !defaultFid) {
    throw ApiErrors.InvalidParameter('fid');
  }

  const fid = fidParam ? parseInt(fidParam, 10) : defaultFid!;

  if (Number.isNaN(fid) || fid <= 0) {
    throw ApiErrors.InvalidParameter('fid must be a positive integer');
  }

  return fid;
}
