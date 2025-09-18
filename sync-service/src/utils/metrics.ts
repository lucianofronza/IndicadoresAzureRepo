import prometheus from 'prom-client';

// Enable default metrics collection
prometheus.collectDefaultMetrics({
  prefix: 'sync_service_',
  timeout: 5000,
});

// Custom metrics
export const syncMetrics = {
  // Scheduler metrics
  schedulerRunning: new prometheus.Gauge({
    name: 'sync_scheduler_running',
    help: 'Whether the scheduler is currently running',
    labelNames: ['status'],
  }),

  schedulerExecutions: new prometheus.Counter({
    name: 'sync_scheduler_executions_total',
    help: 'Total number of scheduler executions',
    labelNames: ['status'],
  }),

  // Sync job metrics
  syncJobsTotal: new prometheus.Counter({
    name: 'sync_jobs_total',
    help: 'Total number of sync jobs',
    labelNames: ['repository_id', 'sync_type', 'status'],
  }),

  syncJobDuration: new prometheus.Histogram({
    name: 'sync_job_duration_seconds',
    help: 'Duration of sync jobs in seconds',
    labelNames: ['repository_id', 'sync_type'],
    buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1800],
  }),

  // Queue metrics
  queueSize: new prometheus.Gauge({
    name: 'sync_queue_size',
    help: 'Current size of the sync queue',
  }),

  queueProcessingTime: new prometheus.Histogram({
    name: 'sync_queue_processing_time_seconds',
    help: 'Time spent processing items from the queue',
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  }),

  // Rate limiting metrics
  rateLimitHits: new prometheus.Counter({
    name: 'sync_rate_limit_hits_total',
    help: 'Total number of rate limit hits',
    labelNames: ['type', 'repository_id'],
  }),

  rateLimitDelays: new prometheus.Histogram({
    name: 'sync_rate_limit_delay_seconds',
    help: 'Time spent waiting due to rate limiting',
    buckets: [1, 5, 10, 30, 60, 120, 300],
  }),

  // Azure DevOps API metrics
  azureApiRequests: new prometheus.Counter({
    name: 'sync_azure_api_requests_total',
    help: 'Total number of Azure DevOps API requests',
    labelNames: ['endpoint', 'status'],
  }),

  azureApiDuration: new prometheus.Histogram({
    name: 'sync_azure_api_duration_seconds',
    help: 'Duration of Azure DevOps API requests',
    labelNames: ['endpoint'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  }),

  // Notification metrics
  notificationsSent: new prometheus.Counter({
    name: 'sync_notifications_sent_total',
    help: 'Total number of notifications sent',
    labelNames: ['type', 'status'],
  }),

  // Error metrics
  errorsTotal: new prometheus.Counter({
    name: 'sync_errors_total',
    help: 'Total number of errors',
    labelNames: ['type', 'component'],
  }),

  // Health metrics
  healthChecks: new prometheus.Gauge({
    name: 'sync_health_checks',
    help: 'Health check status (1 = healthy, 0 = unhealthy)',
    labelNames: ['component'],
  }),
};

// Helper functions
export const recordSyncJob = (repositoryId: string, syncType: string, status: string, duration?: number) => {
  syncMetrics.syncJobsTotal.inc({ repository_id: repositoryId, sync_type: syncType, status });
  
  if (duration !== undefined) {
    syncMetrics.syncJobDuration.observe({ repository_id: repositoryId, sync_type: syncType }, duration / 1000);
  }
};

export const recordRateLimit = (type: string, repositoryId: string, delay?: number) => {
  syncMetrics.rateLimitHits.inc({ type, repository_id: repositoryId });
  
  if (delay !== undefined) {
    syncMetrics.rateLimitDelays.observe({}, delay / 1000);
  }
};

export const recordAzureApiRequest = (endpoint: string, status: string, duration?: number) => {
  syncMetrics.azureApiRequests.inc({ endpoint, status });
  
  if (duration !== undefined) {
    syncMetrics.azureApiDuration.observe({ endpoint }, duration / 1000);
  }
};

export const recordNotification = (type: string, status: string) => {
  syncMetrics.notificationsSent.inc({ type, status });
};

export const recordError = (type: string, component: string) => {
  syncMetrics.errorsTotal.inc({ type, component });
};

export const updateHealthCheck = (component: string, isHealthy: boolean) => {
  syncMetrics.healthChecks.set({ component }, isHealthy ? 1 : 0);
};

export const updateQueueSize = (size: number) => {
  syncMetrics.queueSize.set(size);
};

export const updateSchedulerStatus = (isRunning: boolean) => {
  syncMetrics.schedulerRunning.set({ status: isRunning ? 'active' : 'inactive' }, isRunning ? 1 : 0);
};

// Get all metrics as string
export const getMetrics = async (): Promise<string> => {
  return prometheus.register.metrics();
};

// Get metrics registry
export const getRegistry = (): prometheus.Registry => {
  return prometheus.register;
};

// Metrics middleware for Express
export const metricsMiddleware = (req: any, res: any, next: any) => {
  // This middleware can be used to collect HTTP metrics if needed
  next();
};
