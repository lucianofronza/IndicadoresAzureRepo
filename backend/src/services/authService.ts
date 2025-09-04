import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import { 
  User, 
  UserCreateInput, 
  UserUpdateInput, 
  LoginRequest, 
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  ChangePasswordRequest,
  DbUser
} from '@/types/auth';
import { CustomError } from '@/middlewares/errorHandler';

const prisma = new PrismaClient();

export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  private readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
  private readonly REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

  /**
   * Converter usuário do banco para tipo da API
   */
  private convertDbUserToUser(dbUser: DbUser): Omit<User, 'password'> {
    const { password, ...userWithoutPassword } = dbUser;
    return {
      ...userWithoutPassword,
      role: userWithoutPassword.role as 'admin' | 'user'
    } as Omit<User, 'password'>;
  }

  /**
   * Converter usuário do banco para tipo da API (com password)
   */
  private convertDbUserToUserWithPassword(dbUser: DbUser): User {
    return {
      ...dbUser,
      role: dbUser.role as 'admin' | 'user'
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
      const user = await prisma.user.create({
        data: {
          name: userData.name,
          email: userData.email,
          login: userData.login,
          password: hashedPassword,
          role: userData.role || 'user'
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
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      logger.info({ email: credentials.email }, 'Attempting user login');

      // Buscar usuário pelo email
      const user = await prisma.user.findUnique({
        where: { email: credentials.email }
      });

      if (!user) {
        throw new CustomError('Credenciais inválidas', 401, 'INVALID_CREDENTIALS');
      }

      if (!user.isActive) {
        throw new CustomError('Usuário inativo', 401, 'USER_INACTIVE');
      }

      // Verificar senha
      const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
      if (!isPasswordValid) {
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
   * Renovar token de acesso
   */
  async refreshToken(refreshData: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    try {
      logger.info('Attempting to refresh token');

      // Buscar token no banco
      const tokenRecord = await prisma.userToken.findUnique({
        where: { refreshToken: refreshData.refreshToken },
        include: { user: true }
      });

      if (!tokenRecord) {
        throw new CustomError('Token de refresh inválido', 401, 'INVALID_REFRESH_TOKEN');
      }

      if (tokenRecord.isRevoked) {
        throw new CustomError('Token de refresh revogado', 401, 'REVOKED_REFRESH_TOKEN');
      }

      if (tokenRecord.expiresAt < new Date()) {
        throw new CustomError('Token de refresh expirado', 401, 'EXPIRED_REFRESH_TOKEN');
      }

      if (!tokenRecord.user.isActive) {
        throw new CustomError('Usuário inativo', 401, 'USER_INACTIVE');
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
      const decoded = jwt.verify(accessToken, this.JWT_SECRET) as any;
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
      logger.info({ userId }, 'Attempting to update user');

      const updateData: any = { ...userData };

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
   * Listar todos os usuários (apenas admin)
   */
  async getAllUsers(): Promise<Omit<User, 'password'>[]> {
    try {
      const users = await prisma.user.findMany({
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
      // Por enquanto, retornar roles fixos do sistema
      // Em uma implementação mais avançada, isso viria do banco de dados
      return [
        {
          id: 'admin',
          name: 'admin',
          description: 'Administrador do sistema com acesso total',
          permissions: ['users:read', 'users:write', 'users:delete', 'roles:read', 'roles:write', 'roles:delete'],
          isSystem: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'user',
          name: 'user',
          description: 'Usuário padrão com acesso limitado',
          permissions: ['users:read'],
          isSystem: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error getting all roles');
      throw error;
    }
  }

  /**
   * Criar novo role de usuário
   */
  async createRole(roleData: any): Promise<any> {
    try {
      logger.info({ roleData }, 'Attempting to create role');

      // Em uma implementação mais avançada, isso seria salvo no banco de dados
      const newRole = {
        id: `role_${Date.now()}`,
        name: roleData.name,
        description: roleData.description,
        permissions: roleData.permissions || [],
        isSystem: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      logger.info({ roleId: newRole.id }, 'Role created successfully');
      return newRole;
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

      // Em uma implementação mais avançada, isso seria atualizado no banco de dados
      const updatedRole = {
        id: roleId,
        name: roleData.name,
        description: roleData.description,
        permissions: roleData.permissions || [],
        isSystem: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      logger.info({ roleId }, 'Role updated successfully');
      return updatedRole;
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

      // Em uma implementação mais avançada, isso seria excluído do banco de dados
      // Verificar se há usuários usando este role antes de excluir

      logger.info({ roleId }, 'Role deleted successfully');
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error deleting role');
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
      role: user.role
    };

    return jwt.sign(payload, this.JWT_SECRET as string, {
      expiresIn: this.JWT_EXPIRES_IN
    });
  }

  /**
   * Gerar token de refresh
   */
  private generateRefreshToken(user: any): string {
    const payload = {
      userId: user.id,
      type: 'refresh'
    };

    return jwt.sign(payload, this.JWT_SECRET as string, {
      expiresIn: this.REFRESH_TOKEN_EXPIRES_IN
    });
  }
}
