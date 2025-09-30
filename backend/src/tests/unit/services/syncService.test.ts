import { SyncService } from '@/services/syncService';
import { prisma } from '@/config/database';
import { SyncServiceClient } from '@/services/syncServiceClient';

// Mock do Prisma
jest.mock('@/config/database', () => ({
  prisma: {
    repository: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    syncJob: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

// Mock do SyncServiceClient
jest.mock('@/services/syncServiceClient');

// Mock do logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('SyncService', () => {
  let syncService: SyncService;
  let mockSyncServiceClient: jest.Mocked<SyncServiceClient>;

  beforeEach(() => {
    // Resetar mocks
    jest.clearAllMocks();
    
    // Criar instância do SyncService
    syncService = new SyncService();
    
    // Obter mock do SyncServiceClient
    mockSyncServiceClient = (syncService as any).syncServiceClient;
  });

  describe('startSync', () => {
    it('deve iniciar sincronização com sucesso e atualizar lastSyncAt quando há novos dados', async () => {
      const repositoryId = 'repo-id-123';
      const syncType = 'incremental';

      const repository = {
        id: repositoryId,
        name: 'Test Repo',
        organizationName: 'test-org',
        projectName: 'test-project',
        lastSyncAt: null,
      };

      const job = {
        id: 'job-id-123',
        repositoryId,
        status: 'running',
        syncType,
        createdAt: new Date(),
        completedAt: null,
        error: null,
      };

      const syncResult = {
        success: true,
        hasNewData: true,
        recordsProcessed: 10,
        duration: 1500, // milliseconds
      };

      // Mock: Encontrar repositório
      (prisma.repository.findUnique as jest.Mock).mockResolvedValue(repository);
      
      // Mock: Sync service está saudável
      mockSyncServiceClient.isHealthy.mockResolvedValue(true);
      
      // Mock: Iniciar sync manual
      mockSyncServiceClient.startManualSync.mockResolvedValue(syncResult);
      
      // Mock: Criar job
      (prisma.syncJob.create as jest.Mock).mockResolvedValue(job);
      
      // Mock: Atualizar job para completed
      (prisma.syncJob.update as jest.Mock).mockResolvedValue({ ...job, status: 'completed' });
      
      // Mock: Atualizar lastSyncAt do repositório
      (prisma.repository.update as jest.Mock).mockResolvedValue(repository);

      const result = await syncService.startSync(repositoryId, syncType);

      // Verificações
      expect(prisma.repository.findUnique).toHaveBeenCalledWith({
        where: { id: repositoryId },
      });
      expect(mockSyncServiceClient.isHealthy).toHaveBeenCalled();
      expect(mockSyncServiceClient.startManualSync).toHaveBeenCalledWith(repositoryId, syncType);
      expect(prisma.syncJob.create).toHaveBeenCalledWith({
        data: {
          repositoryId,
          status: 'running',
          syncType,
        },
      });
      expect(prisma.syncJob.update).toHaveBeenCalledWith({
        where: { id: job.id },
        data: {
          status: 'completed',
          completedAt: expect.any(Date),
        },
      });
      expect(prisma.repository.update).toHaveBeenCalledWith({
        where: { id: repositoryId },
        data: {
          lastSyncAt: expect.any(Date),
        },
      });
      
      expect(result).toEqual(expect.objectContaining({
        id: job.id,
        repositoryId,
        result: syncResult,
      }));
    });

    it('deve iniciar sincronização mas NÃO atualizar lastSyncAt quando não há novos dados', async () => {
      const repositoryId = 'repo-id-123';
      const syncType = 'incremental';

      const repository = {
        id: repositoryId,
        name: 'Test Repo',
        lastSyncAt: new Date(),
      };

      const job = {
        id: 'job-id-123',
        repositoryId,
        status: 'running',
        syncType,
      };

      const syncResult = {
        success: true,
        hasNewData: false, // Nenhum dado novo
        recordsProcessed: 0,
        duration: 500,
      };

      // Mock: Encontrar repositório
      (prisma.repository.findUnique as jest.Mock).mockResolvedValue(repository);
      
      // Mock: Sync service está saudável
      mockSyncServiceClient.isHealthy.mockResolvedValue(true);
      
      // Mock: Iniciar sync manual
      mockSyncServiceClient.startManualSync.mockResolvedValue(syncResult);
      
      // Mock: Criar job
      (prisma.syncJob.create as jest.Mock).mockResolvedValue(job);
      
      // Mock: Atualizar job para completed
      (prisma.syncJob.update as jest.Mock).mockResolvedValue({ ...job, status: 'completed' });

      await syncService.startSync(repositoryId, syncType);

      // Verificações
      expect(prisma.syncJob.update).toHaveBeenCalledWith({
        where: { id: job.id },
        data: {
          status: 'completed',
          completedAt: expect.any(Date),
        },
      });
      
      // lastSyncAt NÃO deve ser atualizado
      expect(prisma.repository.update).not.toHaveBeenCalled();
    });

    it('deve lançar erro se o repositório não existir', async () => {
      const repositoryId = 'non-existent-repo';

      // Mock: Repositório não encontrado
      (prisma.repository.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(syncService.startSync(repositoryId)).rejects.toThrow('Repository');
    });

    it('deve lançar erro se o sync service não estiver disponível', async () => {
      const repositoryId = 'repo-id-123';

      const repository = {
        id: repositoryId,
        name: 'Test Repo',
      };

      // Mock: Encontrar repositório
      (prisma.repository.findUnique as jest.Mock).mockResolvedValue(repository);
      
      // Mock: Sync service NÃO está saudável
      mockSyncServiceClient.isHealthy.mockResolvedValue(false);

      await expect(syncService.startSync(repositoryId)).rejects.toThrow('Sync service is not available');
    });

    it('deve marcar job como failed quando a sincronização falha', async () => {
      const repositoryId = 'repo-id-123';
      const syncType = 'full';

      const repository = {
        id: repositoryId,
        name: 'Test Repo',
      };

      const job = {
        id: 'job-id-123',
        repositoryId,
        status: 'running',
        syncType,
      };

      const syncResult = {
        success: false,
        error: 'Connection timeout',
        hasNewData: false,
        duration: 3000,
      };

      // Mock: Encontrar repositório
      (prisma.repository.findUnique as jest.Mock).mockResolvedValue(repository);
      
      // Mock: Sync service está saudável
      mockSyncServiceClient.isHealthy.mockResolvedValue(true);
      
      // Mock: Iniciar sync manual mas falha
      mockSyncServiceClient.startManualSync.mockResolvedValue(syncResult);
      
      // Mock: Criar job
      (prisma.syncJob.create as jest.Mock).mockResolvedValue(job);
      
      // Mock: Atualizar job para failed
      (prisma.syncJob.update as jest.Mock).mockResolvedValue({ ...job, status: 'failed' });

      const result = await syncService.startSync(repositoryId, syncType);

      // Verificações
      expect(prisma.syncJob.update).toHaveBeenCalledWith({
        where: { id: job.id },
        data: {
          status: 'failed',
          completedAt: expect.any(Date),
          error: syncResult.error,
        },
      });
      
      // lastSyncAt NÃO deve ser atualizado em caso de falha
      expect(prisma.repository.update).not.toHaveBeenCalled();
      
      expect(result.result.success).toBe(false);
    });
  });

  describe('getSyncStatus', () => {
    it('deve retornar status da sincronização combinando dados locais e do sync service', async () => {
      const repositoryId = 'repo-id-123';

      const localStatus = {
        lastSync: new Date(),
        totalJobs: 5,
        completedJobs: 4,
        failedJobs: 1,
      };

      const syncServiceStatus = {
        isRunning: false,
        lastRun: new Date(),
      };

      // Mock: Status do sync service
      mockSyncServiceClient.getSyncStatus.mockResolvedValue(syncServiceStatus);
      
      // Mock: Status local
      (prisma.syncJob.findMany as jest.Mock).mockResolvedValue([
        { status: 'completed' },
        { status: 'completed' },
        { status: 'completed' },
        { status: 'completed' },
        { status: 'failed' },
      ]);
      
      (prisma.syncJob.findFirst as jest.Mock).mockResolvedValue({
        completedAt: localStatus.lastSync,
      });

      const result = await syncService.getSyncStatus(repositoryId);

      // Verificações
      expect(mockSyncServiceClient.getSyncStatus).toHaveBeenCalledWith(repositoryId);
      expect(result).toHaveProperty('syncService');
      expect(result.syncService).toEqual(syncServiceStatus);
    });

    it('deve fazer fallback para status local quando sync service falha', async () => {
      const repositoryId = 'repo-id-123';

      const latestJob = {
        id: 'job-id-123',
        repositoryId,
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
        error: null,
      };

      // Mock: Erro ao buscar status do sync service
      mockSyncServiceClient.getSyncStatus.mockRejectedValue(new Error('Service unavailable'));
      
      // Mock: Status local funciona como fallback
      (prisma.syncJob.findFirst as jest.Mock).mockResolvedValue(latestJob);

      const result = await syncService.getSyncStatus(repositoryId);

      // Verificações
      expect(mockSyncServiceClient.getSyncStatus).toHaveBeenCalledWith(repositoryId);
      expect(result).toEqual({
        repositoryId,
        jobId: latestJob.id,
        status: latestJob.status,
        startedAt: latestJob.startedAt,
        completedAt: latestJob.completedAt,
        error: latestJob.error,
      });
      
      // syncService não deve estar presente (fallback para local apenas)
      expect(result).not.toHaveProperty('syncService');
    });
  });

  // Nota: getLocalSyncStatus é um método privado, então não testamos diretamente.
  // Ele é testado indiretamente através do método getSyncStatus.
});
