import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@/services/authService';
import { logger } from '@/utils/logger';
import { AuthenticatedRequest } from '@/types/auth';
import { CustomError } from '@/middlewares/errorHandler';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const authService = new AuthService();

export interface PermissionMiddlewareOptions {
  permission: string;
  requireAll?: boolean;
}

/**
 * Middleware para verificar permissões específicas
 */
export const requirePermission = (permission: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new CustomError('Usuário não autenticado', 401, 'UNAUTHORIZED');
      }

      // Buscar o role do usuário e suas permissões
      const userRole = req.user.role;
      
      // Por enquanto, usar lógica simples baseada no role
      // Em uma implementação mais avançada, isso viria do banco de dados
      const hasPermission = await checkUserPermission(req.user.id, permission);
      
      if (!hasPermission) {
        logger.warn({ 
          userId: req.user.id, 
          userRole, 
          requiredPermission: permission,
          path: req.path 
        }, 'Access denied - insufficient permissions');
        
        throw new CustomError('Acesso negado - permissão insuficiente', 403, 'INSUFFICIENT_PERMISSIONS');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware para verificar múltiplas permissões (todas devem ser atendidas)
 */
export const requireAllPermissions = (permissions: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new CustomError('Usuário não autenticado', 401, 'UNAUTHORIZED');
      }

      const userRole = req.user.role;
      
      // Verificar se o usuário tem todas as permissões
      const hasAllPermissions = await Promise.all(
        permissions.map(permission => checkUserPermission(req.user.id, permission))
      );

      if (!hasAllPermissions.every(Boolean)) {
        logger.warn({ 
          userId: req.user.id, 
          userRole, 
          requiredPermissions: permissions,
          path: req.path 
        }, 'Access denied - insufficient permissions');
        
        throw new CustomError('Acesso negado - permissões insuficientes', 403, 'INSUFFICIENT_PERMISSIONS');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware para verificar múltiplas permissões (pelo menos uma deve ser atendida)
 */
export const requireAnyPermission = (permissions: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new CustomError('Usuário não autenticado', 401, 'UNAUTHORIZED');
      }

      const userRole = req.user.role;
      
      // Verificar se o usuário tem pelo menos uma das permissões
      const hasAnyPermission = await Promise.all(
        permissions.map(permission => checkUserPermission(req.user.id, permission))
      );

      if (!hasAnyPermission.some(Boolean)) {
        logger.warn({ 
          userId: req.user.id, 
          userRole, 
          requiredPermissions: permissions,
          path: req.path 
        }, 'Access denied - insufficient permissions');
        
        throw new CustomError('Acesso negado - permissões insuficientes', 403, 'INSUFFICIENT_PERMISSIONS');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Função auxiliar para verificar permissões do usuário
 */
async function checkUserPermission(userId: string, permission: string): Promise<boolean> {
  try {
    // Buscar o usuário com seu role e permissões
    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      include: {
        role: true
      }
    });

    if (!user || !user.role) {
      return false;
    }

    return user.role.permissions.includes(permission);
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error checking user permission');
    return false;
  }
}

/**
 * Middleware para adicionar permissões do usuário ao request
 */
export const addUserPermissions = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      const user = await (prisma as any).user.findUnique({
        where: { id: req.user.id },
        include: {
          role: true
        }
      });
      
      if (user?.role) {
        req.userPermissions = user.role.permissions;
      }
    }
    next();
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error adding user permissions');
    next();
  }
};
