import { AuthService } from '@/services/authService';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock do Prisma
jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
    },
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

// Mock do bcrypt
jest.mock('bcryptjs');

// Mock do jsonwebtoken
jest.mock('jsonwebtoken');

// Mock do logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock do NotificationService
jest.mock('@/services/notificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: jest.fn(),
  })),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let prisma: any;

  beforeEach(() => {
    // Resetar mocks
    jest.clearAllMocks();
    
    // Instanciar Prisma mockado
    prisma = new PrismaClient();
    
    // Instanciar AuthService
    authService = new AuthService();
    
    // Configurar environment variables para testes
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.REFRESH_TOKEN_EXPIRES_IN = '7d';
  });

  describe('register', () => {
    it('deve registrar um novo usuário com sucesso', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        login: 'testuser',
        password: 'Password123!',
        roleId: 'role-id-123',
      };

      const hashedPassword = 'hashed_password_123';
      const createdUser = {
        id: 'user-id-123',
        name: userData.name,
        email: userData.email,
        login: userData.login,
        password: hashedPassword,
        roleId: userData.roleId,
        isActive: true,
        status: 'active',
        viewScope: 'own',
        createdAt: new Date(),
        updatedAt: new Date(),
        role: {
          id: 'role-id-123',
          name: 'User',
          description: 'Default user role',
          permissions: ['read'],
          isSystem: false,
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      // Mock: Verificar se email existe (não existe)
      prisma.user.findUnique.mockResolvedValueOnce(null);
      
      // Mock: Verificar se login existe (não existe)
      prisma.user.findUnique.mockResolvedValueOnce(null);
      
      // Mock: Hash da senha
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      
      // Mock: Criar usuário
      prisma.user.create.mockResolvedValue(createdUser);

      const result = await authService.register(userData);

      // Verificações
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 12);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          name: userData.name,
          email: userData.email,
          login: userData.login,
          password: hashedPassword,
          roleId: userData.roleId,
        },
        include: {
          role: true,
        },
      });
      
      expect(result).toEqual(expect.objectContaining({
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        login: createdUser.login,
        roleId: createdUser.roleId,
      }));
      
      // Senha não deve estar no resultado
      expect(result).not.toHaveProperty('password');
    });

    it('deve lançar erro se o email já existir', async () => {
      const userData = {
        name: 'Test User',
        email: 'existing@example.com',
        login: 'testuser',
        password: 'Password123!',
        roleId: 'role-id-123',
      };

      // Mock: Email já existe
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing-user-id' });

      await expect(authService.register(userData)).rejects.toThrow('Email já está em uso');
    });

    it('deve lançar erro se o login já existir', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        login: 'existinglogin',
        password: 'Password123!',
        roleId: 'role-id-123',
      };

      // Mock: Email não existe
      prisma.user.findUnique.mockResolvedValueOnce(null);
      
      // Mock: Login já existe
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing-user-id' });

      await expect(authService.register(userData)).rejects.toThrow('Login já está em uso');
    });
  });

  describe('login', () => {
    it('deve fazer login com sucesso e retornar tokens', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const userFromDb = {
        id: 'user-id-123',
        name: 'Test User',
        email: 'test@example.com',
        login: 'testuser',
        password: 'hashed_password',
        roleId: 'role-id-123',
        isActive: true,
        status: 'active',
        viewScope: 'own',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
        role: {
          id: 'role-id-123',
          name: 'User',
          description: 'Default user role',
          permissions: ['read'],
          isSystem: false,
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const accessToken = 'access_token_123';
      const refreshToken = 'refresh_token_456';

      // Mock: Encontrar usuário
      prisma.user.findUnique.mockResolvedValue(userFromDb);
      
      // Mock: Comparar senha
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      
      // Mock: Gerar tokens JWT
      (jwt.sign as jest.Mock)
        .mockReturnValueOnce(accessToken)
        .mockReturnValueOnce(refreshToken);
      
      // Mock: Atualizar lastLogin
      prisma.user.update.mockResolvedValue(userFromDb);
      
      // Mock: Criar token no banco
      prisma.userToken.create.mockResolvedValue({});

      const result = await authService.login(loginData);

      // Verificações
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: loginData.email },
        include: { role: true },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(loginData.password, userFromDb.password);
      expect(jwt.sign).toHaveBeenCalledTimes(2);
      expect(prisma.user.update).toHaveBeenCalled();
      expect(prisma.userToken.create).toHaveBeenCalled();
      
      expect(result).toEqual({
        user: expect.objectContaining({
          id: userFromDb.id,
          email: userFromDb.email,
        }),
        accessToken,
        refreshToken,
        expiresAt: expect.any(Date),
      });
    });

    it('deve lançar erro se o usuário não existir', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'Password123!',
      };

      // Mock: Usuário não encontrado
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.login(loginData)).rejects.toThrow('Credenciais inválidas');
    });

    it('deve lançar erro se a senha estiver incorreta', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      const userFromDb = {
        id: 'user-id-123',
        email: loginData.email,
        password: 'hashed_password',
        isActive: true,
        status: 'active',
        role: { name: 'User' },
      };

      // Mock: Encontrar usuário
      prisma.user.findUnique.mockResolvedValue(userFromDb);
      
      // Mock: Senha incorreta
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login(loginData)).rejects.toThrow('Credenciais inválidas');
    });

    it('deve lançar erro se o usuário estiver inativo', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const userFromDb = {
        id: 'user-id-123',
        email: loginData.email,
        password: 'hashed_password',
        isActive: false,
        status: 'inactive',
        role: { name: 'User' },
      };

      // Mock: Encontrar usuário inativo
      prisma.user.findUnique.mockResolvedValue(userFromDb);
      
      // Mock: Senha correta
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // O código usa mensagem genérica para não vazar informação
      await expect(authService.login(loginData)).rejects.toThrow('Credenciais inválidas');
    });

    it('deve fazer login mesmo com status pending se isActive for true', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const userFromDb = {
        id: 'user-id-123',
        name: 'Test User',
        email: 'test@example.com',
        login: 'testuser',
        password: 'hashed_password',
        roleId: 'role-id-123',
        isActive: true,
        status: 'pending',
        viewScope: 'own',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
        role: {
          id: 'role-id-123',
          name: 'User',
          description: 'Default user role',
          permissions: ['read'],
          isSystem: false,
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const accessToken = 'access_token_123';
      const refreshToken = 'refresh_token_456';

      // Mock: Encontrar usuário pendente mas ativo
      prisma.user.findUnique.mockResolvedValue(userFromDb);
      
      // Mock: Senha correta
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      
      // Mock: Gerar tokens JWT
      (jwt.sign as jest.Mock)
        .mockReturnValueOnce(accessToken)
        .mockReturnValueOnce(refreshToken);
      
      // Mock: Criar token no banco
      prisma.userToken.create.mockResolvedValue({});
      
      // Mock: Atualizar lastLogin
      prisma.user.update.mockResolvedValue(userFromDb);

      const result = await authService.login(loginData);

      // Deve permitir login mesmo com status pending
      expect(result).toEqual({
        user: expect.objectContaining({
          id: userFromDb.id,
          email: userFromDb.email,
        }),
        accessToken,
        refreshToken,
        expiresAt: expect.any(Date),
      });
    });
  });

  describe('refreshToken', () => {
    it('deve renovar o access token com sucesso', async () => {
      const refreshTokenData = {
        refreshToken: 'valid_refresh_token',
      };

      const decodedToken = {
        userId: 'user-id-123',
        email: 'test@example.com',
      };

      const userFromDb = {
        id: 'user-id-123',
        name: 'Test User',
        email: 'test@example.com',
        login: 'testuser',
        roleId: 'role-id-123',
        isActive: true,
        status: 'active',
        viewScope: 'own',
        role: {
          id: 'role-id-123',
          name: 'User',
          permissions: ['read'],
        },
      };

      const tokenFromDb = {
        id: 'token-id-123',
        userId: userFromDb.id,
        refreshToken: refreshTokenData.refreshToken,
        isRevoked: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias no futuro
        user: userFromDb,
      };

      const newAccessToken = 'new_access_token';
      const newRefreshToken = 'new_refresh_token';

      // Mock: Encontrar token no banco (findUnique, não findFirst)
      prisma.userToken.findUnique.mockResolvedValue(tokenFromDb);
      
      // Mock: Gerar novos tokens
      (jwt.sign as jest.Mock)
        .mockReturnValueOnce(newAccessToken)
        .mockReturnValueOnce(newRefreshToken);
      
      // Mock: Revogar token antigo
      prisma.userToken.update.mockResolvedValue({});
      
      // Mock: Criar novo token
      prisma.userToken.create.mockResolvedValue({});

      const result = await authService.refreshToken(refreshTokenData);

      // Verificações
      expect(prisma.userToken.findUnique).toHaveBeenCalledWith({
        where: { refreshToken: refreshTokenData.refreshToken },
        include: { user: true },
      });
      expect(jwt.sign).toHaveBeenCalledTimes(2);
      
      expect(result).toEqual({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: expect.any(Date),
      });
    });

    it('deve lançar erro se o refresh token for inválido', async () => {
      const refreshTokenData = {
        refreshToken: 'invalid_token',
      };

      // Mock: Token não encontrado no banco
      prisma.userToken.findUnique.mockResolvedValue(null);

      await expect(authService.refreshToken(refreshTokenData)).rejects.toThrow('Token de refresh inválido');
    });

    it('deve lançar erro se o refresh token estiver revogado', async () => {
      const refreshTokenData = {
        refreshToken: 'revoked_token',
      };

      const userFromDb = {
        id: 'user-id-123',
        name: 'Test User',
        email: 'test@example.com',
        roleId: 'role-id-123',
        isActive: true,
        status: 'active',
        viewScope: 'own',
        role: {
          id: 'role-id-123',
          name: 'User',
          permissions: ['read'],
        },
      };

      const tokenFromDb = {
        id: 'token-id-123',
        userId: userFromDb.id,
        refreshToken: refreshTokenData.refreshToken,
        isRevoked: true, // Token revogado
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: userFromDb,
      };

      // Mock: Token encontrado mas revogado
      prisma.userToken.findUnique.mockResolvedValue(tokenFromDb);

      await expect(authService.refreshToken(refreshTokenData)).rejects.toThrow('Token de refresh inválido');
    });
  });

  describe('logout', () => {
    it('deve fazer logout com sucesso', async () => {
      const accessToken = 'access_token_123';

      // Mock: Revogar tokens (updateMany, não deleteMany)
      prisma.userToken.updateMany.mockResolvedValue({ count: 1 });

      await authService.logout(accessToken);

      // Verificações
      expect(prisma.userToken.updateMany).toHaveBeenCalledWith({
        where: { accessToken },
        data: { isRevoked: true },
      });
    });

    it('deve lançar erro se houver problema ao revogar tokens', async () => {
      const accessToken = 'access_token_123';

      // Mock: Erro ao revogar tokens
      prisma.userToken.updateMany.mockRejectedValue(new Error('Database error'));

      await expect(authService.logout(accessToken)).rejects.toThrow();
    });
  });
});
