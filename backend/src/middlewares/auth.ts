import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { AuthService } from '@/services/authService';
import { logger } from '@/utils/logger';

const authService = new AuthService();

/**
 * Middleware de autenticação opcional
 * Não bloqueia requisições sem token, apenas adiciona informações do usuário se disponível
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Sem token, continuar sem autenticação
      next();
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const user = await authService.verifyToken(token);
      req.user = {
        id: user.id,
        login: user.login,
        name: user.name,
        email: user.email,
        role: user.role
      };
      
      logger.info({ 
        userId: user.id, 
        email: user.email,
        requestId: req.requestId 
      }, 'User authenticated via optional auth middleware');
    } catch (error) {
      // Token inválido, mas não bloqueia a requisição
      logger.warn({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId 
      }, 'Invalid token in optional auth middleware - continuing without authentication');
    }
    
    next();
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId 
    }, 'Error in optional auth middleware');
    next();
  }
};

/**
 * Middleware de autenticação obrigatória
 * Bloqueia requisições sem token válido
 */
export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'MISSING_TOKEN',
        message: 'Token de autenticação é obrigatório'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const user = await authService.verifyToken(token);
      req.user = {
        id: user.id,
        login: user.login,
        name: user.name,
        email: user.email,
        role: user.role
      };
      
      logger.info({ 
        userId: user.id, 
        email: user.email,
        requestId: req.requestId 
      }, 'User authenticated via required auth middleware');
      
      next();
    } catch (error) {
      logger.warn({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId 
      }, 'Invalid token in required auth middleware');
      
      res.status(401).json({
        success: false,
        error: 'INVALID_TOKEN',
        message: 'Token de autenticação inválido'
      });
    }
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId 
    }, 'Error in required auth middleware');
    
    res.status(500).json({
      success: false,
      error: 'AUTH_ERROR',
      message: 'Erro interno de autenticação'
    });
  }
};

/**
 * Middleware de autorização para admin
 * Requer autenticação e role de admin
 */
export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Primeiro verificar se o usuário está autenticado
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Autenticação é obrigatória'
      });
      return;
    }

    // Verificar se o usuário é admin
    if (req.user.role !== 'admin') {
      logger.warn({ 
        userId: req.user.id, 
        role: req.user.role,
        requestId: req.requestId 
      }, 'User attempted to access admin-only endpoint');
      
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Acesso negado. Apenas administradores podem acessar este recurso.'
      });
      return;
    }

    logger.info({ 
      userId: req.user.id, 
      role: req.user.role,
      requestId: req.requestId 
    }, 'Admin access granted');
    
    next();
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId 
    }, 'Error in admin auth middleware');
    
    res.status(500).json({
      success: false,
      error: 'AUTH_ERROR',
      message: 'Erro interno de autorização'
    });
  }
};

/**
 * Middleware para extrair token do header Authorization
 * Útil para endpoints que precisam do token mas não requerem autenticação
 */
export const extractToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    req.token = authHeader.substring(7);
  }
  
  next();
};
