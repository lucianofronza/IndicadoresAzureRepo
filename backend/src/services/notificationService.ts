import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';
import { CustomError } from '@/middlewares/errorHandler';

export interface CreateNotificationData {
  type: string;
  title: string;
  message: string;
  targetUserId?: string;
  metadata?: any;
}

export interface NotificationFilters {
  status?: 'unread' | 'read' | 'action_taken';
  type?: string;
  page?: number;
  pageSize?: number;
}

export class NotificationService {
  /**
   * Criar notificação para todos os administradores
   */
  async createNotificationForAdmins(data: CreateNotificationData): Promise<void> {
    try {
      logger.info({ 
        type: data.type, 
        targetUserId: data.targetUserId 
      }, 'Creating notification for all admins');

      // Validar se targetUserId existe
      if (!data.targetUserId) {
        logger.warn('No targetUserId provided, skipping notification creation');
        return;
      }

      // Verificar se o usuário alvo existe
      const targetUser = await prisma.user.findUnique({
        where: { id: data.targetUserId }
      });

      if (!targetUser) {
        logger.warn({ targetUserId: data.targetUserId }, 'Target user not found, skipping notification creation');
        return;
      }

      // Buscar todos os usuários com permissão de administrador
      const admins = await prisma.user.findMany({
        where: {
          role: {
            permissions: {
              has: 'users:write' // Usuários que podem aprovar outros usuários
            }
          },
          isActive: true
        },
        select: { id: true, name: true, email: true }
      });

      if (admins.length === 0) {
        logger.warn('No admins found to receive notification');
        return;
      }

      // Criar notificação para cada admin
      const notifications = admins.map(admin => ({
        type: data.type,
        title: data.title,
        message: data.message,
        targetUserId: data.targetUserId,
        recipientId: admin.id, // Especificar qual admin deve receber a notificação
        metadata: data.metadata
      }));

      await prisma.notification.createMany({
        data: notifications
      });

      logger.info({ 
        adminCount: admins.length, 
        type: data.type,
        targetUserId: data.targetUserId
      }, 'Notifications created for admins');

    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        type: data.type,
        targetUserId: data.targetUserId
      }, 'Error creating notifications for admins');
      throw error;
    }
  }

  /**
   * Listar notificações de um usuário
   */
  async getUserNotifications(userId: string, filters: NotificationFilters = {}): Promise<any> {
    try {
      const { status, type, page = 1, pageSize = 10 } = filters;
      const skip = (page - 1) * pageSize;

      const where: any = {
        recipientId: userId // Filtrar apenas notificações destinadas ao usuário logado
      };

      if (status) {
        where.status = status;
      }

      if (type) {
        where.type = type;
      }

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            targetUser: {
              select: {
                id: true,
                name: true,
                email: true,
                status: true
              }
            }
          }
        }),
        prisma.notification.count({ where })
      ]);

      const totalPages = Math.ceil(total / pageSize);

      return {
        data: notifications,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId 
      }, 'Error getting user notifications');
      throw error;
    }
  }

  /**
   * Contar notificações não lidas
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const count = await prisma.notification.count({
        where: {
          status: 'unread',
          recipientId: userId
        }
      });

      return count;
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      }, 'Error getting unread notifications count');
      throw error;
    }
  }

  /**
   * Marcar notificação como lida
   */
  async markAsRead(notificationId: string): Promise<any> {
    try {
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId }
      });

      if (!notification) {
        throw new CustomError('Notificação não encontrada', 404, 'NOTIFICATION_NOT_FOUND');
      }

      if (notification.status !== 'unread') {
        throw new CustomError('Notificação já foi lida ou ação já foi tomada', 400, 'NOTIFICATION_ALREADY_PROCESSED');
      }

      const updatedNotification = await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: 'read',
          readAt: new Date()
        },
        include: {
          targetUser: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true
            }
          }
        }
      });

      logger.info({ notificationId }, 'Notification marked as read');

      return updatedNotification;
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationId 
      }, 'Error marking notification as read');
      throw error;
    }
  }

  /**
   * Marcar notificação como ação tomada (usuário aprovado)
   */
  async markAsActionTaken(notificationId: string, actionTakenBy: string): Promise<any> {
    try {
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
        include: {
          targetUser: true
        }
      });

      if (!notification) {
        throw new CustomError('Notificação não encontrada', 404, 'NOTIFICATION_NOT_FOUND');
      }

      if (notification.status === 'action_taken') {
        throw new CustomError('Ação já foi tomada para esta notificação', 400, 'ACTION_ALREADY_TAKEN');
      }

      const updatedNotification = await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: 'action_taken',
          actionTakenAt: new Date(),
          actionTakenBy: actionTakenBy
        },
        include: {
          targetUser: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true
            }
          }
        }
      });

      logger.info({ 
        notificationId, 
        actionTakenBy,
        targetUserId: notification.targetUserId 
      }, 'Notification marked as action taken');

      return updatedNotification;
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationId 
      }, 'Error marking notification as action taken');
      throw error;
    }
  }

  /**
   * Aprovar usuário via notificação
   */
  async approveUserViaNotification(notificationId: string, actionTakenBy: string): Promise<any> {
    try {
      // Usar transação para garantir atomicidade
      const result = await prisma.$transaction(async (tx) => {
        // Buscar notificação com lock para evitar concorrência
        const notification = await tx.notification.findUnique({
          where: { id: notificationId },
          include: {
            targetUser: true
          }
        });

        if (!notification) {
          throw new CustomError('Notificação não encontrada', 404, 'NOTIFICATION_NOT_FOUND');
        }

        if (!notification.targetUserId) {
          throw new CustomError('Notificação não está associada a um usuário', 400, 'NO_TARGET_USER');
        }

        // Verificar se a notificação já foi processada
        if (notification.status === 'action_taken') {
          throw new CustomError('Usuário já foi aprovado por outro administrador', 409, 'USER_ALREADY_APPROVED');
        }

        // Verificar se o usuário já está ativo
        if (notification.targetUser?.status === 'active') {
          throw new CustomError('Usuário já está ativo', 400, 'USER_ALREADY_ACTIVE');
        }

        // Ativar o usuário
        const updatedUser = await tx.user.update({
          where: { id: notification.targetUserId },
          data: {
            status: 'active',
            isActive: true
          },
          include: {
            role: true
          }
        });

        // Marcar notificação como ação tomada
        const updatedNotification = await tx.notification.update({
          where: { id: notificationId },
          data: {
            status: 'action_taken',
            actionTakenAt: new Date(),
            actionTakenBy: actionTakenBy
          },
          include: {
            targetUser: {
              select: {
                id: true,
                name: true,
                email: true,
                status: true
              }
            }
          }
        });

        // Marcar TODAS as outras notificações para o mesmo usuário como ação tomada
        // para evitar que outros admins aprovem o mesmo usuário
        await tx.notification.updateMany({
          where: {
            targetUserId: notification.targetUserId,
            type: 'user_approval',
            status: 'unread'
          },
          data: {
            status: 'action_taken',
            actionTakenAt: new Date(),
            actionTakenBy: actionTakenBy
          }
        });

        return {
          notification: updatedNotification,
          user: updatedUser
        };
      });

      logger.info({ 
        notificationId, 
        userId: result.user.id,
        actionTakenBy 
      }, 'User approved via notification');

      return result;
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationId 
      }, 'Error approving user via notification');
      throw error;
    }
  }

  /**
   * Limpar notificações antigas (mais de 30 dias)
   */
  async cleanupOldNotifications(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: thirtyDaysAgo
          }
        }
      });

      logger.info({ 
        deletedCount: result.count 
      }, 'Old notifications cleaned up');

      return result.count;
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Error cleaning up old notifications');
      throw error;
    }
  }
}
