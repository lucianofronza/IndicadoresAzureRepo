import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';
import { NotFoundError } from '@/middlewares/errorHandler';
import { SyncServiceClient } from './syncServiceClient';

export class SyncService {
  private syncServiceClient: SyncServiceClient;

  constructor() {
    this.syncServiceClient = new SyncServiceClient();
  }

  async startSync(repositoryId: string, syncType: 'full' | 'incremental' = 'incremental'): Promise<any> {
    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
    });

    if (!repository) {
      throw new NotFoundError('Repository');
    }

    try {
      // Check if sync service is available
      const isHealthy = await this.syncServiceClient.isHealthy();
      if (!isHealthy) {
        throw new Error('Sync service is not available');
      }

      // Start sync via sync service
      const result = await this.syncServiceClient.startManualSync(repositoryId, syncType);

      // Create sync job record in local database for tracking
      const job = await prisma.syncJob.create({
        data: {
          repositoryId,
          status: 'running',
          syncType: syncType,
        },
      });

      // Update job status based on result
      if (result.success) {
        await prisma.syncJob.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
          },
        });

        // For manual sync, only update lastSyncAt if there was actually new data
        // This ensures consistency with automatic sync behavior
        if (result.hasNewData) {
          await prisma.repository.update({
            where: { id: repositoryId },
            data: {
              lastSyncAt: new Date(),
            },
          });
          logger.info(`Updated lastSyncAt for repository ${repositoryId} - new data found (${result.recordsProcessed} records processed)`);
        } else {
          logger.info(`Skipped lastSyncAt update for repository ${repositoryId} - no new data found since last sync`);
        }
      } else {
        // Mark as failed and don't update lastSyncAt
        await prisma.syncJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            completedAt: new Date(),
            error: result.error,
          },
        });
        
        // Don't update lastSyncAt on failure - this allows retry
        console.log(`Sync failed for repository ${repositoryId}: ${result.error}`);
      }

      return {
        ...job,
        result
      };
    } catch (error) {
      logger.error('Failed to start sync:', error);
      throw error;
    }
  }

  async getSyncStatus(repositoryId: string): Promise<any> {
    try {
      // Try to get status from sync service first
      const syncServiceStatus = await this.syncServiceClient.getSyncStatus(repositoryId);
      
      // Also get local status for comparison
      const localStatus = await this.getLocalSyncStatus(repositoryId);
      
      return {
        ...localStatus,
        syncService: syncServiceStatus
      };
    } catch (error) {
      logger.warn('Failed to get sync service status, falling back to local:', error);
      return this.getLocalSyncStatus(repositoryId);
    }
  }

  private async getLocalSyncStatus(repositoryId: string): Promise<any> {
    const latestJob = await prisma.syncJob.findFirst({
      where: { repositoryId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestJob) {
      return { status: 'no_jobs', repositoryId };
    }

    return {
      repositoryId,
      jobId: latestJob.id,
      status: latestJob.status,
      startedAt: latestJob.startedAt,
      completedAt: latestJob.completedAt,
      error: latestJob.error,
    };
  }

  async getSyncHistory(repositoryId: string, params: { page: number; pageSize: number }): Promise<any> {
    try {
      // Try to get history from sync service first
      const syncServiceHistory = await this.syncServiceClient.getSyncHistory(repositoryId, params);
      return syncServiceHistory;
    } catch (error) {
      logger.warn('Failed to get sync service history, falling back to local:', error);
      return this.getLocalSyncHistory(repositoryId, params);
    }
  }

  private async getLocalSyncHistory(repositoryId: string, params: { page: number; pageSize: number }): Promise<any> {
    const { page = 1, pageSize = 10 } = params;
    const skip = (page - 1) * pageSize;

    const [jobs, total] = await Promise.all([
      prisma.syncJob.findMany({
        where: { repositoryId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.syncJob.count({
        where: { repositoryId },
      }),
    ]);

    return {
      data: jobs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page < Math.ceil(total / pageSize),
        hasPrev: page > 1,
      },
    };
  }

  async cancelSync(repositoryId: string): Promise<void> {
    try {
      // Cancel sync via sync service
      await this.syncServiceClient.cancelSync(repositoryId);
      
      // Update local jobs
      await prisma.syncJob.updateMany({
        where: {
          repositoryId,
          status: 'running',
        },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: 'Cancelled by user',
        },
      });

      logger.info({ repositoryId }, 'Sync cancelled');
    } catch (error) {
      logger.error('Failed to cancel sync:', error);
      throw error;
    }
  }

  async getAllJobs(params: { page: number; pageSize: number; status?: string }): Promise<any> {
    const { page = 1, pageSize = 10, status } = params;
    const skip = (page - 1) * pageSize;

    const where = status ? { status } : {};

    const [jobs, total] = await Promise.all([
      prisma.syncJob.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.syncJob.count({ where }),
    ]);

    // Get repository data for each job
    const jobsWithRepositories = await Promise.all(
      jobs.map(async (job) => {
        const repository = await prisma.repository.findUnique({
          where: { id: job.repositoryId },
          select: { id: true, name: true, organization: true, project: true },
        });
        return {
          ...job,
          repository,
        };
      })
    );

    return {
      data: jobsWithRepositories,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page < Math.ceil(total / pageSize),
        hasPrev: page > 1,
      },
    };
  }

  // Scheduler management methods
  async getSchedulerStatus(): Promise<any> {
    try {
      return await this.syncServiceClient.getSchedulerStatus();
    } catch (error) {
      logger.error('Failed to get scheduler status:', error);
      throw error;
    }
  }

  async startScheduler(): Promise<void> {
    try {
      await this.syncServiceClient.startScheduler();
    } catch (error) {
      logger.error('Failed to start scheduler:', error);
      throw error;
    }
  }

  async stopScheduler(): Promise<void> {
    try {
      await this.syncServiceClient.stopScheduler();
    } catch (error) {
      logger.error('Failed to stop scheduler:', error);
      throw error;
    }
  }

  async runSchedulerNow(): Promise<void> {
    try {
      await this.syncServiceClient.runSchedulerNow();
    } catch (error) {
      logger.error('Failed to run scheduler now:', error);
      throw error;
    }
  }

  // Configuration methods
  async getSyncConfig(): Promise<any> {
    try {
      return await this.syncServiceClient.getConfig();
    } catch (error) {
      logger.error('Failed to get sync config:', error);
      throw error;
    }
  }

  async updateSyncConfig(config: any): Promise<any> {
    try {
      return await this.syncServiceClient.updateConfig(config);
    } catch (error) {
      logger.error('Failed to update sync config:', error);
      throw error;
    }
  }

  // Monitoring methods
  async getSyncMetrics(params: { days?: number } = {}): Promise<any> {
    try {
      return await this.syncServiceClient.getSyncMetrics(params);
    } catch (error) {
      logger.error('Failed to get sync metrics:', error);
      throw error;
    }
  }

  async getRepositoryStats(params: { repositoryId?: string; days?: number } = {}): Promise<any[]> {
    try {
      return await this.syncServiceClient.getRepositoryStats(params);
    } catch (error) {
      logger.error('Failed to get repository stats:', error);
      throw error;
    }
  }

  async getSystemStatus(): Promise<any> {
    try {
      return await this.syncServiceClient.getSystemStatus();
    } catch (error) {
      logger.error('Failed to get system status:', error);
      throw error;
    }
  }

  // Health check
  async isSyncServiceHealthy(): Promise<boolean> {
    try {
      return await this.syncServiceClient.isHealthy();
    } catch (error) {
      logger.error('Sync service health check failed:', error);
      return false;
    }
  }
}
