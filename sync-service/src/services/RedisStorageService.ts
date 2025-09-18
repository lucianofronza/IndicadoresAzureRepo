import Redis from 'ioredis';
import { logger } from '../utils/logger';

export interface SyncJob {
  id: string;
  repositoryId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

export interface SyncMetrics {
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  averageDuration: number;
  lastSync: string | null;
}

export class RedisStorageService {
  private redis: Redis;
  private readonly PREFIX = 'sync_service:';

  constructor(redis: Redis) {
    this.redis = redis;
  }

  getRedis(): Redis {
    return this.redis;
  }

  // ===== GESTÃO DE JOBS =====
  
  async createSyncJob(job: SyncJob): Promise<void> {
    const key = `${this.PREFIX}job:${job.id}`;
    await this.redis.hset(key, {
      id: job.id,
      repositoryId: job.repositoryId,
      status: job.status,
      startedAt: job.startedAt,
      completedAt: job.completedAt || '',
      error: job.error || '',
      retryCount: job.retryCount.toString(),
      maxRetries: job.maxRetries.toString()
    });
    
    // Adicionar à lista de jobs ativos
    await this.redis.sadd(`${this.PREFIX}active_jobs`, job.id);
    
    // Adicionar ao histórico (com TTL de 30 dias)
    await this.redis.zadd(`${this.PREFIX}job_history`, Date.now(), job.id);
    await this.redis.expire(`${this.PREFIX}job_history`, 30 * 24 * 60 * 60);
    
    logger.info(`Job ${job.id} criado e armazenado no Redis`);
  }

  async updateSyncJob(jobId: string, updates: Partial<SyncJob>): Promise<void> {
    const key = `${this.PREFIX}job:${jobId}`;
    const existingJob = await this.getSyncJob(jobId);
    
    if (!existingJob) {
      throw new Error(`Job ${jobId} não encontrado`);
    }

    const updatedJob = { ...existingJob, ...updates };
    
    await this.redis.hset(key, {
      id: updatedJob.id,
      repositoryId: updatedJob.repositoryId,
      status: updatedJob.status,
      startedAt: updatedJob.startedAt,
      completedAt: updatedJob.completedAt || '',
      error: updatedJob.error || '',
      retryCount: updatedJob.retryCount.toString(),
      maxRetries: updatedJob.maxRetries.toString()
    });

    // Se job foi completado ou falhou, remover dos ativos
    if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
      await this.redis.srem(`${this.PREFIX}active_jobs`, jobId);
    }

    logger.info(`Job ${jobId} atualizado no Redis`);
  }

  async getSyncJob(jobId: string): Promise<SyncJob | null> {
    const key = `${this.PREFIX}job:${jobId}`;
    const jobData = await this.redis.hgetall(key);
    
    if (!jobData || Object.keys(jobData).length === 0) {
      return null;
    }

    return {
      id: jobData.id,
      repositoryId: jobData.repositoryId,
      status: jobData.status as SyncJob['status'],
      startedAt: jobData.startedAt,
      completedAt: jobData.completedAt || undefined,
      error: jobData.error || undefined,
      retryCount: parseInt(jobData.retryCount),
      maxRetries: parseInt(jobData.maxRetries)
    };
  }

  async getActiveJobs(): Promise<SyncJob[]> {
    const activeJobIds = await this.redis.smembers(`${this.PREFIX}active_jobs`);
    const jobs: SyncJob[] = [];
    
    for (const jobId of activeJobIds) {
      const job = await this.getSyncJob(jobId);
      if (job) {
        jobs.push(job);
      }
    }
    
    return jobs;
  }

  async getJobHistory(limit: number = 100): Promise<SyncJob[]> {
    const jobIds = await this.redis.zrevrange(`${this.PREFIX}job_history`, 0, limit - 1);
    const jobs: SyncJob[] = [];
    
    for (const jobId of jobIds) {
      const job = await this.getSyncJob(jobId);
      if (job) {
        jobs.push(job);
      }
    }
    
    return jobs;
  }

  // ===== CACHE DE TOKENS =====
  
  async setAzureToken(token: string, expiresIn: number): Promise<void> {
    const key = `${this.PREFIX}azure_token`;
    await this.redis.setex(key, expiresIn, token);
    logger.info('Token Azure armazenado no cache');
  }

  async getAzureToken(): Promise<string | null> {
    const key = `${this.PREFIX}azure_token`;
    return await this.redis.get(key);
  }

  async clearAzureToken(): Promise<void> {
    const key = `${this.PREFIX}azure_token`;
    await this.redis.del(key);
    logger.info('Token Azure removido do cache');
  }

  // ===== LOCKS DISTRIBUÍDOS =====
  
  async acquireLock(lockKey: string, ttl: number = 300): Promise<boolean> {
    const key = `${this.PREFIX}lock:${lockKey}`;
    const result = await this.redis.set(key, '1', 'EX', ttl, 'NX');
    return result === 'OK';
  }

  async releaseLock(lockKey: string): Promise<void> {
    const key = `${this.PREFIX}lock:${lockKey}`;
    await this.redis.del(key);
  }

  async isLocked(lockKey: string): Promise<boolean> {
    const key = `${this.PREFIX}lock:${lockKey}`;
    const result = await this.redis.exists(key);
    return result === 1;
  }

  // ===== MÉTRICAS =====
  
  async updateMetrics(metrics: Partial<SyncMetrics>): Promise<void> {
    const key = `${this.PREFIX}metrics`;
    
    if (metrics.totalJobs !== undefined) {
      await this.redis.hset(key, 'totalJobs', metrics.totalJobs.toString());
    }
    if (metrics.successfulJobs !== undefined) {
      await this.redis.hset(key, 'successfulJobs', metrics.successfulJobs.toString());
    }
    if (metrics.failedJobs !== undefined) {
      await this.redis.hset(key, 'failedJobs', metrics.failedJobs.toString());
    }
    if (metrics.averageDuration !== undefined) {
      await this.redis.hset(key, 'averageDuration', metrics.averageDuration.toString());
    }
    if (metrics.lastSync !== undefined) {
      await this.redis.hset(key, 'lastSync', metrics.lastSync);
    }
  }

  async getMetrics(): Promise<SyncMetrics> {
    const key = `${this.PREFIX}metrics`;
    const metrics = await this.redis.hgetall(key);
    
    return {
      totalJobs: parseInt(metrics.totalJobs || '0'),
      successfulJobs: parseInt(metrics.successfulJobs || '0'),
      failedJobs: parseInt(metrics.failedJobs || '0'),
      averageDuration: parseFloat(metrics.averageDuration || '0'),
      lastSync: metrics.lastSync || null
    };
  }

  // ===== FILAS =====
  
  async addToQueue(queueName: string, data: any): Promise<void> {
    const key = `${this.PREFIX}queue:${queueName}`;
    await this.redis.lpush(key, JSON.stringify(data));
  }

  async getFromQueue(queueName: string): Promise<any | null> {
    const key = `${this.PREFIX}queue:${queueName}`;
    const result = await this.redis.rpop(key);
    return result ? JSON.parse(result) : null;
  }

  async getQueueLength(queueName: string): Promise<number> {
    const key = `${this.PREFIX}queue:${queueName}`;
    return await this.redis.llen(key);
  }

  // ===== LIMPEZA =====
  
  async clearAllData(): Promise<void> {
    const keys = await this.redis.keys(`${this.PREFIX}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    logger.info('Todos os dados do sync-service foram limpos do Redis');
  }

  async getHealthStatus(): Promise<{ status: string; keys: number }> {
    try {
      const keys = await this.redis.keys(`${this.PREFIX}*`);
      return {
        status: 'healthy',
        keys: keys.length
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        keys: 0
      };
    }
  }
}
