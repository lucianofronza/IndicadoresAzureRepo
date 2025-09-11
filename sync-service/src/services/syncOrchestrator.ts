import { Server as SocketIOServer } from 'socket.io';
import { getPrisma } from '@/config/database';
import { getRedis, cacheKeys, acquireLock, releaseLock } from '@/config/redis';
import { logger, logSyncEvent } from '@/utils/logger';
import { syncMetrics, recordSyncJob, recordAzureApiRequest } from '@/utils/metrics';
import { NotificationService } from './notificationService';
import { RateLimiter } from './rateLimiter';
import { AzureSyncService } from './azureSyncService';

export interface SyncResult {
  success: boolean;
  duration: number;
  recordsProcessed?: number;
  error?: string;
}

export class SyncOrchestrator {
  private rateLimiter: RateLimiter;
  private azureSyncService: AzureSyncService;
  private notificationService: NotificationService;
  private io: SocketIOServer;

  constructor(notificationService: NotificationService, io: SocketIOServer) {
    this.notificationService = notificationService;
    this.io = io;
    this.rateLimiter = new RateLimiter();
    this.azureSyncService = new AzureSyncService();
  }

  async syncRepository(
    repositoryId: string,
    syncType: 'full' | 'incremental' = 'incremental',
    batchId?: string
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const lockKey = cacheKeys.syncLock(repositoryId);

    try {
      // Acquire lock to prevent concurrent syncs
      const hasLock = await acquireLock(lockKey, 3600); // 1 hour lock
      if (!hasLock) {
        throw new Error('Sync already in progress for this repository');
      }

      logSyncEvent('sync:started', {
        repositoryId,
        syncType,
        batchId
      });

      // Emit WebSocket event
      this.io.to('monitoring').emit('sync:started', {
        repositoryId,
        syncType,
        batchId,
        timestamp: new Date().toISOString()
      });

      // Get repository data
      const repository = await this.getRepository(repositoryId);
      if (!repository) {
        throw new Error('Repository not found');
      }

      // Apply rate limiting
      await this.rateLimiter.waitForSlot(repositoryId);

      // Create sync job record
      const job = await this.createSyncJob(repositoryId, syncType, batchId);

      try {
        // Update job status to running
        await this.updateSyncJob(job.id, {
          status: 'running',
          startedAt: new Date()
        });

        // Execute synchronization
        const syncResult = await this.azureSyncService.syncRepository(
          repositoryId,
          syncType
        );

        const duration = Date.now() - startTime;

        // Update job status to completed
        await this.updateSyncJob(job.id, {
          status: 'completed',
          completedAt: new Date(),
          recordsProcessed: syncResult.recordsProcessed
        });

        // Update repository lastSyncAt
        await this.updateRepositoryLastSync(repositoryId);

        // Record metrics
        recordSyncJob(repositoryId, syncType, 'success', duration);
        recordAzureApiRequest('sync', 'success', duration);

        // Save metrics to database
        await this.saveSyncMetrics({
          repositoryId,
          syncType,
          status: 'success',
          duration,
          recordsProcessed: syncResult.recordsProcessed
        });

        logSyncEvent('sync:completed', {
          repositoryId,
          syncType,
          batchId,
          duration,
          recordsProcessed: syncResult.recordsProcessed
        });

        // Emit WebSocket event
        this.io.to('monitoring').emit('sync:completed', {
          repositoryId,
          syncType,
          batchId,
          success: true,
          duration,
          recordsProcessed: syncResult.recordsProcessed,
          timestamp: new Date().toISOString()
        });

        return {
          success: true,
          duration,
          recordsProcessed: syncResult.recordsProcessed
        };

      } catch (syncError) {
        const duration = Date.now() - startTime;
        const errorMessage = syncError instanceof Error ? syncError.message : 'Unknown error';

        // Update job status to failed
        await this.updateSyncJob(job.id, {
          status: 'failed',
          completedAt: new Date(),
          error: errorMessage
        });

        // Record metrics
        recordSyncJob(repositoryId, syncType, 'failed', duration);
        recordAzureApiRequest('sync', 'failed', duration);

        // Save metrics to database
        await this.saveSyncMetrics({
          repositoryId,
          syncType,
          status: 'failed',
          duration,
          errorMessage
        });

        logSyncEvent('sync:failed', {
          repositoryId,
          syncType,
          batchId,
          duration,
          error: errorMessage
        });

        // Emit WebSocket event
        this.io.to('monitoring').emit('sync:failed', {
          repositoryId,
          syncType,
          batchId,
          error: errorMessage,
          timestamp: new Date().toISOString()
        });

        // Send notification if this is a critical failure
        await this.handleSyncFailure(repositoryId, errorMessage, batchId);

        return {
          success: false,
          duration,
          error: errorMessage
        };
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Sync orchestrator error:', {
        repositoryId,
        syncType,
        batchId,
        error: errorMessage,
        duration
      });

      return {
        success: false,
        duration,
        error: errorMessage
      };
    } finally {
      // Always release the lock
      await releaseLock(lockKey);
    }
  }

  private async getRepository(repositoryId: string) {
    const prisma = getPrisma();
    return await prisma.repository.findUnique({
      where: { id: repositoryId },
      select: {
        id: true,
        name: true,
        organization: true,
        project: true,
        isActive: true,
        lastSyncAt: true
      }
    });
  }

  private async createSyncJob(
    repositoryId: string,
    syncType: 'full' | 'incremental',
    batchId?: string
  ) {
    const prisma = getPrisma();
    return await prisma.syncJob.create({
      data: {
        repositoryId,
        status: 'pending',
        syncType,
        batchId
      }
    });
  }

  private async updateSyncJob(
    jobId: string,
    updates: {
      status?: string;
      startedAt?: Date;
      completedAt?: Date;
      error?: string;
      recordsProcessed?: number;
    }
  ) {
    const prisma = getPrisma();
    return await prisma.syncJob.update({
      where: { id: jobId },
      data: updates
    });
  }

  private async updateRepositoryLastSync(repositoryId: string) {
    const prisma = getPrisma();
    return await prisma.repository.update({
      where: { id: repositoryId },
      data: {
        lastSyncAt: new Date()
      }
    });
  }

  private async saveSyncMetrics(metrics: {
    repositoryId: string;
    syncType: string;
    status: string;
    duration: number;
    recordsProcessed?: number;
    errorMessage?: string;
  }) {
    const prisma = getPrisma();
    return await prisma.syncMetrics.create({
      data: {
        repositoryId: metrics.repositoryId,
        syncType: metrics.syncType,
        status: metrics.status,
        duration: metrics.duration,
        recordsProcessed: metrics.recordsProcessed,
        errorMessage: metrics.errorMessage
      }
    });
  }

  private async handleSyncFailure(
    repositoryId: string,
    errorMessage: string,
    batchId?: string
  ) {
    try {
      // Check if this repository has been failing frequently
      const prisma = getPrisma();
      const recentFailures = await prisma.syncJob.count({
        where: {
          repositoryId,
          status: 'failed',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      // If more than 3 failures in 24 hours, send notification
      if (recentFailures >= 3) {
        await this.notificationService.sendRepositoryFailureNotification({
          repositoryId,
          errorMessage,
          failureCount: recentFailures,
          batchId
        });
      }
    } catch (notificationError) {
      logger.error('Failed to handle sync failure notification:', notificationError);
    }
  }

  async getSyncStatus(repositoryId: string) {
    const prisma = getPrisma();
    
    const latestJob = await prisma.syncJob.findFirst({
      where: { repositoryId },
      orderBy: { createdAt: 'desc' }
    });

    if (!latestJob) {
      return { status: 'no_jobs', repositoryId };
    }

    return {
      repositoryId,
      jobId: latestJob.id,
      status: latestJob.status,
      syncType: latestJob.syncType,
      startedAt: latestJob.startedAt,
      completedAt: latestJob.completedAt,
      error: latestJob.error,
      recordsProcessed: latestJob.recordsProcessed
    };
  }

  async getSyncHistory(
    repositoryId: string,
    params: { page: number; pageSize: number }
  ) {
    const { page = 1, pageSize = 10 } = params;
    const skip = (page - 1) * pageSize;

    const prisma = getPrisma();
    const [jobs, total] = await Promise.all([
      prisma.syncJob.findMany({
        where: { repositoryId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.syncJob.count({
        where: { repositoryId }
      })
    ]);

    return {
      data: jobs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page < Math.ceil(total / pageSize),
        hasPrev: page > 1
      }
    };
  }

  async cancelSync(repositoryId: string) {
    const lockKey = cacheKeys.syncLock(repositoryId);
    await releaseLock(lockKey);

    const prisma = getPrisma();
    await prisma.syncJob.updateMany({
      where: {
        repositoryId,
        status: 'running'
      },
      data: {
        status: 'failed',
        completedAt: new Date(),
        error: 'Cancelled by user'
      }
    });

    logSyncEvent('sync:cancelled', { repositoryId });
  }
}
