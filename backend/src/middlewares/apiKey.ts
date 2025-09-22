import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  const expectedApiKey = process.env.BACKEND_API_KEY;

  if (!expectedApiKey) {
    logger.error('BACKEND_API_KEY not configured');
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'API key not configured'
    });
  }

  if (!apiKey) {
    logger.warn('API key missing from request', {
      url: req.url,
      method: req.method,
      ip: req.ip
    });
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'API key required'
    });
  }

  if (apiKey !== expectedApiKey) {
    logger.warn('Invalid API key provided', {
      url: req.url,
      method: req.method,
      ip: req.ip,
      providedKey: apiKey.substring(0, 8) + '...'
    });
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Invalid API key'
    });
  }

  logger.debug('API key validated successfully', {
    url: req.url,
    method: req.method
  });

  next();
}
