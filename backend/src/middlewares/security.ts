import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { logger } from '@/utils/logger';

// CORS configuration
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:5173',
      'http://localhost:5173',
    ];

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Request-Id',
  ],
  exposedHeaders: ['X-Request-Id', 'X-Total-Count'],
  maxAge: 86400, // 24 hours
};

// Rate limiting configuration
export const createRateLimiter = (windowMs: number = 15 * 60 * 1000, max: number = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
};

// Specific rate limiters
export const authRateLimiter = createRateLimiter(15 * 60 * 1000, 5); // 5 requests per 15 minutes
export const syncRateLimiter = createRateLimiter(60 * 1000, 10); // 10 requests per minute
export const apiRateLimiter = createRateLimiter(15 * 60 * 1000, 5000); // 5000 requests per 15 minutes

// Helmet configuration
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

// Request ID middleware
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] || generateRequestId();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
};

// IP address middleware
export const ipAddress = (req: Request, res: Response, next: NextFunction) => {
  (req as any).ip = req.headers['x-forwarded-for'] as string || 
           req.headers['x-real-ip'] as string || 
           (req as any).connection.remoteAddress || 
           (req as any).socket.remoteAddress || 
           'unknown';
  next();
};

// Request logging middleware
export const requestLogging = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: (req as any).requestId,
    };

    if (res.statusCode >= 400) {
      logger.warn(logData, 'Request completed with error');
    } else {
      logger.info(logData, 'Request completed');
    }
  });

  next();
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key] as string);
      }
    });
  }

  // Sanitize body parameters
  if (req.body) {
    sanitizeObject(req.body);
  }

  next();
};

// Sanitize string
function sanitizeString(str: string): string {
  return str
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}

// Sanitize object recursively
function sanitizeObject(obj: any): void {
  if (typeof obj !== 'object' || obj === null) return;

  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'string') {
      obj[key] = sanitizeString(obj[key]);
    } else if (typeof obj[key] === 'object') {
      sanitizeObject(obj[key]);
    }
  });
}

// Generate request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Content type validation middleware
export const validateContentType = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentType = req.get('Content-Type');
    
    // Permitir requisições sem body (como POST sem dados)
    if (!req.body || Object.keys(req.body).length === 0) {
      return next();
    }
    
    // Validar Content-Type apenas se há dados no body
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(415).json({
        success: false,
        error: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Content-Type must be application/json',
      });
    }
  }
  next();
};

// Size limit middleware
export const sizeLimit = (limit: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    const limitBytes = parseSizeLimit(limit);
    
    if (contentLength > limitBytes) {
      return res.status(413).json({
        success: false,
        error: 'PAYLOAD_TOO_LARGE',
        message: `Request body too large. Maximum size is ${limit}`,
      });
    }
    next();
  };
};

// Parse size limit string to bytes
function parseSizeLimit(limit: string): number {
  const units: { [key: string]: number } = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024,
  };

  const match = limit.toLowerCase().match(/^(\d+)([kmg]?b)$/);
  if (!match) {
    return 10 * 1024 * 1024; // Default 10MB
  }

  const size = parseInt(match[1]);
  const unit = match[2] || 'b';
  return size * units[unit];
}

// Export all security middlewares
export const securityMiddlewares = [
  helmetConfig,
  cors(corsOptions),
  securityHeaders,
  requestId,
  ipAddress,
  requestLogging,
  sanitizeInput,
  validateContentType,
  sizeLimit('10mb'),
];
