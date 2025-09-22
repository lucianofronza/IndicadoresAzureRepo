import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: process.env.SERVICE_NAME || 'sync-service',
    version: process.env.npm_package_version || '1.0.0',
  },
});

// Structured logging helpers
export const logSyncEvent = (event: string, data: any) => {
  logger.info({
    event,
    ...data,
  }, `Sync event: ${event}`);
};

export const logSchedulerEvent = (event: string, data: any) => {
  logger.info({
    event,
    ...data,
  }, `Scheduler event: ${event}`);
};

export const logError = (error: Error, context?: any) => {
  logger.error({
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  }, 'Error occurred');
};

export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  logger.info({
    operation,
    duration,
    ...metadata,
  }, `Performance: ${operation} took ${duration}ms`);
};
