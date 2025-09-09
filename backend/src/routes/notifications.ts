import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { asyncHandler } from '@/middlewares/errorHandler';
import { requireAuth } from '@/middlewares/auth';
import { requirePermission } from '@/middlewares/permissions';
import { validate, paginationSchema } from '@/middlewares/validation';
import { NotificationService } from '@/services/notificationService';
import { logger } from '@/utils/logger';

const router = Router();
const notificationService = new NotificationService();

// Validação para marcar notificação como lida
const markAsReadValidation = [
  param('id').isString().notEmpty().withMessage('ID da notificação é obrigatório')
];

// Validação para aprovar usuário via notificação
const approveUserValidation = [
  param('id').isString().notEmpty().withMessage('ID da notificação é obrigatório')
];

/**
 * @route GET /api/notifications
 * @desc Listar notificações do usuário logado
 * @access Private (Admin)
 */
router.get('/', 
  requireAuth, 
  requirePermission('users:read'),
  validate(paginationSchema),
  asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 10, status, type } = req.query;
    
    const result = await notificationService.getUserNotifications(req.user!.id, {
      status: status as 'unread' | 'read' | 'action_taken',
      type: type as string,
      page: page as number,
      pageSize: pageSize as number,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      message: 'Notificações listadas com sucesso'
    });
  })
);

/**
 * @route GET /api/notifications/unread-count
 * @desc Contar notificações não lidas
 * @access Private (Admin)
 */
router.get('/unread-count', 
  requireAuth, 
  requirePermission('users:read'),
  asyncHandler(async (req, res) => {
    const count = await notificationService.getUnreadCount();

    res.json({
      success: true,
      data: { count },
      message: 'Contador de notificações não lidas'
    });
  })
);

/**
 * @route PUT /api/notifications/:id/read
 * @desc Marcar notificação como lida
 * @access Private (Admin)
 */
router.put('/:id/read', 
  requireAuth, 
  requirePermission('users:read'),
  markAsReadValidation,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const notification = await notificationService.markAsRead(id);

    logger.info({ 
      notificationId: id, 
      userId: req.user!.id 
    }, 'Notification marked as read by user');

    res.json({
      success: true,
      data: notification,
      message: 'Notificação marcada como lida'
    });
  })
);

/**
 * @route POST /api/notifications/:id/approve-user
 * @desc Aprovar usuário via notificação
 * @access Private (Admin)
 */
router.post('/:id/approve-user', 
  requireAuth, 
  requirePermission('users:write'),
  approveUserValidation,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const result = await notificationService.approveUserViaNotification(id, req.user!.id);

    logger.info({ 
      notificationId: id, 
      userId: req.user!.id,
      approvedUserId: result.user.id 
    }, 'User approved via notification');

    res.json({
      success: true,
      data: {
        notification: result.notification,
        user: result.user
      },
      message: 'Usuário aprovado com sucesso'
    });
  })
);

/**
 * @route PUT /api/notifications/:id/action-taken
 * @desc Marcar notificação como ação tomada
 * @access Private (Admin)
 */
router.put('/:id/action-taken', 
  requireAuth, 
  requirePermission('users:write'),
  markAsReadValidation,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const notification = await notificationService.markAsActionTaken(id, req.user!.id);

    logger.info({ 
      notificationId: id, 
      userId: req.user!.id 
    }, 'Notification marked as action taken by user');

    res.json({
      success: true,
      data: notification,
      message: 'Notificação marcada como ação tomada'
    });
  })
);

/**
 * @route POST /api/notifications/cleanup
 * @desc Limpar notificações antigas (mais de 30 dias)
 * @access Private (Admin)
 */
router.post('/cleanup', 
  requireAuth, 
  requirePermission('users:write'),
  asyncHandler(async (req, res) => {
    const deletedCount = await notificationService.cleanupOldNotifications();

    logger.info({ 
      deletedCount, 
      userId: req.user!.id 
    }, 'Old notifications cleaned up by user');

    res.json({
      success: true,
      data: { deletedCount },
      message: `${deletedCount} notificações antigas foram removidas`
    });
  })
);

export default router;
