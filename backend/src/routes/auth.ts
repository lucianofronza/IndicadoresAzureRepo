import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { asyncHandler } from '@/middlewares/errorHandler';
import { requireAuth, requireAdmin } from '@/middlewares/auth';
import { AuthService } from '@/services/authService';
import { logger } from '@/utils/logger';
import { 
  UserCreateInput, 
  LoginRequest, 
  RefreshTokenRequest, 
  ChangePasswordRequest 
} from '@/types/auth';

const router = Router();
const authService = new AuthService();

// Validação para registro
const registerValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('login')
    .trim()
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Login deve ter entre 3 e 50 caracteres e conter apenas letras, números, hífen e underscore'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres'),
  body('role')
    .optional()
    .isIn(['admin', 'user'])
    .withMessage('Role deve ser admin ou user')
];

// Validação para login
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('password')
    .notEmpty()
    .withMessage('Senha é obrigatória')
];

// Validação para refresh token
const refreshTokenValidation = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token é obrigatório')
];

// Validação para alterar senha
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Senha atual é obrigatória'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Nova senha deve ter pelo menos 6 caracteres')
];

// Validação para atualizar usuário
const updateUserValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('login')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Login deve ter entre 3 e 50 caracteres e conter apenas letras, números, hífen e underscore'),
  body('role')
    .optional()
    .isIn(['admin', 'user'])
    .withMessage('Role deve ser admin ou user'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive deve ser true ou false')
];

/**
 * @route POST /auth/register
 * @desc Registrar novo usuário
 * @access Public
 */
router.post('/register', registerValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Dados de entrada inválidos',
      details: errors.array()
    });
  }

  const userData: UserCreateInput = req.body;
  const user = await authService.register(userData);

  logger.info({ userId: user.id, email: user.email }, 'User registered successfully');

  res.status(201).json({
    success: true,
    data: user,
    message: 'Usuário registrado com sucesso'
  });
}));

/**
 * @route POST /auth/login
 * @desc Fazer login do usuário
 * @access Public
 */
router.post('/login', loginValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Dados de entrada inválidos',
      details: errors.array()
    });
  }

  const credentials: LoginRequest = req.body;
  const loginResponse = await authService.login(credentials);

  logger.info({ userId: loginResponse.user.id, email: loginResponse.user.email }, 'User logged in successfully');

  res.json({
    success: true,
    data: loginResponse,
    message: 'Login realizado com sucesso'
  });
}));

/**
 * @route POST /auth/refresh
 * @desc Renovar token de acesso
 * @access Public
 */
router.post('/refresh', refreshTokenValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Dados de entrada inválidos',
      details: errors.array()
    });
  }

  const refreshData: RefreshTokenRequest = req.body;
  const refreshResponse = await authService.refreshToken(refreshData);

  logger.info('Token refreshed successfully');

  res.json({
    success: true,
    data: refreshResponse,
    message: 'Token renovado com sucesso'
  });
}));

/**
 * @route POST /auth/logout
 * @desc Fazer logout do usuário
 * @access Private
 */
router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.substring(7);

  if (token) {
    await authService.logout(token);
  }

  logger.info({ userId: req.user?.id }, 'User logged out successfully');

  res.json({
    success: true,
    message: 'Logout realizado com sucesso'
  });
}));

/**
 * @route GET /auth/me
 * @desc Obter dados do usuário logado
 * @access Private
 */
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await authService.getUserById(req.user!.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'USER_NOT_FOUND',
      message: 'Usuário não encontrado'
    });
  }

  res.json({
    success: true,
    data: user,
    message: 'Dados do usuário obtidos com sucesso'
  });
}));

/**
 * @route PUT /auth/me
 * @desc Atualizar dados do usuário logado
 * @access Private
 */
router.put('/me', updateUserValidation, requireAuth, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Dados de entrada inválidos',
      details: errors.array()
    });
  }

  const userData = req.body;
  const user = await authService.updateUser(req.user!.id, userData);

  logger.info({ userId: user.id }, 'User updated successfully');

  res.json({
    success: true,
    data: user,
    message: 'Usuário atualizado com sucesso'
  });
}));

/**
 * @route PUT /auth/change-password
 * @desc Alterar senha do usuário logado
 * @access Private
 */
router.put('/change-password', changePasswordValidation, requireAuth, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Dados de entrada inválidos',
      details: errors.array()
    });
  }

  const passwordData: ChangePasswordRequest = req.body;
  await authService.changePassword(req.user!.id, passwordData);

  logger.info({ userId: req.user!.id }, 'Password changed successfully');

  res.json({
    success: true,
    message: 'Senha alterada com sucesso'
  });
}));

/**
 * @route GET /auth/users
 * @desc Listar todos os usuários (apenas admin)
 * @access Private (Admin)
 */
router.get('/users', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const users = await authService.getAllUsers();

  res.json({
    success: true,
    data: users,
    message: 'Usuários listados com sucesso'
  });
}));

/**
 * @route GET /auth/users/:id
 * @desc Obter usuário por ID (apenas admin)
 * @access Private (Admin)
 */
router.get('/users/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await authService.getUserById(id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'USER_NOT_FOUND',
      message: 'Usuário não encontrado'
    });
  }

  res.json({
    success: true,
    data: user,
    message: 'Usuário obtido com sucesso'
  });
}));

/**
 * @route PUT /auth/users/:id
 * @desc Atualizar usuário por ID (apenas admin)
 * @access Private (Admin)
 */
router.put('/users/:id', updateUserValidation, requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Dados de entrada inválidos',
      details: errors.array()
    });
  }

  const { id } = req.params;
  const userData = req.body;
  const user = await authService.updateUser(id, userData);

  logger.info({ userId: user.id }, 'User updated by admin successfully');

  res.json({
    success: true,
    data: user,
    message: 'Usuário atualizado com sucesso'
  });
}));

/**
 * @route DELETE /auth/users/:id
 * @desc Excluir usuário por ID (apenas admin)
 * @access Private (Admin)
 */
router.delete('/users/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Verificar se não está tentando excluir o próprio usuário
  if (id === req.user!.id) {
    return res.status(400).json({
      success: false,
      error: 'CANNOT_DELETE_SELF',
      message: 'Você não pode excluir seu próprio usuário'
    });
  }

  await authService.deleteUser(id);

  logger.info({ userId: id, deletedBy: req.user!.id }, 'User deleted by admin successfully');

  res.json({
    success: true,
    message: 'Usuário excluído com sucesso'
  });
}));

/**
 * @route GET /auth/roles
 * @desc Listar todos os roles de usuário (apenas admin)
 * @access Private (Admin)
 */
router.get('/roles', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const roles = await authService.getAllRoles();

  res.json({
    success: true,
    data: roles,
    message: 'Roles listados com sucesso'
  });
}));

/**
 * @route POST /auth/roles
 * @desc Criar novo role de usuário (apenas admin)
 * @access Private (Admin)
 */
router.post('/roles', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const roleData = req.body;
  const role = await authService.createRole(roleData);

  logger.info({ roleId: role.id, createdBy: req.user!.id }, 'Role created successfully');

  res.status(201).json({
    success: true,
    data: role,
    message: 'Role criado com sucesso'
  });
}));

/**
 * @route PUT /auth/roles/:id
 * @desc Atualizar role de usuário (apenas admin)
 * @access Private (Admin)
 */
router.put('/roles/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const roleData = req.body;
  const role = await authService.updateRole(id, roleData);

  logger.info({ roleId: role.id, updatedBy: req.user!.id }, 'Role updated successfully');

  res.json({
    success: true,
    data: role,
    message: 'Role atualizado com sucesso'
  });
}));

/**
 * @route DELETE /auth/roles/:id
 * @desc Excluir role de usuário (apenas admin)
 * @access Private (Admin)
 */
router.delete('/roles/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  await authService.deleteRole(id);

  logger.info({ roleId: id, deletedBy: req.user!.id }, 'Role deleted successfully');

  res.json({
    success: true,
    message: 'Role excluído com sucesso'
  });
}));

export default router;
