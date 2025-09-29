import request from 'supertest';
import express, { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import syncRoutes from '@/routes/sync';
import { errorHandler } from '@/middlewares/errorHandler';

// Mock do Prisma
jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    repository: {
      findUnique: jest.fn(),
    },
    syncJob: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

// Mock do SyncServiceClient
jest.mock('@/services/syncServiceClient', () => ({
  SyncServiceClient: jest.fn().mockImplementation(() => ({
    isHealthy: jest.fn().mockResolvedValue(true),
    startManualSync: jest.fn().mockResolvedValue({
      success: true,
      hasNewData: true,
      recordsProcessed: 10,
      duration: 1500,
    }),
    getSchedulerStatus: jest.fn().mockResolvedValue({
      isRunning: false,
      lastRunAt: new Date(),
      nextRunAt: new Date(),
    }),
    getSyncStatus: jest.fn().mockResolvedValue({
      isRunning: false,
      lastRun: new Date(),
    }),
  })),
}));

// Mock dos middlewares de autenticação
jest.mock('@/middlewares/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = {
      id: 'user-id-123',
      login: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
      viewScope: 'all',
    };
    next();
  },
  optionalAuth: (req: any, res: any, next: any) => next(),
}));

jest.mock('@/middlewares/permissions', () => ({
  requirePermission: () => (req: any, res: any, next: any) => next(),
}));

// Mock do logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock do rate limiter
jest.mock('@/middlewares/security', () => ({
  syncRateLimiter: (req: any, res: any, next: any) => next(),
}));

describe('Sync Integration Tests', () => {
  let app: Express;
  let prisma: any;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/sync', syncRoutes);
    app.use(errorHandler);
    
    prisma = new PrismaClient();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/sync/:repositoryId', () => {
    it.skip('deve iniciar sincronização manual com sucesso', async () => {
      const repositoryId = 'repo-id-123';

      const repository = {
        id: repositoryId,
        name: 'Test Repo',
        organization: 'test-org',
        project: 'test-project',
      };

      const job = {
        id: 'job-id-123',
        repositoryId,
        status: 'running',
        syncType: 'incremental',
        createdAt: new Date(),
      };

      // Mock: Encontrar repositório
      prisma.repository.findUnique.mockResolvedValue(repository);
      
      // Mock: Criar job
      prisma.syncJob.create.mockResolvedValue(job);
      
      // Mock: Atualizar job para completed
      prisma.syncJob.update.mockResolvedValue({ ...job, status: 'completed' });
      
      // Mock: Atualizar lastSyncAt
      prisma.repository.update = jest.fn().mockResolvedValue(repository);

      const response = await request(app)
        .post(`/api/sync/${repositoryId}`)
        .send({ syncType: 'incremental' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('repositoryId', repositoryId);
    });

    it.skip('deve retornar 404 se repositório não existir', async () => {
      const repositoryId = 'non-existent-repo';

      // Mock: Repositório não encontrado
      prisma.repository.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/sync/${repositoryId}`)
        .send({ syncType: 'full' })
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Repository');
    });

    it.skip('deve aceitar syncType full ou incremental', async () => {
      const repositoryId = 'repo-id-123';

      const repository = {
        id: repositoryId,
        name: 'Test Repo',
      };

      const job = {
        id: 'job-id-456',
        repositoryId,
        status: 'running',
        syncType: 'full',
      };

      prisma.repository.findUnique.mockResolvedValue(repository);
      prisma.syncJob.create.mockResolvedValue(job);
      prisma.syncJob.update.mockResolvedValue({ ...job, status: 'completed' });
      prisma.repository.update = jest.fn().mockResolvedValue(repository);

      const response = await request(app)
        .post(`/api/sync/${repositoryId}`)
        .send({ syncType: 'full' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/sync/:repositoryId/status', () => {
    it.skip('deve retornar status da sincronização', async () => {
      const repositoryId = 'repo-id-123';

      const latestJob = {
        id: 'job-id-123',
        repositoryId,
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
        error: null,
      };

      // Mock: Status local
      prisma.syncJob.findFirst.mockResolvedValue(latestJob);

      const response = await request(app)
        .get(`/api/sync/${repositoryId}/status`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('repositoryId', repositoryId);
      expect(response.body.data).toHaveProperty('status', 'completed');
    });

    it.skip('deve retornar status mesmo sem jobs anteriores', async () => {
      const repositoryId = 'repo-id-456';

      // Mock: Nenhum job encontrado
      prisma.syncJob.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/sync/${repositoryId}/status`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('status', 'no_jobs');
    });
  });

  describe('GET /api/sync/:repositoryId/history', () => {
    it.skip('deve retornar histórico de sincronizações', async () => {
      const repositoryId = 'repo-id-123';

      const jobs = [
        {
          id: 'job-1',
          repositoryId,
          status: 'completed',
          syncType: 'incremental',
          createdAt: new Date(),
          completedAt: new Date(),
        },
        {
          id: 'job-2',
          repositoryId,
          status: 'failed',
          syncType: 'full',
          createdAt: new Date(),
          completedAt: new Date(),
          error: 'Connection timeout',
        },
      ];

      // Mock: Histórico de jobs
      prisma.syncJob.findMany.mockResolvedValue(jobs);

      const response = await request(app)
        .get(`/api/sync/${repositoryId}/history`)
        .query({ page: 1, pageSize: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it.skip('deve suportar paginação', async () => {
      const repositoryId = 'repo-id-123';

      prisma.syncJob.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/sync/${repositoryId}/history`)
        .query({ page: 2, pageSize: 5 })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(prisma.syncJob.findMany).toHaveBeenCalled();
    });
  });

  describe('GET /api/sync/scheduler/status', () => {
    it('deve retornar status do scheduler', async () => {
      const response = await request(app)
        .get('/api/sync/scheduler/status')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('isRunning');
    });
  });
});
