import * as cron from 'node-cron';
import { Server as SocketIOServer } from 'socket.io';
import { logger, logSchedulerEvent } from '@/utils/logger';
import { NotificationService } from './notificationService';
import { SyncOrchestrator } from './syncOrchestrator';
import { RedisStorageService } from './RedisStorageService';
import { ConfigService } from './ConfigService';

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
  private redisStorage: RedisStorageService;
  private configService: ConfigService;

  constructor(
    notificationService: NotificationService, 
    io: SocketIOServer,
    redisStorage: RedisStorageService,
    configService: ConfigService
  ) {
    this.notificationService = notificationService;
    this.io = io;
    this.redisStorage = redisStorage;
    this.configService = configService;
    this.syncOrchestrator = new SyncOrchestrator(notificationService, io, redisStorage);
  }

  async start(): Promise<void> {
    try {
      const config = this.configService.getConfig();
      
      if (!config.scheduler.enabled) {
        logger.info('Scheduler is disabled in configuration');
        return;
      }

      if (this.isRunning) {
        logger.warn('Scheduler is already running');
        return;
      }

      // Check if scheduler is already running on another instance
      const lockKey = 'scheduler:global';
      const lockAcquired = await this.redisStorage.acquireLock(lockKey, 300); // 5 minutes lock
      
      if (!lockAcquired) {
        logger.warn('Scheduler is already running on another instance');
        return;
      }

      // Create cron expression (every X minutes)
      const cronExpression = `*/${config.sync.defaultIntervalMinutes} * * * *`;
      
      this.cronJob = cron.schedule(cronExpression, async () => {
        await this.executeScheduler();
      }, {
        scheduled: false,
        timezone: 'UTC'
      });

      this.cronJob.start();
      this.isRunning = true;

      // Update scheduler status in config
      const nextRunTime = this.getNextRunTime(config.sync.defaultIntervalMinutes);
      this.configService.updateSchedulerStatus(null, nextRunTime.toISOString());
      await this.configService.saveConfig();

      logSchedulerEvent('scheduler:started', {
        intervalMinutes: config.sync.defaultIntervalMinutes,
        cronExpression,
        nextRunAt: nextRunTime
      });

      // Emit WebSocket event
      this.io.to('monitoring').emit('scheduler:started', {
        timestamp: new Date().toISOString(),
        intervalMinutes: config.sync.defaultIntervalMinutes
      });

      logger.info('Scheduler started successfully', {
        intervalMinutes: config.sync.defaultIntervalMinutes,
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

      // Release the lock
      await this.redisStorage.releaseLock('scheduler:global');

      // Update scheduler status in config
      this.configService.updateSchedulerStatus(new Date().toISOString(), null);
      await this.configService.saveConfig();

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

      const config = this.configService.getConfig();

      // Update status
      const nextRunTime = this.getNextRunTime(config.sync.defaultIntervalMinutes);
      this.configService.updateSchedulerStatus(new Date().toISOString(), nextRunTime.toISOString());
      await this.configService.saveConfig();

      // Get repositories that need synchronization
      const repositories = this.configService.getRepositories();

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
    const config = this.configService.getConfig();
    
    return {
      id: 'global',
      enabled: config.scheduler.enabled,
      intervalMinutes: config.sync.defaultIntervalMinutes,
      maxConcurrentRepos: config.sync.maxConcurrentRepos,
      delayBetweenReposSeconds: config.sync.delayBetweenReposSeconds,
      maxRetries: config.sync.maxRetries,
      retryDelayMinutes: config.sync.retryDelayMinutes,
      notificationEnabled: config.sync.notifications.enabled,
      notificationRecipients: config.sync.notifications.emails,
      azureRateLimitPerMinute: config.sync.azure.rateLimitPerMinute,
      azureBurstLimit: config.sync.azure.burstLimit
    };
  }

  async updateConfig(config: Partial<SchedulerConfig>): Promise<SchedulerConfig> {
    const currentConfig = this.configService.getConfig();
    
    // Update configuration
    this.configService.updateConfig({
      sync: {
        ...currentConfig.sync,
        defaultIntervalMinutes: config.intervalMinutes ?? currentConfig.sync.defaultIntervalMinutes,
        maxConcurrentRepos: config.maxConcurrentRepos ?? currentConfig.sync.maxConcurrentRepos,
        delayBetweenReposSeconds: config.delayBetweenReposSeconds ?? currentConfig.sync.delayBetweenReposSeconds,
        maxRetries: config.maxRetries ?? currentConfig.sync.maxRetries,
        retryDelayMinutes: config.retryDelayMinutes ?? currentConfig.sync.retryDelayMinutes,
        notifications: {
          ...currentConfig.sync.notifications,
          enabled: config.notificationEnabled ?? currentConfig.sync.notifications.enabled,
          emails: config.notificationRecipients ?? currentConfig.sync.notifications.emails
        },
        azure: {
          ...currentConfig.sync.azure,
          rateLimitPerMinute: config.azureRateLimitPerMinute ?? currentConfig.sync.azure.rateLimitPerMinute,
          burstLimit: config.azureBurstLimit ?? currentConfig.sync.azure.burstLimit
        }
      },
      scheduler: {
        ...currentConfig.scheduler,
        enabled: config.enabled ?? currentConfig.scheduler.enabled
      }
    });

    // Save configuration
    await this.configService.saveConfig();

    // Auto-enable scheduler if it was disabled but user is configuring it
    if (!currentConfig.scheduler.enabled && !this.isRunning) {
      logger.info('Auto-enabling scheduler as user is configuring it');
      this.configService.updateConfig({
        scheduler: { ...currentConfig.scheduler, enabled: true }
      });
      await this.configService.saveConfig();
    }

    // If scheduler is running and interval changed, restart it
    if (this.isRunning && config.intervalMinutes) {
      logger.info('Restarting scheduler due to interval change');
      await this.stop();
      await this.start();
    }
    
    // If scheduler is not running but should be enabled, start it
    if (!this.isRunning && currentConfig.scheduler.enabled) {
      logger.info('Starting scheduler as it should be enabled');
      await this.start();
    }

    return this.getConfig();
  }

  async getStatus(): Promise<SchedulerStatus> {
    const config = this.configService.getConfig();
    const metrics = await this.redisStorage.getMetrics();
    
    return {
      id: 'scheduler',
      isRunning: this.isRunning,
      lastRunAt: config.scheduler.lastRun ? new Date(config.scheduler.lastRun) : null,
      nextRunAt: config.scheduler.nextRun ? new Date(config.scheduler.nextRun) : null,
      currentBatchId: this.currentBatchId,
      totalReposProcessed: metrics.totalJobs,
      successfulSyncs: metrics.successfulJobs,
      failedSyncs: metrics.failedJobs,
      lastError: null // Could be stored in Redis if needed
    };
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
