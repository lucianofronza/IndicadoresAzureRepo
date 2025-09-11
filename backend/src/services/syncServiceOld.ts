import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';
import { acquireLock, releaseLock, cacheKeys } from '@/config/redis';
import { NotFoundError, ConflictError } from '@/middlewares/errorHandler';
import { AzureSyncService } from './azureSyncService';

export class SyncService {
  private azureSync: AzureSyncService;

  constructor() {
    this.azureSync = new AzureSyncService();
  }

  async startSync(repositoryId: string, syncType: 'full' | 'incremental' = 'incremental'): Promise<any> {
    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
    });

    if (!repository) {
      throw new NotFoundError('Repository');
    }

    // Check if sync is already running
    const lockKey = cacheKeys.syncLock(repositoryId);
    const hasLock = await acquireLock(lockKey, 3600); // 1 hour lock

    if (!hasLock) {
      throw new ConflictError('Sync already in progress for this repository');
    }

    try {
      // Create sync job
      const job = await prisma.syncJob.create({
        data: {
          repositoryId,
          status: 'pending',
          syncType: syncType,
        },
      });

      // Start sync in background
      this.performSync(repositoryId, job.id, syncType).catch(error => {
        logger.error('Sync failed:', error);
      });

      return job;
    } catch (error) {
      await releaseLock(lockKey);
      throw error;
    }
  }

  private async performSync(repositoryId: string, jobId: string, syncType: 'full' | 'incremental' = 'incremental'): Promise<void> {
    const lockKey = cacheKeys.syncLock(repositoryId);

    try {
      // Update job status to running
      await prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: 'running',
          startedAt: new Date(),
        },
      });

      // Add timeout for the entire sync process
      const syncPromise = this.azureSync.syncRepository(repositoryId, syncType);
      const timeoutPromise = new Promise((_, reject) => {
        const timeout = syncType === 'full' ? 1800000 : 900000; // 30 min for full, 15 min for incremental
        setTimeout(() => reject(new Error(`Sync timeout: process took longer than ${timeout / 60000} minutes`)), timeout);
      });

      await Promise.race([syncPromise, timeoutPromise]);

      // Update repository lastSyncAt
      await prisma.repository.update({
        where: { id: repositoryId },
        data: {
          lastSyncAt: new Date(),
        },
      });

      // Update job status to completed
      await prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });

      logger.info({ repositoryId, jobId, syncType }, 'Sync completed successfully');
    } catch (error) {
      // Update job status to failed
      await prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      logger.error({ repositoryId, jobId, syncType, error }, 'Sync failed');
      throw error;
    } finally {
      await releaseLock(lockKey);
    }
  }

  async getSyncStatus(repositoryId: string): Promise<any> {
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
    const lockKey = cacheKeys.syncLock(repositoryId);
    await releaseLock(lockKey);

    // Update running jobs to failed
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
}
