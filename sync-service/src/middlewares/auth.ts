import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '@/utils/logger';

interface ServiceTokenPayload {
  iss: string;
  aud: string;
  sub: string;
  iat: number;
  exp: number;
  permissions: string[];
}

interface AuthenticatedRequest extends Request {
  service?: {
    name: string;
    permissions: string[];
  };
}

export const serviceAuthMiddleware = (requiredPermissions: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const apiKey = req.headers['x-api-key'] as string;

      if (!authHeader && !apiKey) {
        return res.status(401).json({
          success: false,
          error: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        });
      }

      let isValid = false;
      let serviceName = '';
      let permissions: string[] = [];

      // Try JWT authentication first
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const payload = jwt.verify(token, process.env.JWT_SECRET!) as ServiceTokenPayload;
          
          // Validate token structure
          if (payload.iss && payload.aud && payload.permissions) {
            serviceName = payload.iss;
            permissions = payload.permissions;
            isValid = true;
          }
        } catch (jwtError) {
          logger.warn('Invalid JWT token:', jwtError);
        }
      }

      // Try API Key authentication if JWT failed
      if (!isValid && apiKey) {
        try {
          // For now, use hardcoded API keys since we're not using database
          const validApiKeys: Record<string, { serviceName: string; permissions: string[] }> = {
            [process.env.SERVICE_API_KEY || '']: {
              serviceName: 'sync-service',
              permissions: ['sync:read', 'sync:write', 'sync:execute', 'sync:monitor', 'sync:admin']
            },
            [process.env.BACKEND_API_KEY || '']: {
              serviceName: 'backend',
              permissions: ['sync:read', 'sync:write', 'sync:execute', 'sync:monitor', 'sync:admin']
            }
          };

          const apiKeyRecord = validApiKeys[apiKey];
          if (apiKeyRecord) {
            serviceName = apiKeyRecord.serviceName;
            permissions = apiKeyRecord.permissions;
            isValid = true;
          }
        } catch (error) {
          logger.error('API key validation error:', error);
        }
      }

      if (!isValid) {
        logger.warn('Authentication failed', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          hasAuthHeader: !!authHeader,
          hasApiKey: !!apiKey,
        });

        return res.status(401).json({
          success: false,
          error: 'AUTHENTICATION_FAILED',
          message: 'Invalid authentication credentials',
        });
      }

      // Check permissions
      const hasRequiredPermissions = requiredPermissions.every(permission =>
        permissions.includes(permission) || permissions.includes('sync:admin')
      );

      if (!hasRequiredPermissions) {
        logger.warn('Insufficient permissions', {
          service: serviceName,
          required: requiredPermissions,
          granted: permissions,
        });

        return res.status(403).json({
          success: false,
          error: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions',
          required: requiredPermissions,
        });
      }

      // Add service info to request
      req.service = {
        name: serviceName,
        permissions,
      };

      logger.debug('Service authenticated successfully', {
        service: serviceName,
        permissions,
        endpoint: req.path,
      });

      next();
    } catch (error) {
      logger.error('Authentication middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'AUTHENTICATION_ERROR',
        message: 'Internal authentication error',
      });
    }
  };
};

// Helper function to generate service JWT token
export const generateServiceToken = (
  issuer: string,
  audience: string,
  permissions: string[],
  expiresIn: string = '1h'
): string => {
  return jwt.sign(
    {
      iss: issuer,
      aud: audience,
      sub: 'service-auth',
      permissions,
    },
    process.env.JWT_SECRET!,
    { expiresIn }
  );
};

// Helper function to validate API key
export const validateApiKey = async (apiKey: string): Promise<{
  isValid: boolean;
  serviceName?: string;
  permissions?: string[];
}> => {
  try {
    // For now, use hardcoded API keys since we're not using database
    const validApiKeys: Record<string, { serviceName: string; permissions: string[] }> = {
      [process.env.SERVICE_API_KEY || '']: {
        serviceName: 'sync-service',
        permissions: ['sync:read', 'sync:write', 'sync:execute', 'sync:monitor', 'sync:admin']
      },
      [process.env.BACKEND_API_KEY || '']: {
        serviceName: 'backend',
        permissions: ['sync:read', 'sync:write', 'sync:execute', 'sync:monitor', 'sync:admin']
      }
    };

    const apiKeyRecord = validApiKeys[apiKey];
    if (!apiKeyRecord) {
      return { isValid: false };
    }

    return {
      isValid: true,
      serviceName: apiKeyRecord.serviceName,
      permissions: apiKeyRecord.permissions,
    };
  } catch (error) {
    logger.error('Error validating API key:', error);
    return { isValid: false };
  }
};
