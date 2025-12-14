/**
 * Structured logging utility for consistent logging throughout the application.
 * 
 * This provides a simple console-based logging system with different severity levels
 * and structured metadata support. All logs include timestamps and optional context data.
 * 
 * Usage:
 *   logger.info('User logged in', { fid: 12345 });
 *   logger.error('Database connection failed', error, { query: 'SELECT ...' });
 *   logger.debug('Processing item', { itemId: 42 });
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

interface LogMeta {
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private minLevel: LogLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;

  /**
   * Format a log entry with timestamp, level, message, and optional metadata
   */
  private format(level: LogLevel, message: string, meta?: LogMeta): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  }

  /**
   * Check if a log level should be output based on minimum level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentIndex = levels.indexOf(level);
    const minIndex = levels.indexOf(this.minLevel);
    return currentIndex >= minIndex;
  }

  /**
   * Log debug information (only in development)
   */
  debug(message: string, meta?: LogMeta): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.format(LogLevel.DEBUG, message, meta));
    }
  }

  /**
   * Log general information
   */
  info(message: string, meta?: LogMeta): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.format(LogLevel.INFO, message, meta));
    }
  }

  /**
   * Log warnings
   */
  warn(message: string, meta?: LogMeta): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.format(LogLevel.WARN, message, meta));
    }
  }

  /**
   * Log errors with optional Error object
   */
  error(message: string, error?: Error | unknown, meta?: LogMeta): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorMeta = error instanceof Error 
        ? { ...meta, error: error.message, stack: error.stack }
        : { ...meta, error: String(error) };
      console.error(this.format(LogLevel.ERROR, message, errorMeta));
    }
  }

  /**
   * Log API requests (useful for debugging)
   */
  apiRequest(method: string, path: string, meta?: LogMeta): void {
    this.debug(`API ${method} ${path}`, meta);
  }

  /**
   * Log database queries (useful for debugging)
   */
  dbQuery(query: string, params?: any[]): void {
    this.debug('DB Query', { query, params });
  }
}

// Export singleton instance
export const logger = new Logger();
