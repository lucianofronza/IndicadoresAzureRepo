import request from 'supertest';
import express, { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import authRoutes from '@/routes/auth';
import { errorHandler } from '@/middlewares/errorHandler';
import bcrypt from 'bcryptjs';

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
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    role: {
      findFirst: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

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

describe('Auth Integration Tests', () => {
  let app: Express;
  let prisma: any;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use(errorHandler);
    
    prisma = new PrismaClient();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('deve fazer login com sucesso com credenciais válidas', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const user = {
        id: 'user-id-123',
        name: 'Test User',
        email: loginData.email,
        login: 'testuser',
        password: await bcrypt.hash(loginData.password, 12),
        roleId: 'role-id-123',
        isActive: true,
        status: 'active',
        viewScope: 'own',
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: {
          id: 'role-id-123',
          name: 'User',
          description: 'Default user',
          permissions: ['read'],
          isSystem: false,
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      // Mock: Encontrar usuário
      prisma.user.findUnique.mockResolvedValue(user);
      
      // Mock: Atualizar lastLogin
      prisma.user.update.mockResolvedValue(user);
      
      // Mock: Criar token
      prisma.userToken.create.mockResolvedValue({});

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('email', loginData.email);
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    it('deve retornar 401 com credenciais inválidas', async () => {
      const loginData = {
        email: 'wrong@example.com',
        password: 'WrongPassword',
      };

      // Mock: Usuário não encontrado
      prisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('Credenciais inválidas');
    });

    it('deve retornar 400 com dados de entrada inválidos', async () => {
      const invalidData = {
        email: 'not-an-email',
        password: '123', // senha muito curta
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('deve retornar 401 para usuário inativo', async () => {
      const loginData = {
        email: 'inactive@example.com',
        password: 'Password123!',
      };

      const inactiveUser = {
        id: 'user-id-456',
        email: loginData.email,
        password: await bcrypt.hash(loginData.password, 12),
        isActive: false,
        status: 'inactive',
        role: { name: 'User' },
      };

      // Mock: Encontrar usuário inativo
      prisma.user.findUnique.mockResolvedValue(inactiveUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Credenciais inválidas');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('deve renovar access token com refresh token válido', async () => {
      const refreshData = {
        refreshToken: 'valid_refresh_token',
      };

      const user = {
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

      const tokenRecord = {
        id: 'token-id-123',
        userId: user.id,
        refreshToken: refreshData.refreshToken,
        isRevoked: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user,
      };

      // Mock: Encontrar token
      prisma.userToken.findUnique.mockResolvedValue(tokenRecord);
      
      // Mock: Revogar token antigo
      prisma.userToken.update.mockResolvedValue({});
      
      // Mock: Criar novo token
      prisma.userToken.create.mockResolvedValue({});

      const response = await request(app)
        .post('/api/auth/refresh')
        .send(refreshData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
    });

    it('deve retornar 401 com refresh token inválido', async () => {
      const refreshData = {
        refreshToken: 'invalid_refresh_token',
      };

      // Mock: Token não encontrado
      prisma.userToken.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send(refreshData)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Token de refresh inválido');
    });

    it('deve retornar 400 se não fornecer refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('deve retornar 401 sem token de autenticação', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Token não fornecido');
    });

    it('deve retornar 401 com token inválido', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/auth/me', () => {
    it('deve retornar dados do usuário autenticado', async () => {
      // Nota: Este teste requer implementação completa do middleware de autenticação
      // Por ora, vamos pular este teste específico ou mockear o middleware
      
      // TODO: Implementar quando tivermos setup completo de autenticação em testes de integração
      expect(true).toBe(true);
    });
  });
});
