import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import { 
  User, 
  UserCreateInput, 
  UserUpdateInput, 
  LoginRequest, 
  RefreshTokenRequest,
  ChangePasswordRequest,
  AzureAdLoginRequest
} from '@/types/auth';
import { CustomError } from '@/middlewares/errorHandler';
import { NotificationService } from './notificationService';

const prisma = new PrismaClient();

export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  private readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
  private readonly REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Converter usuário do banco para tipo da API
   */
  private convertDbUserToUser(dbUser: any): Omit<User, 'password'> {
    const userWithoutPassword = Object.assign({}, dbUser);
    delete userWithoutPassword.password;
    return {
      ...userWithoutPassword,
      role: userWithoutPassword.role || null, // Retornar o objeto role completo
      viewScope: userWithoutPassword.viewScope || 'own' // Default para 'own' se não existir
    } as Omit<User, 'password'>;
  }

  /**
   * Converter usuário do banco para tipo da API (com password)
   */
  private convertDbUserToUserWithPassword(dbUser: any): User {
    return {
      ...dbUser,
      role: dbUser.role?.name || 'user', // Usar o nome do role relacionado
      viewScope: dbUser.viewScope || 'own' // Default para 'own' se não existir
    } as User;
  }

  /**
   * Registrar um novo usuário
   */
  async register(userData: UserCreateInput): Promise<Omit<User, 'password'>> {
    try {
      logger.info({ email: userData.email }, 'Attempting to register new user');

      // Verificar se o email já existe
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (existingUser) {
        throw new CustomError('Email já está em uso', 400, 'EMAIL_ALREADY_EXISTS');
      }

      // Verificar se o login já existe
      const existingLogin = await prisma.user.findUnique({
        where: { login: userData.login }
      });

      if (existingLogin) {
        throw new CustomError('Login já está em uso', 400, 'LOGIN_ALREADY_EXISTS');
      }

      // Criptografar a senha
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

      // Criar o usuário
      const user = await (prisma as any).user.create({
        data: {
          name: userData.name,
          email: userData.email,
          login: userData.login,
          password: hashedPassword,
          roleId: userData.roleId // Obrigatório
        },
        include: {
          role: true // Incluir o role relacionado
        }
      });

      logger.info({ userId: user.id, email: user.email }, 'User registered successfully');

      // Retornar usuário sem a senha
      return this.convertDbUserToUser(user);
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error registering user');
      throw error;
    }
  }

  /**
   * Fazer login do usuário
   */
  async login(credentials: LoginRequest): Promise<any> { // Changed return type to any as LoginResponse is removed
    try {
      logger.info({ email: credentials.email }, 'Attempting user login');

      // Buscar usuário pelo email
      const user = await (prisma as any).user.findUnique({
        where: { email: credentials.email },
        include: {
          role: true // Incluir o role relacionado
        }
      });

      // Sempre executar verificação de senha para evitar timing attacks
      // Se usuário não existe, usar um hash dummy para manter tempo constante
      const passwordToCheck = user?.password || '$2b$10$dummy.hash.to.prevent.timing.attacks.and.user.enumeration';
      const isPasswordValid = await bcrypt.compare(credentials.password, passwordToCheck);

      // Adicionar delay artificial para evitar timing attacks
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));

      // Verificar se usuário existe e senha é válida
      if (!user || !isPasswordValid) {
        // Sempre usar a mesma mensagem genérica para evitar enumeração de usuários
        throw new CustomError('Credenciais inválidas', 401, 'INVALID_CREDENTIALS');
      }

      if (!user.isActive) {
        // Usar mensagem genérica mesmo para usuário inativo
        throw new CustomError('Credenciais inválidas', 401, 'INVALID_CREDENTIALS');
      }

      // Gerar tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // Calcular data de expiração
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 horas

      // Salvar refresh token no banco
      await prisma.userToken.create({
        data: {
          userId: user.id,
          accessToken,
          refreshToken,
          expiresAt
        }
      });

      // Atualizar último login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      logger.info({ userId: user.id, email: user.email }, 'User logged in successfully');

      // Retornar resposta de login
      return {
        user: this.convertDbUserToUser(user),
        accessToken,
        refreshToken,
        expiresAt
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error during login');
      throw error;
    }
  }

  /**
   * Login com Azure AD
   */
  async loginWithAzureAd(azureAdData: AzureAdLoginRequest): Promise<any> {
    try {
      logger.info({ email: azureAdData.email, azureAdId: azureAdData.azureAdId }, 'Attempting Azure AD login');

      // Buscar usuário pelo email ou azureAdId
      let user = await (prisma as any).user.findFirst({
        where: {
          OR: [
            { email: azureAdData.email },
            { azureAdId: azureAdData.azureAdId }
          ]
        },
        include: {
          role: true
        }
      });

      // Se usuário não existe, criar com status pendente
      if (!user) {
        logger.info({ email: azureAdData.email }, 'User not found, creating pending user');
        
        // Buscar role padrão
        const defaultRole = await prisma.userRole.findFirst({
          where: { isDefault: true }
        });

        if (!defaultRole) {
          // Log para debug - vamos ver o que existe no banco
          const allRoles = await prisma.userRole.findMany();
          logger.error({ allRoles }, 'Nenhum role padrão encontrado. Roles disponíveis:');
          throw new CustomError('Nenhum role padrão encontrado. Configure um role como padrão.', 500, 'DEFAULT_ROLE_NOT_FOUND');
        }

        // Criar usuário com status pendente
        user = await (prisma as any).user.create({
          data: {
            name: azureAdData.name,
            email: azureAdData.email,
            login: azureAdData.email.split('@')[0], // Usar parte do email como login
            azureAdId: azureAdData.azureAdId,
            azureAdEmail: azureAdData.azureAdEmail || azureAdData.email,
            roleId: defaultRole.id,
            isActive: false, // Usuário criado como inativo
            status: 'pending', // Status pendente para aprovação
            viewScope: 'own' // Controle de visualização padrão: apenas seus dados
          },
          include: {
            role: true
          }
        });

        logger.info({ userId: user.id, email: user.email }, 'Pending user created successfully');

        // Criar notificação para admins sobre novo usuário pendente
        try {
          await this.notificationService.createNotificationForAdmins({
            type: 'user_approval',
            title: 'Novo usuário aguardando aprovação',
            message: `${user.name} (${user.email})`,
            targetUserId: user.id,
            metadata: {
              userId: user.id,
              userName: user.name,
              userEmail: user.email,
              userLogin: user.login,
              createdAt: user.createdAt
            }
          });
        } catch (notificationError) {
          // Log do erro mas não falha a criação do usuário
          logger.error({ 
            error: notificationError instanceof Error ? notificationError.message : 'Unknown error',
            userId: user.id 
          }, 'Failed to create notification for pending user');
        }

        // Tentar vincular automaticamente com desenvolvedor
        await this.linkWithDeveloper(user.id, azureAdData.email, azureAdData.azureAdId);
      }

      // Verificar se usuário está ativo
      if (!user.isActive || user.status !== 'active') {
        // Retornar dados do usuário pendente para o frontend mostrar página de aprovação
        return {
          user: this.convertDbUserToUser(user),
          accessToken: null,
          refreshToken: null,
          requiresApproval: true,
          message: 'Usuário pendente de aprovação. Entre em contato com o administrador.'
        };
      }

      // Atualizar dados do Azure AD se necessário
      if (user.azureAdId !== azureAdData.azureAdId || user.azureAdEmail !== azureAdData.azureAdEmail) {
        await (prisma as any).user.update({
          where: { id: user.id },
          data: {
            azureAdId: azureAdData.azureAdId,
            azureAdEmail: azureAdData.azureAdEmail || azureAdData.email,
            name: azureAdData.name // Atualizar nome caso tenha mudado
          }
        });
      }

      // Tentar vincular com desenvolvedor se ainda não estiver vinculado
      if (!user.developerId) {
        await this.linkWithDeveloper(user.id, azureAdData.email, azureAdData.azureAdId);
      }

      // Gerar tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // Calcular data de expiração
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 horas

      // BUGFIX: NÃO deletar tokens existentes - causa INVALID_REFRESH_TOKEN em requisições concorrentes
      // O token antigo será automaticamente revogado quando expirar ou no refresh
      // await prisma.userToken.deleteMany({
      //   where: { userId: user.id }
      // });

      // Salvar refresh token no banco
      await prisma.userToken.create({
        data: {
          userId: user.id,
          accessToken,
          refreshToken,
          expiresAt
        }
      });

      // Atualizar último login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      logger.info({ userId: user.id, email: user.email }, 'Azure AD login successful');

      // Retornar resposta de login
      return {
        user: this.convertDbUserToUser(user),
        accessToken,
        refreshToken,
        expiresAt
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error during Azure AD login');
      throw error;
    }
  }

  /**
   * Processar callback do Azure AD (Authorization Code Flow with PKCE)
   */
  async handleAzureAdCallback(code: string, redirectUri: string, codeVerifier: string): Promise<any> {
    try {
      logger.info('Processing Azure AD callback with PKCE');

      // Configurações do Azure AD
      const clientId = process.env.AZURE_CLIENT_ID;
      const tenantId = process.env.AZURE_TENANT_ID;

      if (!clientId || !tenantId) {
        throw new CustomError('Configurações do Azure AD não encontradas', 500, 'AZURE_CONFIG_MISSING');
      }

      // Trocar código de autorização por token usando PKCE
      const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          code: code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: codeVerifier,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        logger.error({ status: tokenResponse.status, error: errorData }, 'Failed to exchange authorization code');
        throw new CustomError('Falha ao trocar código de autorização por token', 400, 'TOKEN_EXCHANGE_FAILED');
      }

      const tokenData = await tokenResponse.json();
      const { id_token } = tokenData;

      // Decodificar ID token para obter informações do usuário
      const idTokenPayload = JSON.parse(atob(id_token.split('.')[1]));
      const userInfo = {
        azureAdId: idTokenPayload.sub,
        email: idTokenPayload.email || idTokenPayload.preferred_username,
        name: idTokenPayload.name || idTokenPayload.given_name + ' ' + idTokenPayload.family_name,
        azureAdEmail: idTokenPayload.email || idTokenPayload.preferred_username,
      };

      logger.info({ email: userInfo.email, azureAdId: userInfo.azureAdId }, 'Azure AD user info extracted');

      // Usar o método existente de login com Azure AD
      return await this.loginWithAzureAd(userInfo);

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error during Azure AD callback processing');
      throw error;
    }
  }

  /**
   * Renovar token de acesso
   */
  async refreshToken(refreshData: RefreshTokenRequest): Promise<any> { // Changed return type to any as RefreshTokenResponse is removed
    try {
      logger.info('Attempting to refresh token');

      // Buscar token no banco
      const tokenRecord = await prisma.userToken.findUnique({
        where: { refreshToken: refreshData.refreshToken },
        include: { user: true }
      });

      // Adicionar delay artificial para evitar timing attacks
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));

      if (!tokenRecord) {
        throw new CustomError('Token de refresh inválido', 401, 'INVALID_REFRESH_TOKEN');
      }

      if (tokenRecord.isRevoked) {
        throw new CustomError('Token de refresh inválido', 401, 'INVALID_REFRESH_TOKEN');
      }

      if (tokenRecord.expiresAt < new Date()) {
        throw new CustomError('Token de refresh inválido', 401, 'INVALID_REFRESH_TOKEN');
      }

      if (!tokenRecord.user.isActive) {
        throw new CustomError('Token de refresh inválido', 401, 'INVALID_REFRESH_TOKEN');
      }

      // Gerar novos tokens
      const newAccessToken = this.generateAccessToken(tokenRecord.user);
      const newRefreshToken = this.generateRefreshToken(tokenRecord.user);

      // Calcular nova data de expiração
      const newExpiresAt = new Date();
      newExpiresAt.setHours(newExpiresAt.getHours() + 24); // 24 horas

      // Revogar token antigo e criar novo
      await prisma.userToken.update({
        where: { id: tokenRecord.id },
        data: { isRevoked: true }
      });

      await prisma.userToken.create({
        data: {
          userId: tokenRecord.user.id,
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresAt: newExpiresAt
        }
      });

      logger.info({ userId: tokenRecord.user.id }, 'Token refreshed successfully');

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error refreshing token');
      throw error;
    }
  }

  /**
   * Fazer logout do usuário
   */
  async logout(accessToken: string): Promise<void> {
    try {
      logger.info('Attempting user logout');

      // Revogar token
      await prisma.userToken.updateMany({
        where: { accessToken },
        data: { isRevoked: true }
      });

      logger.info('User logged out successfully');
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error during logout');
      throw error;
    }
  }

  /**
   * Alterar senha do usuário
   */
  async changePassword(userId: string, passwordData: ChangePasswordRequest): Promise<void> {
    try {
      logger.info({ userId }, 'Attempting to change password');

      // Buscar usuário
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new CustomError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
      }

      // Verificar senha atual
      const isCurrentPasswordValid = await bcrypt.compare(passwordData.currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new CustomError('Senha atual incorreta', 400, 'INVALID_CURRENT_PASSWORD');
      }

      // Criptografar nova senha
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(passwordData.newPassword, saltRounds);

      // Atualizar senha
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword }
      });

      // Revogar todos os tokens do usuário
      await prisma.userToken.updateMany({
        where: { userId },
        data: { isRevoked: true }
      });

      logger.info({ userId }, 'Password changed successfully');
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error changing password');
      throw error;
    }
  }

  /**
   * Verificar token de acesso
   */
  async verifyToken(accessToken: string): Promise<User> {
    try {
      // Verificar se o token existe e não foi revogado
      const tokenRecord = await prisma.userToken.findUnique({
        where: { accessToken },
        include: { user: true }
      });

      if (!tokenRecord) {
        throw new CustomError('Token inválido', 401, 'INVALID_TOKEN');
      }

      if (tokenRecord.isRevoked) {
        throw new CustomError('Token revogado', 401, 'REVOKED_TOKEN');
      }

      if (tokenRecord.expiresAt < new Date()) {
        throw new CustomError('Token expirado', 401, 'EXPIRED_TOKEN');
      }

      if (!tokenRecord.user.isActive) {
        throw new CustomError('Usuário inativo', 401, 'USER_INACTIVE');
      }

      // Verificar assinatura do JWT
      const decoded = jwt.verify(accessToken, String(this.JWT_SECRET)) as any;
      if (decoded.userId !== tokenRecord.user.id) {
        throw new CustomError('Token inválido', 401, 'INVALID_TOKEN');
      }

      return this.convertDbUserToUserWithPassword(tokenRecord.user);
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new CustomError('Token inválido', 401, 'INVALID_TOKEN');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new CustomError('Token expirado', 401, 'EXPIRED_TOKEN');
      }
      throw error;
    }
  }

  /**
   * Buscar usuário por ID
   */
  async getUserById(userId: string): Promise<Omit<User, 'password'> | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return null;
      }

      return this.convertDbUserToUser(user);
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error getting user by ID');
      throw error;
    }
  }

  /**
   * Atualizar usuário
   */
  async updateUser(userId: string, userData: UserUpdateInput): Promise<Omit<User, 'password'>> {
    try {
      logger.info({ userId, userData }, 'Attempting to update user');

      const updateData: any = { ...userData };

      // Para usuários do Azure AD, não permitir alteração do login
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { azureAdId: true }
      });

      if (existingUser?.azureAdId && userData.login) {
        // Remover login dos dados de atualização para usuários do Azure AD
        delete updateData.login;
        logger.info({ userId }, 'Login não pode ser alterado para usuários do Azure AD');
      }

      // Converter string boolean para boolean se necessário
      if (userData.isActive !== undefined) {
        if (typeof userData.isActive === 'string') {
          updateData.isActive = userData.isActive === 'true';
        }
      }

      // Se a senha está sendo atualizada, criptografar
      if (userData.password) {
        const saltRounds = 12;
        updateData.password = await bcrypt.hash(userData.password, saltRounds);
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: updateData
      });

      logger.info({ userId }, 'User updated successfully');

      return this.convertDbUserToUser(user);
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error updating user');
      throw error;
    }
  }

  /**
   * Criar novo usuário (apenas admin)
   */
  async createUser(userData: UserCreateInput): Promise<Omit<User, 'password'>> {
    try {
      logger.info({ email: userData.email }, 'Attempting to create user by admin');

      // Verificar se o email já existe
      const existingUser = await (prisma as any).user.findUnique({
        where: { email: userData.email }
      });

      if (existingUser) {
        throw new CustomError('Email já está em uso', 400, 'EMAIL_ALREADY_EXISTS');
      }

      // Verificar se o login já existe
      const existingLogin = await (prisma as any).user.findUnique({
        where: { login: userData.login }
      });

      if (existingLogin) {
        throw new CustomError('Login já está em uso', 400, 'LOGIN_ALREADY_EXISTS');
      }

      // Verificar se a role existe
      if (userData.roleId) {
        const role = await (prisma as any).userRole.findUnique({
          where: { id: userData.roleId }
        });

        if (!role) {
          throw new CustomError('Role não encontrada', 404, 'ROLE_NOT_FOUND');
        }
      }

      // Criptografar a senha
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

      // Criar o usuário
      const user = await (prisma as any).user.create({
        data: {
          name: userData.name,
          email: userData.email,
          login: userData.login,
          password: hashedPassword,
          roleId: userData.roleId || null,
          viewScope: userData.viewScope || 'own' // Default para 'own' se não especificado
        },
        include: {
          role: true
        }
      });

      logger.info({ userId: user.id, email: user.email }, 'User created by admin successfully');

      // Retornar usuário sem a senha
      return this.convertDbUserToUser(user);
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error creating user by admin');
      throw error;
    }
  }

  /**
   * Listar todos os usuários (apenas admin)
   */
  async getAllUsers(): Promise<Omit<User, 'password'>[]> {
    try {
      const users = await (prisma as any).user.findMany({
        include: {
          role: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return users.map(user => this.convertDbUserToUser(user));
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error getting all users');
      throw error;
    }
  }

  /**
   * Excluir usuário (apenas admin)
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      logger.info({ userId }, 'Attempting to delete user');

      // Verificar se o usuário existe
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new CustomError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
      }

      // Revogar todos os tokens do usuário
      await prisma.userToken.updateMany({
        where: { userId },
        data: { isRevoked: true }
      });

      // Excluir usuário (isso também excluirá os tokens devido ao cascade)
      await prisma.user.delete({
        where: { id: userId }
      });

      logger.info({ userId }, 'User deleted successfully');
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error deleting user');
      throw error;
    }
  }

  /**
   * Listar todos os roles de usuário
   */
  async getAllRoles(): Promise<any[]> {
    try {
      const roles = await (prisma as any).userRole.findMany({
        orderBy: { createdAt: 'desc' }
      });

      return roles.map(role => ({
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isSystem: role.isSystem,
        isDefault: role.isDefault,
        createdAt: role.createdAt.toISOString(),
        updatedAt: role.updatedAt.toISOString()
      }));
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error getting all roles');
      throw error;
    }
  }

  async getAllRolesPaginated(params: { page: number; pageSize: number; sortBy: string; sortOrder: 'asc' | 'desc'; search?: string }): Promise<any> {
    try {
      const { page = 1, pageSize = 10, sortBy = 'name', sortOrder = 'asc', search } = params;
      const skip = (page - 1) * pageSize;

      // Build where clause
      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [roles, total] = await Promise.all([
        (prisma as any).userRole.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
        }),
        (prisma as any).userRole.count({ where }),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      return {
        data: roles.map(role => ({
          id: role.id,
          name: role.name,
          description: role.description,
          permissions: role.permissions,
          isSystem: role.isSystem,
          isDefault: role.isDefault,
          createdAt: role.createdAt.toISOString(),
          updatedAt: role.updatedAt.toISOString()
        })),
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
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error getting paginated roles');
      throw error;
    }
  }

  /**
   * Criar novo role de usuário
   */
  async createRole(roleData: any): Promise<any> {
    try {
      logger.info({ roleData }, 'Attempting to create role');

      // Se está marcando como padrão, verificar se já existe outro role padrão
      if (roleData.isDefault) {
        const existingDefaultRole = await (prisma as any).userRole.findFirst({
          where: { isDefault: true }
        });

        if (existingDefaultRole) {
          throw new CustomError('Já existe um role padrão. Apenas um role pode ser marcado como padrão.', 400, 'DEFAULT_ROLE_EXISTS');
        }
      }

      const role = await (prisma as any).userRole.create({
        data: {
          name: roleData.name,
          description: roleData.description,
          permissions: roleData.permissions || [],
          isSystem: false,
          isDefault: roleData.isDefault || false
        }
      });

      logger.info({ roleId: role.id }, 'Role created successfully');
      
      return {
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isSystem: role.isSystem,
        isDefault: role.isDefault,
        createdAt: role.createdAt.toISOString(),
        updatedAt: role.updatedAt.toISOString()
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error creating role');
      throw error;
    }
  }

  /**
   * Atualizar role de usuário
   */
  async updateRole(roleId: string, roleData: any): Promise<any> {
    try {
      logger.info({ roleId, roleData }, 'Attempting to update role');

      // Se está marcando como padrão, verificar se já existe outro role padrão
      if (roleData.isDefault) {
        const existingDefaultRole = await (prisma as any).userRole.findFirst({
          where: { 
            isDefault: true,
            id: { not: roleId } // Excluir o role atual da verificação
          }
        });

        if (existingDefaultRole) {
          throw new CustomError('Já existe um role padrão. Apenas um role pode ser marcado como padrão.', 400, 'DEFAULT_ROLE_EXISTS');
        }
      }

      const role = await (prisma as any).userRole.update({
        where: { id: roleId },
        data: {
          name: roleData.name,
          description: roleData.description,
          permissions: roleData.permissions || [],
          isDefault: roleData.isDefault !== undefined ? roleData.isDefault : undefined
        }
      });

      logger.info({ roleId }, 'Role updated successfully');
      
      return {
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isSystem: role.isSystem,
        isDefault: role.isDefault,
        createdAt: role.createdAt.toISOString(),
        updatedAt: role.updatedAt.toISOString()
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error updating role');
      throw error;
    }
  }

  /**
   * Excluir role de usuário
   */
  async deleteRole(roleId: string): Promise<void> {
    try {
      logger.info({ roleId }, 'Attempting to delete role');

      // Verificar se há usuários usando este role
      const usersWithRole = await (prisma as any).user.count({
        where: { roleId }
      });

      if (usersWithRole > 0) {
        throw new CustomError('Não é possível excluir um role que está sendo usado por usuários', 400, 'ROLE_IN_USE');
      }

      await (prisma as any).userRole.delete({
        where: { id: roleId }
      });

      logger.info({ roleId }, 'Role deleted successfully');
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error deleting role');
      throw error;
    }
  }

  /**
   * Ativar usuário pendente
   */
  async activateUser(userId: string): Promise<Omit<User, 'password'>> {
    try {
      logger.info({ userId }, 'Attempting to activate user');

      // Buscar usuário
      const user = await (prisma as any).user.findUnique({
        where: { id: userId },
        include: { role: true }
      });

      if (!user) {
        throw new CustomError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
      }

      if (user.status === 'active') {
        throw new CustomError('Usuário já está ativo', 400, 'USER_ALREADY_ACTIVE');
      }

      // Ativar usuário
      const updatedUser = await (prisma as any).user.update({
        where: { id: userId },
        data: {
          status: 'active',
          isActive: true
        },
        include: { role: true }
      });

      logger.info({ userId: updatedUser.id }, 'User activated successfully');

      return this.convertDbUserToUser(updatedUser);
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error during user activation');
      throw error;
    }
  }

  /**
   * Vincular usuário com desenvolvedor automaticamente
   */
  private async linkWithDeveloper(userId: string, email: string, azureAdId?: string): Promise<void> {
    try {
      logger.info({ userId, email, azureAdId }, 'Attempting to link user with developer');

      // Buscar desenvolvedor por email ou azureId
      let developer = null;
      
      if (azureAdId) {
        developer = await (prisma as any).developer.findFirst({
          where: {
            OR: [
              { email: email },
              { azureId: azureAdId }
            ]
          }
        });
      } else {
        developer = await (prisma as any).developer.findUnique({
          where: { email: email }
        });
      }

      if (developer) {
        // Vincular usuário com desenvolvedor
        await (prisma as any).user.update({
          where: { id: userId },
          data: { developerId: developer.id }
        });

        logger.info({ userId, developerId: developer.id }, 'User successfully linked with developer');
      } else {
        logger.info({ userId, email }, 'No matching developer found for automatic linking');
      }
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error during developer linking');
      // Não falhar o login se o vínculo falhar
    }
  }

  /**
   * Vincular usuário com desenvolvedor manualmente
   */
  async linkUserWithDeveloper(userId: string, developerId: string): Promise<Omit<User, 'password'>> {
    try {
      logger.info({ userId, developerId }, 'Attempting to link user with developer');

      // Verificar se o desenvolvedor existe
      const developer = await (prisma as any).developer.findUnique({
        where: { id: developerId }
      });

      if (!developer) {
        throw new CustomError('Desenvolvedor não encontrado', 404, 'DEVELOPER_NOT_FOUND');
      }

      // Verificar se o usuário existe
      const user = await (prisma as any).user.findUnique({
        where: { id: userId },
        include: { role: true }
      });

      if (!user) {
        throw new CustomError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
      }

      // Vincular usuário com desenvolvedor
      const updatedUser = await (prisma as any).user.update({
        where: { id: userId },
        data: { developerId: developerId },
        include: { role: true }
      });

      logger.info({ userId, developerId }, 'User successfully linked with developer');

      return this.convertDbUserToUser(updatedUser);
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error during user-developer linking');
      throw error;
    }
  }

  /**
   * Desvincular usuário do desenvolvedor
   */
  async unlinkUserFromDeveloper(userId: string): Promise<Omit<User, 'password'>> {
    try {
      logger.info({ userId }, 'Attempting to unlink user from developer');

      // Verificar se o usuário existe
      const user = await (prisma as any).user.findUnique({
        where: { id: userId },
        include: { role: true }
      });

      if (!user) {
        throw new CustomError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
      }

      // Desvincular usuário do desenvolvedor
      const updatedUser = await (prisma as any).user.update({
        where: { id: userId },
        data: { developerId: null },
        include: { role: true }
      });

      logger.info({ userId }, 'User successfully unlinked from developer');

      return this.convertDbUserToUser(updatedUser);
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error during user-developer unlinking');
      throw error;
    }
  }

  /**
   * Gerar token de acesso
   */
  private generateAccessToken(user: any): string {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role?.name || 'user',
      iat: Math.floor(Date.now() / 1000), // timestamp único
      jti: crypto.randomUUID() // ID único do token
    };

    return (jwt as any).sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN
    });
  }

  /**
   * Gerar token de refresh
   */
  private generateRefreshToken(user: any): string {
    const payload = {
      userId: user.id,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000), // timestamp único
      jti: crypto.randomUUID() // ID único do token
    };

    return (jwt as any).sign(payload, this.JWT_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRES_IN
    });
  }
}
