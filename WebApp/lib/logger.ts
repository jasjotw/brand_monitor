/**
 * Centralized logging utility with Betterstack (Logtail) integration
 * Supports all log levels with automatic context enrichment
 */

import { Logtail } from '@logtail/node';

// Log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Context type for structured logging
export interface LogContext {
  [key: string]: any;
}

class Logger {
  private logtail: Logtail | null = null;
  private enabled: boolean = false;

  constructor() {
    const sourceToken = process.env.BETTERSTACK_SOURCE_TOKEN;
    
    console.log('[Logger] Initializing Betterstack logger...');
    console.log('[Logger] Source token present:', !!sourceToken);
    
    if (sourceToken) {
      try {
        this.logtail = new Logtail(sourceToken);
        this.enabled = true;
        console.log('[Logger] ✅ Betterstack logging ENABLED');
      } catch (error) {
        console.warn('[Logger] ❌ Failed to initialize Logtail:', error);
        this.enabled = false;
      }
    } else {
      console.warn('[Logger] ⚠️  BETTERSTACK_SOURCE_TOKEN not found. Logging will fall back to console only.');
    }
  }

  /**
   * Enrich log context with common metadata
   */
  private enrichContext(context: LogContext = {}): LogContext {
    return {
      ...context,
      environment: process.env.NODE_ENV || 'unknown',
      timestamp: new Date().toISOString(),
      service: 'webapp',
    };
  }

  /**
   * Log a debug message
   */
  async debug(message: string, context: LogContext = {}): Promise<void> {
    const enrichedContext = this.enrichContext(context);
    
    console.debug(`[DEBUG] ${message}`, enrichedContext);
    
    if (this.enabled && this.logtail) {
      try {
        await this.logtail.debug(message, enrichedContext);
        await this.logtail.flush(); // Flush immediately to send to Betterstack
      } catch (error) {
        console.error('Failed to send debug log to Logtail:', error);
      }
    }
  }

  /**
   * Log an info message
   */
  async info(message: string, context: LogContext = {}): Promise<void> {
    const enrichedContext = this.enrichContext(context);
    
    console.info(`[INFO] ${message}`, enrichedContext);
    
    if (this.enabled && this.logtail) {
      try {
        await this.logtail.info(message, enrichedContext);
        await this.logtail.flush(); // Flush immediately to send to Betterstack
      } catch (error) {
        console.error('Failed to send info log to Logtail:', error);
      }
    }
  }

  /**
   * Log a warning message
   */
  async warn(message: string, context: LogContext = {}): Promise<void> {
    const enrichedContext = this.enrichContext(context);
    
    console.warn(`[WARN] ${message}`, enrichedContext);
    
    if (this.enabled && this.logtail) {
      try {
        await this.logtail.warn(message, enrichedContext);
        await this.logtail.flush(); // Flush immediately to send to Betterstack
      } catch (error) {
        console.error('Failed to send warn log to Logtail:', error);
      }
    }
  }

  /**
   * Log an error message
   */
  async error(message: string, error?: Error, context: LogContext = {}): Promise<void> {
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
        await this.logtail.error(message, enrichedContext);
        await this.logtail.flush(); // Flush immediately to send to Betterstack
      } catch (err) {
        console.error('Failed to send error log to Logtail:', err);
      }
    }
  }

  /**
   * Flush all pending logs
   */
  async flush(): Promise<void> {
    if (this.enabled && this.logtail) {
      try {
        await this.logtail.flush();
      } catch (error) {
        console.error('Failed to flush Logtail logs:', error);
      }
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const logDebug = (message: string, context?: LogContext) => logger.debug(message, context);
export const logInfo = (message: string, context?: LogContext) => logger.info(message, context);
export const logWarn = (message: string, context?: LogContext) => logger.warn(message, context);
export const logError = (message: string, error?: Error, context?: LogContext) => logger.error(message, error, context);
