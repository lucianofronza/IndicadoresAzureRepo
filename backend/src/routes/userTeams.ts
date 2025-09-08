import { Router } from 'express';
import { body, param } from 'express-validator';
import { validationResult } from 'express-validator';
import { UserTeamService } from '@/services/userTeamService';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { authenticateToken } from '@/middlewares/auth';
import { requirePermission } from '@/middlewares/permissions';
import { logger } from '@/utils/logger';

const router = Router();
const userTeamService = new UserTeamService();

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

// Validação para criação de associação usuário-equipe
const createUserTeamValidation = [
  body('userId').notEmpty().withMessage('ID do usuário é obrigatório'),
  body('teamId').notEmpty().withMessage('ID da equipe é obrigatório'),
  body('role').optional().isIn(['member', 'coordinator', 'manager']).withMessage('Role deve ser member, coordinator ou manager')
];

// Validação para atualização de role
const updateUserTeamValidation = [
  body('role').isIn(['member', 'coordinator', 'manager']).withMessage('Role deve ser member, coordinator ou manager')
];

/**
 * GET /api/user-teams/:userId
 * Obter todas as equipes de um usuário
 */
router.get('/:userId', 
  requirePermission('users:read'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Dados de entrada inválidos',
        details: errors.array()
      });
    }

    const { userId } = req.params;
    const userTeams = await userTeamService.getUserTeams(userId);

    logger.info({ userId, teamCount: userTeams.length }, 'User teams retrieved successfully');

    res.json({
      success: true,
      data: userTeams,
      message: 'Equipes do usuário obtidas com sucesso'
    });
  })
);

/**
 * POST /api/user-teams
 * Adicionar usuário a uma equipe
 */
router.post('/', 
  requirePermission('users:write'),
  createUserTeamValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Dados de entrada inválidos',
        details: errors.array()
      });
    }

    const userTeamData = req.body;
    const userTeam = await userTeamService.addUserToTeam(userTeamData);

    logger.info({ userTeamId: userTeam.id }, 'User added to team successfully');

    res.status(201).json({
      success: true,
      data: userTeam,
      message: 'Usuário adicionado à equipe com sucesso'
    });
  })
);

/**
 * PUT /api/user-teams/:userTeamId
 * Atualizar role do usuário na equipe
 */
router.put('/:userTeamId', 
  requirePermission('users:write'),
  updateUserTeamValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Dados de entrada inválidos',
        details: errors.array()
      });
    }

    const { userTeamId } = req.params;
    const userTeamData = req.body;
    const userTeam = await userTeamService.updateUserTeamRole(userTeamId, userTeamData);

    logger.info({ userTeamId }, 'User team role updated successfully');

    res.json({
      success: true,
      data: userTeam,
      message: 'Role do usuário na equipe atualizado com sucesso'
    });
  })
);

/**
 * DELETE /api/user-teams/:userTeamId
 * Remover usuário de uma equipe
 */
router.delete('/:userTeamId', 
  requirePermission('users:write'),
  asyncHandler(async (req, res) => {
    const { userTeamId } = req.params;
    await userTeamService.removeUserFromTeam(userTeamId);

    logger.info({ userTeamId }, 'User removed from team successfully');

    res.json({
      success: true,
      message: 'Usuário removido da equipe com sucesso'
    });
  })
);

/**
 * GET /api/user-teams/available/teams
 * Obter todas as equipes disponíveis
 */
router.get('/available/teams', 
  requirePermission('users:read'),
  asyncHandler(async (req, res) => {
    const teams = await userTeamService.getAvailableTeams();

    logger.info({ teamCount: teams.length }, 'Available teams retrieved successfully');

    res.json({
      success: true,
      data: teams,
      message: 'Equipes disponíveis obtidas com sucesso'
    });
  })
);

export default router;
