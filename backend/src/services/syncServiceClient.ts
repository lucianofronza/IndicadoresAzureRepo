import axios, { AxiosInstance } from 'axios';
import { logger } from '@/utils/logger';
import jwt from 'jsonwebtoken';

export interface SyncServiceConfig {
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
  isRunning: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  currentBatchId: string | null;
  totalReposProcessed: number;
  successfulSyncs: number;
  failedSyncs: number;
  lastError: string | null;
}

export interface SyncResult {
  success: boolean;
  duration: number;
  recordsProcessed?: number;
  error?: string;
}

export class SyncServiceClient {
  private axiosInstance: AxiosInstance;
  private baseUrl: string;
  private apiKey: string;
  private jwtSecret: string;

  constructor() {
    this.baseUrl = process.env.SYNC_SERVICE_URL || 'http://localhost:8081';
    this.apiKey = process.env.SYNC_SERVICE_API_KEY || '';
    this.jwtSecret = process.env.JWT_SECRET || '';

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
    });

    // Add request interceptor for authentication
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // Add JWT token
        const token = this.generateServiceToken();
        config.headers.Authorization = `Bearer ${token}`;
        
        logger.debug('Sync service request:', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL
        });
        
        return config;
      },
      (error) => {
        logger.error('Sync service request error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        logger.error('Sync service response error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  private generateServiceToken(): string {
    return jwt.sign(
      {
        iss: 'backend',
        aud: 'sync-service',
        sub: 'service-auth',
        permissions: [
          'sync:config:read',
          'sync:config:write',
          'sync:status:read',
          'sync:scheduler:control',
          'sync:monitor:read'
        ],
      },
      this.jwtSecret,
      { expiresIn: '1h' }
    );
  }

  // Configuration methods
  async getConfig(): Promise<SyncServiceConfig> {
    try {
      const response = await this.axiosInstance.get('/api/config');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get sync service config:', error);
      throw new Error('Failed to get sync service configuration');
    }
  }

  async updateConfig(config: Partial<SyncServiceConfig>): Promise<SyncServiceConfig> {
    try {
      const response = await this.axiosInstance.put('/api/config', config);
      return response.data.data;
    } catch (error) {
      logger.error('Failed to update sync service config:', error);
      throw new Error('Failed to update sync service configuration');
    }
  }

  // Status methods
  async getSchedulerStatus(): Promise<SchedulerStatus> {
    try {
      const response = await this.axiosInstance.get('/api/status/scheduler');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get scheduler status:', error);
      throw new Error('Failed to get scheduler status');
    }
  }

  async getSyncStatus(repositoryId: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get(`/api/status/sync/${repositoryId}`);
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get sync status:', error);
      throw new Error('Failed to get sync status');
    }
  }

  async getSyncHistory(repositoryId: string, params: { page: number; pageSize: number }): Promise<any> {
    try {
      const response = await this.axiosInstance.get(`/api/status/sync/${repositoryId}/history`, {
        params
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get sync history:', error);
      throw new Error('Failed to get sync history');
    }
  }

  async getSystemStatus(): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/api/status/system');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get system status:', error);
      throw new Error('Failed to get system status');
    }
  }

  // Control methods
  async startScheduler(): Promise<void> {
    try {
      await this.axiosInstance.post('/api/control/scheduler/start');
      logger.info('Scheduler started successfully');
    } catch (error) {
      logger.error('Failed to start scheduler:', error);
      throw new Error('Failed to start scheduler');
    }
  }

  async stopScheduler(): Promise<void> {
    try {
      await this.axiosInstance.post('/api/control/scheduler/stop');
      logger.info('Scheduler stopped successfully');
    } catch (error) {
      logger.error('Failed to stop scheduler:', error);
      throw new Error('Failed to stop scheduler');
    }
  }

  async runSchedulerNow(): Promise<void> {
    try {
      await this.axiosInstance.post('/api/control/scheduler/run-now');
      logger.info('Scheduler execution started immediately');
    } catch (error) {
      logger.error('Failed to run scheduler now:', error);
      throw new Error('Failed to run scheduler immediately');
    }
  }

  async startManualSync(repositoryId: string, syncType: 'full' | 'incremental' = 'incremental'): Promise<SyncResult> {
    try {
      const response = await this.axiosInstance.post(`/api/control/sync/${repositoryId}`, {
        syncType
      });
      return response.data.data.result;
    } catch (error) {
      logger.error('Failed to start manual sync:', error);
      throw new Error('Failed to start manual sync');
    }
  }

  async cancelSync(repositoryId: string): Promise<void> {
    try {
      await this.axiosInstance.delete(`/api/control/sync/${repositoryId}`);
      logger.info('Sync cancelled successfully');
    } catch (error) {
      logger.error('Failed to cancel sync:', error);
      throw new Error('Failed to cancel sync');
    }
  }

  // Monitoring methods
  async getMetrics(): Promise<string> {
    try {
      const response = await this.axiosInstance.get('/api/monitoring/metrics');
      return response.data;
    } catch (error) {
      logger.error('Failed to get metrics:', error);
      throw new Error('Failed to get metrics');
    }
  }

  async getLogs(params: { limit?: number; level?: string } = {}): Promise<any[]> {
    try {
      const response = await this.axiosInstance.get('/api/monitoring/logs', { params });
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get logs:', error);
      throw new Error('Failed to get logs');
    }
  }

  async getSyncMetrics(params: { days?: number } = {}): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/api/monitoring/sync-metrics', { params });
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get sync metrics:', error);
      throw new Error('Failed to get sync metrics');
    }
  }

  async getRepositoryStats(params: { repositoryId?: string; days?: number } = {}): Promise<any[]> {
    try {
      const response = await this.axiosInstance.get('/api/monitoring/repository-stats', { params });
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get repository stats:', error);
      throw new Error('Failed to get repository stats');
    }
  }

  async getHealthStatus(): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/api/monitoring/health');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get health status:', error);
      throw new Error('Failed to get health status');
    }
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.axiosInstance.get('/healthz');
      return response.status === 200 && response.data.status === 'healthy';
    } catch (error) {
      logger.error('Sync service health check failed:', error);
      return false;
    }
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      await this.axiosInstance.get('/readyz');
      return true;
    } catch (error) {
      logger.error('Sync service connection test failed:', error);
      return false;
    }
  }
}
