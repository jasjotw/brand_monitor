/**
 * API route error handler middleware
 * Wraps API routes with automatic error catching and logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';
import { createErrorResponse } from './error-utils';

type ApiHandler = (
  request: NextRequest,
  context?: any
) => Promise<NextResponse> | NextResponse;

/**
 * Extract user information from request if available
 */
function extractUserContext(request: NextRequest): Record<string, any> {
  // Try to get user from headers or session
  // This will depend on your auth setup
  const userId = request.headers.get('x-user-id') || 'anonymous';
  
  return {
    userId,
    method: request.method,
    url: request.url,
    userAgent: request.headers.get('user-agent') || 'unknown',
    ip: request.headers.get('x-forwarded-for') || 
        request.headers.get('x-real-ip') || 
        'unknown',
  };
}

/**
 * Wrap an API route handler with error handling and logging
 */
export function withErrorHandler(handler: ApiHandler): ApiHandler {
  return async (request: NextRequest, context?: any) => {
    try {
      const userContext = extractUserContext(request);
      
      // Log the API request
      await logger.info(`API Request: ${request.method} ${request.url}`, {
        ...userContext,
        route: request.url,
      });

      const response = await handler(request, context);
      
      return response;
    } catch (error) {
      const userContext = extractUserContext(request);
      
      // Log the error with full context
      await logger.error(
        `API Error: ${request.method} ${request.url}`,
        error instanceof Error ? error : new Error(String(error)),
        {
          ...userContext,
          route: request.url,
        }
      );

      // Return user-friendly error response
      const errorResponse = createErrorResponse(
        error instanceof Error ? error : new Error(String(error)),
        process.env.NODE_ENV === 'development'
      );

      return NextResponse.json(errorResponse, { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  };
}

/**
 * Utility to log an operation with timing information
 */
export async function logOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  context: Record<string, any> = {}
): Promise<T> {
  const startTime = Date.now();
  
  try {
    await logger.info(`Starting: ${operationName}`, context);
    const result = await operation();
    const duration = Date.now() - startTime;
    
    await logger.info(`Completed: ${operationName}`, {
      ...context,
      duration: `${duration}ms`,
      success: true,
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logger.error(
      `Failed: ${operationName}`,
      error instanceof Error ? error : new Error(String(error)),
      {
        ...context,
        duration: `${duration}ms`,
        success: false,
      }
    );
    
    throw error;
  }
}
