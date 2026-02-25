import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/db/utils';
import { getConfiguredProviders } from '@/lib/provider-config';
import { logger } from '@/lib/logger';

/**
 * Betterstack-specific health check endpoint
 * Returns 200 OK when all critical services are healthy
 */
export async function GET() {
  const startTime = Date.now();
  
  try {
    const checks = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: false,
        aiProvider: false,
      },
    };

    // Test database connection
    try {
      checks.services.database = await testConnection();
      if (!checks.services.database) {
        checks.status = 'degraded';
        await logger.warn('Health check: Database connection failed', {
          healthCheck: true,
          service: 'database',
        });
      }
    } catch (error) {
      checks.services.database = false;
      checks.status = 'unhealthy';
      await logger.error(
        'Health check: Database error',
        error instanceof Error ? error : new Error(String(error)),
        { healthCheck: true, service: 'database' }
      );
    }

    // Check if at least one AI provider is configured
    try {
      const configuredProviders = getConfiguredProviders();
      checks.services.aiProvider = configuredProviders.length > 0;
      if (!checks.services.aiProvider) {
        checks.status = 'degraded';
        await logger.warn('Health check: No AI providers configured', {
          healthCheck: true,
          service: 'aiProvider',
        });
      }
    } catch (error) {
      checks.services.aiProvider = false;
      checks.status = 'degraded';
      await logger.error(
        'Health check: AI provider check failed',
        error instanceof Error ? error : new Error(String(error)),
        { healthCheck: true, service: 'aiProvider' }
      );
    }

    const duration = Date.now() - startTime;
    const isHealthy = checks.status === 'healthy';

    // Log health check result
    await logger.info(`Health check completed: ${checks.status}`, {
      healthCheck: true,
      duration: `${duration}ms`,
      ...checks.services,
    });

    // Return appropriate status code
    // 200 = healthy, 503 = degraded/unhealthy (triggers Betterstack alert)
    return NextResponse.json(
      {
        ...checks,
        responseTime: `${duration}ms`,
      },
      { status: isHealthy ? 200 : 503 }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logger.error(
      'Health check: Critical failure',
      error instanceof Error ? error : new Error(String(error)),
      { healthCheck: true, duration: `${duration}ms` }
    );

    return NextResponse.json(
      {
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
        responseTime: `${duration}ms`,
      },
      { status: 500 }
    );
  }
}
