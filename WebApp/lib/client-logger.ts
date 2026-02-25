/**
 * Client-side logging utility with Betterstack (Logtail) integration
 * Browser-compatible version of the server logger
 */

import { Logtail } from '@logtail/browser';

// Log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Context type for structured logging
export interface LogContext {
  [key: string]: any;
}

class ClientLogger {
  private logtail: Logtail | null = null;
  private enabled: boolean = false;

  constructor() {
    // Only initialize on client-side
    if (typeof window === 'undefined') {
      return;
    }

    // Get source token from environment (injected via Next.js public env vars)
    const sourceToken = process.env.NEXT_PUBLIC_BETTERSTACK_SOURCE_TOKEN;
    
    if (sourceToken) {
      try {
        this.logtail = new Logtail(sourceToken);
        this.enabled = true;
      } catch (error) {
        console.warn('Failed to initialize Logtail (client):', error);
        this.enabled = false;
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.warn('NEXT_PUBLIC_BETTERSTACK_SOURCE_TOKEN not found. Client logging will fall back to console only.');
      }
    }
  }

  /**
   * Enrich log context with browser-specific metadata
   */
  private enrichContext(context: LogContext = {}): LogContext {
    if (typeof window === 'undefined') {
      return context;
    }

    return {
      ...context,
      environment: process.env.NODE_ENV || 'unknown',
      timestamp: new Date().toISOString(),
      service: 'webapp-client',
      browser: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      },
    };
  }

  /**
   * Log a debug message
   */
  debug(message: string, context: LogContext = {}): void {
    const enrichedContext = this.enrichContext(context);
    
    console.debug(`[DEBUG] ${message}`, enrichedContext);
    
    if (this.enabled && this.logtail) {
      try {
        this.logtail.debug(message, enrichedContext);
      } catch (error) {
        console.error('Failed to send debug log to Logtail:', error);
      }
    }
  }

  /**
   * Log an info message
   */
  info(message: string, context: LogContext = {}): void {
    const enrichedContext = this.enrichContext(context);
    
    console.info(`[INFO] ${message}`, enrichedContext);
    
    if (this.enabled && this.logtail) {
      try {
        this.logtail.info(message, enrichedContext);
      } catch (error) {
        console.error('Failed to send info log to Logtail:', error);
      }
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, context: LogContext = {}): void {
    const enrichedContext = this.enrichContext(context);
    
    console.warn(`[WARN] ${message}`, enrichedContext);
    
    if (this.enabled && this.logtail) {
      try {
        this.logtail.warn(message, enrichedContext);
      } catch (error) {
        console.error('Failed to send warn log to Logtail:', error);
      }
    }
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, context: LogContext = {}): void {
    const enrichedContext = this.enrichContext({
      ...context,
      ...(error && {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
      }),
    });
    
    console.error(`[ERROR] ${message}`, enrichedContext);
    
    if (this.enabled && this.logtail) {
      try {
        this.logtail.error(message, enrichedContext);
      } catch (err) {
        console.error('Failed to send error log to Logtail:', err);
      }
    }
  }
}

// Export singleton instance
export const clientLogger = new ClientLogger();

// Export convenience functions
export const logDebug = (message: string, context?: LogContext) => clientLogger.debug(message, context);
export const logInfo = (message: string, context?: LogContext) => clientLogger.info(message, context);
export const logWarn = (message: string, context?: LogContext) => clientLogger.warn(message, context);
export const logError = (message: string, error?: Error, context?: LogContext) => clientLogger.error(message, error, context);
