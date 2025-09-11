import * as cron from 'node-cron';
import { Server as SocketIOServer } from 'socket.io';
import { getPrisma } from '@/config/database';
import { getRedis, cacheKeys, acquireLock, releaseLock } from '@/config/redis';
import { logger, logSchedulerEvent } from '@/utils/logger';
import { syncMetrics, updateSchedulerStatus, recordSyncJob } from '@/utils/metrics';
import { NotificationService } from './notificationService';
import { SyncOrchestrator } from './syncOrchestrator';

export interface SchedulerConfig {
  id: string;
  enabled: boolean;
  intervalMinutes: number;
  maxConcurrentRepos: number;
  delayBetweenReposSeconds: number;
  maxRetries: number;
  retryDelayMinutes: number;
  notificationEnabled: boolean;
  notificationRecipients: string[];
  azureRateLimitPerMinute: number;
  azureBurstLimit: number;
}

export interface SchedulerStatus {
  id: string;
  isRunning: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  currentBatchId: string | null;
  totalReposProcessed: number;
  successfulSyncs: number;
  failedSyncs: number;
  lastError: string | null;
}

export class SchedulerService {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  private currentBatchId: string | null = null;
  private syncOrchestrator: SyncOrchestrator;
  private notificationService: NotificationService;
  private io: SocketIOServer;

  constructor(notificationService: NotificationService, io: SocketIOServer) {
    this.notificationService = notificationService;
    this.io = io;
    this.syncOrchestrator = new SyncOrchestrator(notificationService, io);
  }

  async start(): Promise<void> {
    try {
      const config = await this.getConfig();
      
      if (!config.enabled) {
        logger.info('Scheduler is disabled in configuration');
        return;
      }

      if (this.isRunning) {
        logger.warn('Scheduler is already running');
        return;
      }

      // Create cron expression (every X minutes)
      const cronExpression = `*/${config.intervalMinutes} * * * *`;
      
      this.cronJob = cron.schedule(cronExpression, async () => {
        await this.executeScheduler();
      }, {
        scheduled: false,
        timezone: 'UTC'
      });

      this.cronJob.start();
      this.isRunning = true;

      await this.updateStatus({
        isRunning: true,
        nextRunAt: this.getNextRunTime(config.intervalMinutes)
      });

      updateSchedulerStatus(true);
      syncMetrics.schedulerExecutions.inc({ status: 'started' });

      logSchedulerEvent('scheduler:started', {
        intervalMinutes: config.intervalMinutes,
        cronExpression,
        nextRunAt: this.getNextRunTime(config.intervalMinutes)
      });

      // Emit WebSocket event
      this.io.to('monitoring').emit('scheduler:started', {
        timestamp: new Date().toISOString(),
        intervalMinutes: config.intervalMinutes
      });

      logger.info('Scheduler started successfully', {
        intervalMinutes: config.intervalMinutes,
        cronExpression
      });

    } catch (error) {
      logger.error('Failed to start scheduler:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      if (!this.isRunning) {
        logger.warn('Scheduler is not running');
        return;
      }

      if (this.cronJob) {
        this.cronJob.stop();
        this.cronJob = null;
      }

      this.isRunning = false;
      this.currentBatchId = null;

      await this.updateStatus({
        isRunning: false,
        nextRunAt: null
      });

      updateSchedulerStatus(false);
      syncMetrics.schedulerExecutions.inc({ status: 'stopped' });

      logSchedulerEvent('scheduler:stopped', {
        timestamp: new Date().toISOString()
      });

      // Emit WebSocket event
      this.io.to('monitoring').emit('scheduler:stopped', {
        timestamp: new Date().toISOString()
      });

      logger.info('Scheduler stopped successfully');

    } catch (error) {
      logger.error('Failed to stop scheduler:', error);
      throw error;
    }
  }

  async executeScheduler(): Promise<void> {
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.currentBatchId = batchId;

    try {
      logSchedulerEvent('scheduler:execution:started', { batchId });

      const config = await this.getConfig();
      const status = await this.getStatus();

      // Update status
      await this.updateStatus({
        lastRunAt: new Date(),
        currentBatchId: batchId,
        nextRunAt: this.getNextRunTime(config.intervalMinutes)
      });

      // Get repositories that need synchronization
      const repositories = await this.getRepositoriesToSync();

      if (repositories.length === 0) {
        logger.info('No repositories need synchronization', { batchId });
        return;
      }

      logger.info(`Starting synchronization for ${repositories.length} repositories`, {
        batchId,
        repositoryCount: repositories.length
      });

      // Process repositories with rate limiting
      let processedCount = 0;
      let successCount = 0;
      let failureCount = 0;

      for (const repository of repositories) {
        try {
          // Check if we should continue (respect max concurrent repos)
          if (processedCount >= config.maxConcurrentRepos) {
            logger.info('Reached max concurrent repositories limit', {
              batchId,
              maxConcurrent: config.maxConcurrentRepos
            });
            break;
          }

          // Execute synchronization
          const result = await this.syncOrchestrator.syncRepository(
            repository.id,
            'incremental',
            batchId
          );

          if (result.success) {
            successCount++;
            recordSyncJob(repository.id, 'incremental', 'success', result.duration);
          } else {
            failureCount++;
            recordSyncJob(repository.id, 'incremental', 'failed');
          }

          processedCount++;

          // Delay between repositories
          if (processedCount < repositories.length && config.delayBetweenReposSeconds > 0) {
            await this.delay(config.delayBetweenReposSeconds * 1000);
          }

        } catch (error) {
          failureCount++;
          logger.error('Failed to sync repository:', {
            batchId,
            repositoryId: repository.id,
            error
          });
          recordSyncJob(repository.id, 'incremental', 'failed');
        }
      }

      // Update final status
      await this.updateStatus({
        totalReposProcessed: status.totalReposProcessed + processedCount,
        successfulSyncs: status.successfulSyncs + successCount,
        failedSyncs: status.failedSyncs + failureCount,
        lastError: null
      });

      logSchedulerEvent('scheduler:execution:completed', {
        batchId,
        processedCount,
        successCount,
        failureCount
      });

      // Send notification if enabled and there were failures
      if (config.notificationEnabled && failureCount > 0) {
        await this.notificationService.sendFailureNotification({
          batchId,
          failureCount,
          totalProcessed: processedCount,
          recipients: config.notificationRecipients
        });
      }

      // Emit WebSocket event
      this.io.to('monitoring').emit('scheduler:execution:completed', {
        batchId,
        processedCount,
        successCount,
        failureCount,
        timestamp: new Date().toISOString()
      });

      logger.info('Scheduler execution completed', {
        batchId,
        processedCount,
        successCount,
        failureCount
      });

    } catch (error) {
      logger.error('Scheduler execution failed:', { batchId, error });

      await this.updateStatus({
        lastError: error instanceof Error ? error.message : 'Unknown error'
      });

      syncMetrics.schedulerExecutions.inc({ status: 'failed' });

      // Emit WebSocket event
      this.io.to('monitoring').emit('scheduler:execution:failed', {
        batchId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });

      throw error;
    } finally {
      this.currentBatchId = null;
    }
  }

  async runNow(): Promise<void> {
    if (this.isRunning) {
      logger.info('Scheduler is already running, executing immediately');
      await this.executeScheduler();
    } else {
      logger.info('Scheduler is not running, starting and executing immediately');
      await this.start();
      // Wait a bit for the scheduler to start
      await this.delay(1000);
      await this.executeScheduler();
    }
  }

  async getConfig(): Promise<SchedulerConfig> {
    const prisma = getPrisma();
    
    let config = await prisma.syncGlobalConfig.findUnique({
      where: { id: 'global' }
    });

    if (!config) {
      // Create default config
      config = await prisma.syncGlobalConfig.create({
        data: {
          id: 'global',
          enabled: true,
          intervalMinutes: parseInt(process.env.DEFAULT_SYNC_INTERVAL_MINUTES || '30'),
          maxConcurrentRepos: parseInt(process.env.MAX_CONCURRENT_REPOS || '3'),
          delayBetweenReposSeconds: parseInt(process.env.DELAY_BETWEEN_REPOS_SECONDS || '30'),
          maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
          retryDelayMinutes: parseInt(process.env.RETRY_DELAY_MINUTES || '5'),
          notificationEnabled: process.env.NOTIFICATION_ENABLED === 'true',
          notificationRecipients: process.env.NOTIFICATION_EMAILS?.split(',') || [],
          azureRateLimitPerMinute: parseInt(process.env.AZURE_RATE_LIMIT_PER_MINUTE || '60'),
          azureBurstLimit: parseInt(process.env.AZURE_BURST_LIMIT || '10')
        }
      });
    }

    return {
      id: config.id,
      enabled: config.enabled,
      intervalMinutes: config.intervalMinutes,
      maxConcurrentRepos: config.maxConcurrentRepos,
      delayBetweenReposSeconds: config.delayBetweenReposSeconds,
      maxRetries: config.maxRetries,
      retryDelayMinutes: config.retryDelayMinutes,
      notificationEnabled: config.notificationEnabled,
      notificationRecipients: config.notificationRecipients,
      azureRateLimitPerMinute: config.azureRateLimitPerMinute,
      azureBurstLimit: config.azureBurstLimit
    };
  }

  async updateConfig(config: Partial<SchedulerConfig>): Promise<SchedulerConfig> {
    const prisma = getPrisma();
    
    const updatedConfig = await prisma.syncGlobalConfig.upsert({
      where: { id: 'global' },
      update: {
        ...config,
        updatedAt: new Date()
      },
      create: {
        id: 'global',
        enabled: config.enabled ?? true,
        intervalMinutes: config.intervalMinutes ?? 30,
        maxConcurrentRepos: config.maxConcurrentRepos ?? 3,
        delayBetweenReposSeconds: config.delayBetweenReposSeconds ?? 30,
        maxRetries: config.maxRetries ?? 3,
        retryDelayMinutes: config.retryDelayMinutes ?? 5,
        notificationEnabled: config.notificationEnabled ?? true,
        notificationRecipients: config.notificationRecipients ?? [],
        azureRateLimitPerMinute: config.azureRateLimitPerMinute ?? 60,
        azureBurstLimit: config.azureBurstLimit ?? 10
      }
    });

    // If scheduler is running and interval changed, restart it
    if (this.isRunning && config.intervalMinutes) {
      logger.info('Restarting scheduler due to interval change');
      await this.stop();
      await this.start();
    }

    return this.getConfig();
  }

  async getStatus(): Promise<SchedulerStatus> {
    const prisma = getPrisma();
    
    let status = await prisma.schedulerStatus.findUnique({
      where: { id: 'scheduler' }
    });

    if (!status) {
      // Create default status
      status = await prisma.schedulerStatus.create({
        data: {
          id: 'scheduler',
          isRunning: false,
          totalReposProcessed: 0,
          successfulSyncs: 0,
          failedSyncs: 0
        }
      });
    }

    return {
      id: status.id,
      isRunning: this.isRunning,
      lastRunAt: status.lastRunAt,
      nextRunAt: status.nextRunAt,
      currentBatchId: this.currentBatchId,
      totalReposProcessed: status.totalReposProcessed,
      successfulSyncs: status.successfulSyncs,
      failedSyncs: status.failedSyncs,
      lastError: status.lastError
    };
  }

  private async updateStatus(updates: Partial<SchedulerStatus>): Promise<void> {
    const prisma = getPrisma();
    
    await prisma.schedulerStatus.upsert({
      where: { id: 'scheduler' },
      update: {
        ...updates,
        updatedAt: new Date()
      },
      create: {
        id: 'scheduler',
        isRunning: updates.isRunning ?? false,
        lastRunAt: updates.lastRunAt ?? null,
        nextRunAt: updates.nextRunAt ?? null,
        currentBatchId: updates.currentBatchId ?? null,
        totalReposProcessed: updates.totalReposProcessed ?? 0,
        successfulSyncs: updates.successfulSyncs ?? 0,
        failedSyncs: updates.failedSyncs ?? 0,
        lastError: updates.lastError ?? null
      }
    });
  }

  private async getRepositoriesToSync(): Promise<Array<{ id: string; name: string; lastSyncAt: Date | null }>> {
    const prisma = getPrisma();
    
    // Get repositories that need synchronization
    // Priority: never synced > failed syncs > old syncs
    const repositories = await prisma.repository.findMany({
      where: {
        isActive: true,
        OR: [
          { lastSyncAt: null }, // Never synced
          { 
            lastSyncAt: {
              lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Older than 24 hours
            }
          }
        ]
      },
      select: {
        id: true,
        name: true,
        lastSyncAt: true
      },
      orderBy: [
        { lastSyncAt: 'asc' }, // Never synced first
        { name: 'asc' }
      ],
      take: 50 // Limit to prevent overwhelming
    });

    return repositories;
  }

  private getNextRunTime(intervalMinutes: number): Date {
    const now = new Date();
    return new Date(now.getTime() + intervalMinutes * 60 * 1000);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getCurrentBatchId(): string | null {
    return this.currentBatchId;
  }
}
