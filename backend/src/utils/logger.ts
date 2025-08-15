import pino from 'pino';

const logLevel = process.env['LOG_LEVEL'] || 'info';
const isDevelopment = process.env['NODE_ENV'] === 'development';

const transport = isDevelopment
  ? pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    })
  : undefined;

export const logger = pino(
  {
    level: logLevel,
    base: {
      pid: process.pid,
      hostname: process.env['HOSTNAME'] || 'unknown',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
  },
  transport
);

// Request logger middleware
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || generateRequestId();

  req.requestId = requestId;
  req.log = logger.child({ requestId });

  req.log.info({
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  }, 'Request started');

  res.on('finish', () => {
    const duration = Date.now() - start;
    req.log.info({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
    }, 'Request completed');
  });

  next();
};

// Error logger
export const errorLogger = (error: Error, req?: any) => {
  const logData: any = {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
  };

  if (req) {
    logData.requestId = req.requestId;
    logData.method = req.method;
    logData.url = req.url;
  }

  logger.error(logData, 'Application error');
};

// Generate request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Structured logging helpers
export const logContext = {
  database: (operation: string, table?: string) => ({
    component: 'database',
    operation,
    table,
  }),
  redis: (operation: string, key?: string) => ({
    component: 'redis',
    operation,
    key,
  }),
  azure: (operation: string, repository?: string) => ({
    component: 'azure',
    operation,
    repository,
  }),
  sync: (repositoryId: string, operation: string) => ({
    component: 'sync',
    repositoryId,
    operation,
  }),
  auth: (operation: string, userId?: string) => ({
    component: 'auth',
    operation,
    userId,
  }),
};

// Export logger instance for direct use
export default logger;
