import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * Test logging endpoint for verification
 * Tests different log levels and contexts
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get('level') || 'info';
  const testMessage = searchParams.get('message') || 'Test log message';

  try {
    const context = {
      testEndpoint: true,
      requestedLevel: level,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent') || 'unknown',
    };

    switch (level) {
      case 'debug':
        await logger.debug(testMessage, context);
        break;
      case 'info':
        await logger.info(testMessage, context);
        break;
      case 'warn':
        await logger.warn(testMessage, context);
        break;
      case 'error':
        await logger.error(
          testMessage,
          new Error('Test error for logging verification'),
          context
        );
        break;
      default:
        await logger.info(testMessage, context);
    }

    return NextResponse.json({
      success: true,
      message: `Log sent to Betterstack with level: ${level}`,
      logMessage: testMessage,
      context,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send log',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
