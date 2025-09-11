import { getRedis, cacheKeys } from '@/config/redis';
import { logger } from '@/utils/logger';
import { syncMetrics, recordRateLimit } from '@/utils/metrics';

export interface RateLimitConfig {
  requestsPerMinute: number;
  burstLimit: number;
  delayBetweenRequests: number; // milliseconds
}

export class RateLimiter {
  private config: RateLimitConfig;
  private requestCounts: Map<string, number[]> = new Map();
  private lastCleanup: number = Date.now();

  constructor() {
    this.config = {
      requestsPerMinute: parseInt(process.env.AZURE_RATE_LIMIT_PER_MINUTE || '60'),
      burstLimit: parseInt(process.env.AZURE_BURST_LIMIT || '10'),
      delayBetweenRequests: 1000 // 1 second between requests
    };
  }

  async waitForSlot(repositoryId: string): Promise<void> {
    const redis = getRedis();
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    try {
      // Clean up old request counts periodically
      if (now - this.lastCleanup > 300000) { // 5 minutes
        this.cleanupOldRequests();
        this.lastCleanup = now;
      }

      // Check rate limit for this repository
      const canProceed = await this.checkRateLimit(repositoryId, now, windowStart);
      
      if (!canProceed) {
        const delay = this.calculateDelay(repositoryId, now, windowStart);
        
        logger.info('Rate limit reached, waiting', {
          repositoryId,
          delay,
          requestsPerMinute: this.config.requestsPerMinute
        });

        recordRateLimit('repository', repositoryId, delay);
        
        await this.delay(delay);
      }

      // Record this request
      await this.recordRequest(repositoryId, now);

      // Add delay between requests
      if (this.config.delayBetweenRequests > 0) {
        await this.delay(this.config.delayBetweenRequests);
      }

    } catch (error) {
      logger.error('Rate limiter error:', error);
      // Continue without rate limiting if Redis is unavailable
    }
  }

  private async checkRateLimit(
    repositoryId: string,
    now: number,
    windowStart: number
  ): Promise<boolean> {
    const redis = getRedis();
    const key = cacheKeys.rateLimit(repositoryId);

    try {
      // Get request count for this repository in the current window
      const requests = await redis.zrangebyscore(
        key,
        windowStart,
        now,
        'WITHSCORES'
      );

      const requestCount = requests.length / 2; // Each request has score and value

      // Check if we're within limits
      if (requestCount >= this.config.requestsPerMinute) {
        return false;
      }

      // Check burst limit (requests in last 10 seconds)
      const burstWindowStart = now - 10000; // 10 seconds
      const burstRequests = await redis.zrangebyscore(
        key,
        burstWindowStart,
        now,
        'WITHSCORES'
      );

      const burstCount = burstRequests.length / 2;

      if (burstCount >= this.config.burstLimit) {
        return false;
      }

      return true;

    } catch (error) {
      logger.error('Error checking rate limit:', error);
      return true; // Allow request if we can't check rate limit
    }
  }

  private async recordRequest(repositoryId: string, timestamp: number): Promise<void> {
    const redis = getRedis();
    const key = cacheKeys.rateLimit(repositoryId);

    try {
      // Add this request to the sorted set
      await redis.zadd(key, timestamp, `${timestamp}-${Math.random()}`);
      
      // Set expiration for the key (cleanup)
      await redis.expire(key, 120); // 2 minutes

    } catch (error) {
      logger.error('Error recording request:', error);
    }
  }

  private calculateDelay(
    repositoryId: string,
    now: number,
    windowStart: number
  ): number {
    // Calculate how long to wait until we can make another request
    const requestsInWindow = this.getRequestCountInWindow(repositoryId, now, windowStart);
    
    if (requestsInWindow >= this.config.requestsPerMinute) {
      // Wait until the oldest request in the window expires
      const oldestRequestTime = this.getOldestRequestTime(repositoryId, now, windowStart);
      const waitTime = (oldestRequestTime + 60000) - now; // Wait until window slides
      return Math.max(waitTime, 1000); // At least 1 second
    }

    return 0;
  }

  private getRequestCountInWindow(
    repositoryId: string,
    now: number,
    windowStart: number
  ): number {
    const requests = this.requestCounts.get(repositoryId) || [];
    return requests.filter(timestamp => timestamp >= windowStart).length;
  }

  private getOldestRequestTime(
    repositoryId: string,
    now: number,
    windowStart: number
  ): number {
    const requests = this.requestCounts.get(repositoryId) || [];
    const requestsInWindow = requests.filter(timestamp => timestamp >= windowStart);
    return requestsInWindow.length > 0 ? Math.min(...requestsInWindow) : now;
  }

  private cleanupOldRequests(): void {
    const now = Date.now();
    const cutoff = now - 300000; // 5 minutes ago

    for (const [repositoryId, requests] of this.requestCounts.entries()) {
      const filteredRequests = requests.filter(timestamp => timestamp > cutoff);
      
      if (filteredRequests.length === 0) {
        this.requestCounts.delete(repositoryId);
      } else {
        this.requestCounts.set(repositoryId, filteredRequests);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getRateLimitStatus(repositoryId: string): Promise<{
    requestsInLastMinute: number;
    requestsInLast10Seconds: number;
    canMakeRequest: boolean;
    nextAvailableTime?: number;
  }> {
    const redis = getRedis();
    const now = Date.now();
    const windowStart = now - 60000;
    const burstWindowStart = now - 10000;
    const key = cacheKeys.rateLimit(repositoryId);

    try {
      const [requestsInWindow, burstRequests] = await Promise.all([
        redis.zrangebyscore(key, windowStart, now, 'WITHSCORES'),
        redis.zrangebyscore(key, burstWindowStart, now, 'WITHSCORES')
      ]);

      const requestsInLastMinute = requestsInWindow.length / 2;
      const requestsInLast10Seconds = burstRequests.length / 2;

      const canMakeRequest = 
        requestsInLastMinute < this.config.requestsPerMinute &&
        requestsInLast10Seconds < this.config.burstLimit;

      let nextAvailableTime: number | undefined;
      if (!canMakeRequest) {
        if (requestsInLastMinute >= this.config.requestsPerMinute) {
          const oldestRequest = Math.min(
            ...requestsInWindow.filter((_, index) => index % 2 === 1).map(Number)
          );
          nextAvailableTime = oldestRequest + 60000;
        } else if (requestsInLast10Seconds >= this.config.burstLimit) {
          const oldestBurstRequest = Math.min(
            ...burstRequests.filter((_, index) => index % 2 === 1).map(Number)
          );
          nextAvailableTime = oldestBurstRequest + 10000;
        }
      }

      return {
        requestsInLastMinute,
        requestsInLast10Seconds,
        canMakeRequest,
        nextAvailableTime
      };

    } catch (error) {
      logger.error('Error getting rate limit status:', error);
      return {
        requestsInLastMinute: 0,
        requestsInLast10Seconds: 0,
        canMakeRequest: true
      };
    }
  }

  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Rate limiter config updated', this.config);
  }

  getConfig(): RateLimitConfig {
    return { ...this.config };
  }
}
