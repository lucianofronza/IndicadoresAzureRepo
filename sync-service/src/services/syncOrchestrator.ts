import { Server as SocketIOServer } from 'socket.io';
import { logger, logSyncEvent } from '@/utils/logger';
import { NotificationService } from './notificationService';
import { RateLimiter } from './rateLimiter';
import { AzureSyncService } from './azureSyncService';
import { RedisStorageService } from './RedisStorageService';
import { recordSyncJob, recordAzureApiRequest } from '@/utils/metrics';

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
  private redisStorage: RedisStorageService;

  constructor(
    notificationService: NotificationService, 
    io: SocketIOServer,
    redisStorage: RedisStorageService
  ) {
    this.notificationService = notificationService;
    this.io = io;
    this.redisStorage = redisStorage;
    this.rateLimiter = new RateLimiter(redisStorage);
    this.azureSyncService = new AzureSyncService();
  }

  async syncRepository(
    repositoryId: string,
    syncType: 'full' | 'incremental' = 'incremental',
    batchId?: string
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const lockKey = `sync:${repositoryId}`;

    try {
      // Acquire lock to prevent concurrent syncs
      const hasLock = await this.redisStorage.acquireLock(lockKey, 3600); // 1 hour lock
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
      await this.redisStorage.releaseLock(lockKey);
    }
  }

  private async getRepository(repositoryId: string) {
    // For now, return a mock repository since we're not storing repository data in sync-service
    // In a real implementation, this would fetch from the backend API or config
    return {
      id: repositoryId,
      name: `Repository ${repositoryId}`,
      organization: 'default',
      project: 'default',
      isActive: true,
      lastSyncAt: null
    };
  }

  private async createSyncJob(
    repositoryId: string,
    syncType: 'full' | 'incremental',
    batchId?: string
  ) {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const job = {
      id: jobId,
      repositoryId,
      status: 'pending' as const,
      startedAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3
    };
    
    await this.redisStorage.createSyncJob(job);
    return job;
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
    const jobUpdates: any = {};
    
    if (updates.status) jobUpdates.status = updates.status;
    if (updates.startedAt) jobUpdates.startedAt = updates.startedAt.toISOString();
    if (updates.completedAt) jobUpdates.completedAt = updates.completedAt.toISOString();
    if (updates.error) jobUpdates.error = updates.error;
    
    await this.redisStorage.updateSyncJob(jobId, jobUpdates);
  }

  private async updateRepositoryLastSync(repositoryId: string) {
    // Update last sync time in Redis or config
    // For now, we'll just log it since we're not storing repository data in sync-service
    logger.info(`Repository ${repositoryId} last sync updated`);
  }

  private async saveSyncMetrics(metrics: {
    repositoryId: string;
    syncType: string;
    status: string;
    duration: number;
    recordsProcessed?: number;
    errorMessage?: string;
  }) {
    // Update metrics in Redis
    const currentMetrics = await this.redisStorage.getMetrics();
    
    const updatedMetrics = {
      totalJobs: currentMetrics.totalJobs + 1,
      successfulJobs: metrics.status === 'completed' ? currentMetrics.successfulJobs + 1 : currentMetrics.successfulJobs,
      failedJobs: metrics.status === 'failed' ? currentMetrics.failedJobs + 1 : currentMetrics.failedJobs,
      averageDuration: (currentMetrics.averageDuration + metrics.duration) / 2,
      lastSync: new Date().toISOString()
    };
    
    await this.redisStorage.updateMetrics(updatedMetrics);
  }

  private async handleSyncFailure(
    repositoryId: string,
    errorMessage: string,
    batchId?: string
  ) {
    try {
      // Get recent failed jobs from Redis
      const recentJobs = await this.redisStorage.getJobHistory(100);
      const recentFailures = recentJobs.filter(job => 
        job.repositoryId === repositoryId && 
        job.status === 'failed' &&
        new Date(job.startedAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length;

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
    const recentJobs = await this.redisStorage.getJobHistory(100);
    const latestJob = recentJobs.find(job => job.repositoryId === repositoryId);

    if (!latestJob) {
      return { status: 'no_jobs', repositoryId };
    }

    return {
      repositoryId,
      jobId: latestJob.id,
      status: latestJob.status,
      startedAt: latestJob.startedAt,
      completedAt: latestJob.completedAt,
      error: latestJob.error
    };
  }

  async getSyncHistory(
    repositoryId: string,
    params: { page: number; pageSize: number }
  ) {
    const { page = 1, pageSize = 10 } = params;
    
    const allJobs = await this.redisStorage.getJobHistory(1000);
    const repositoryJobs = allJobs.filter(job => job.repositoryId === repositoryId);
    
    const total = repositoryJobs.length;
    const skip = (page - 1) * pageSize;
    const jobs = repositoryJobs.slice(skip, skip + pageSize);

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
    const lockKey = `sync:${repositoryId}`;
    await this.redisStorage.releaseLock(lockKey);

    // Update running jobs to cancelled status
    const activeJobs = await this.redisStorage.getActiveJobs();
    const runningJobs = activeJobs.filter(job => 
      job.repositoryId === repositoryId && job.status === 'running'
    );

    for (const job of runningJobs) {
      await this.redisStorage.updateSyncJob(job.id, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: 'Cancelled by user'
      });
    }

    logSyncEvent('sync:cancelled', { repositoryId });
  }
}
