import Redis from 'ioredis';
import { logger } from '@/utils/logger';

let redis: Redis;

export const connectRedis = async (): Promise<void> => {
  try {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
    });

    redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    redis.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    redis.on('close', () => {
      logger.warn('Redis connection closed');
    });

    await redis.connect();
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
};

export const disconnectRedis = async (): Promise<void> => {
  try {
    if (redis) {
      await redis.quit();
      logger.info('Redis disconnected successfully');
    }
  } catch (error) {
    logger.error('Error disconnecting from Redis:', error);
    throw error;
  }
};

export const getRedis = (): Redis => {
  if (!redis) {
    throw new Error('Redis not connected. Call connectRedis() first.');
  }
  return redis;
};

export const healthCheck = async (): Promise<boolean> => {
  try {
    if (!redis) {
      return false;
    }
    await redis.ping();
    return true;
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return false;
  }
};

// Cache keys for sync operations
export const cacheKeys = {
  syncLock: (repositoryId: string) => `sync:lock:${repositoryId}`,
  syncQueue: () => 'sync:queue',
  syncConfig: () => 'sync:config',
  schedulerStatus: () => 'scheduler:status',
  rateLimit: (key: string) => `rate:limit:${key}`,
  notificationQueue: () => 'notification:queue',
};

// Lock management
export const acquireLock = async (key: string, ttlSeconds: number = 3600): Promise<boolean> => {
  try {
    const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch (error) {
    logger.error('Failed to acquire lock:', error);
    return false;
  }
};

export const releaseLock = async (key: string): Promise<void> => {
  try {
    await redis.del(key);
  } catch (error) {
    logger.error('Failed to release lock:', error);
  }
};

// Queue management
export const addToQueue = async (queueKey: string, data: any): Promise<void> => {
  try {
    await redis.lpush(queueKey, JSON.stringify(data));
  } catch (error) {
    logger.error('Failed to add to queue:', error);
    throw error;
  }
};

export const getFromQueue = async (queueKey: string): Promise<any | null> => {
  try {
    const result = await redis.rpop(queueKey);
    return result ? JSON.parse(result) : null;
  } catch (error) {
    logger.error('Failed to get from queue:', error);
    return null;
  }
};

export const getQueueLength = async (queueKey: string): Promise<number> => {
  try {
    return await redis.llen(queueKey);
  } catch (error) {
    logger.error('Failed to get queue length:', error);
    return 0;
  }
};
