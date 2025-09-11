// Logging utility for CV-Connect backend
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');
  }

  shouldLog(level) {
    const levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    return levels[level] <= levels[this.logLevel];
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (data) {
      return `${prefix} ${message} ${JSON.stringify(data)}`;
    }
    return `${prefix} ${message}`;
  }

  error(message, data = null) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, data));
    }
  }

  warn(message, data = null) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  info(message, data = null) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, data));
    }
  }

  debug(message, data = null) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, data));
    }
  }

  // Special methods for different types of logging
  auth(message, data = null) {
    if (isDevelopment) {
      this.debug(`[AUTH] ${message}`, data);
    }
  }

  db(message, data = null) {
    if (isDevelopment) {
      this.debug(`[DB] ${message}`, data);
    }
  }

  api(message, data = null) {
    if (isDevelopment) {
      this.debug(`[API] ${message}`, data);
    }
  }

  cv(message, data = null) {
    if (isDevelopment) {
      this.debug(`[CV] ${message}`, data);
    }
  }

  // Production-safe logging (always logs)
  production(message, data = null) {
    console.log(this.formatMessage('info', message, data));
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;
