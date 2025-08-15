import { register, collectDefaultMetrics, Counter, Histogram, Gauge, Summary } from 'prom-client';
import { Request, Response, NextFunction } from 'express';

// Enable default metrics
collectDefaultMetrics({ register });

// HTTP Metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestInProgress = new Gauge({
  name: 'http_requests_in_progress',
  help: 'Number of HTTP requests currently in progress',
  labelNames: ['method', 'route'],
});

// Business Metrics
export const pullRequestsTotal = new Counter({
  name: 'pull_requests_total',
  help: 'Total number of pull requests processed',
  labelNames: ['repository', 'status', 'team'],
});

export const syncJobsTotal = new Counter({
  name: 'sync_jobs_total',
  help: 'Total number of sync jobs',
  labelNames: ['repository', 'status'],
});

export const syncJobDuration = new Histogram({
  name: 'sync_job_duration_seconds',
  help: 'Duration of sync jobs in seconds',
  labelNames: ['repository'],
  buckets: [30, 60, 120, 300, 600, 1200],
});

export const activeUsers = new Gauge({
  name: 'active_users',
  help: 'Number of active users',
});

export const developersTotal = new Gauge({
  name: 'developers_total',
  help: 'Total number of developers',
  labelNames: ['team'],
});

export const repositoriesTotal = new Gauge({
  name: 'repositories_total',
  help: 'Total number of repositories',
  labelNames: ['organization'],
});

// Database Metrics
export const databaseQueryDuration = new Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const databaseConnections = new Gauge({
  name: 'database_connections',
  help: 'Number of active database connections',
});

// Cache Metrics
export const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type'],
});

export const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type'],
});

export const cacheSize = new Gauge({
  name: 'cache_size_bytes',
  help: 'Size of cache in bytes',
  labelNames: ['cache_type'],
});

// Azure DevOps API Metrics
export const azureApiCalls = new Counter({
  name: 'azure_api_calls_total',
  help: 'Total number of Azure DevOps API calls',
  labelNames: ['endpoint', 'status'],
});

export const azureApiDuration = new Histogram({
  name: 'azure_api_duration_seconds',
  help: 'Duration of Azure DevOps API calls in seconds',
  labelNames: ['endpoint'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

export const azureApiRateLimit = new Gauge({
  name: 'azure_api_rate_limit_remaining',
  help: 'Remaining Azure DevOps API rate limit',
  labelNames: ['endpoint'],
});

// Error Metrics
export const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'service'],
});

// Custom Metrics
export const cycleTimeSummary = new Summary({
  name: 'cycle_time_days',
  help: 'Cycle time of pull requests in days',
  labelNames: ['team', 'repository'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
});

export const reviewTimeSummary = new Summary({
  name: 'review_time_days',
  help: 'Time to first review in days',
  labelNames: ['team', 'repository'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
});

// Middleware for HTTP metrics
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const method = req.method;
  const route = req.route?.path || req.path;

  // Increment in-progress requests
  httpRequestInProgress.inc({ method, route });

  // Override res.end to capture metrics
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = (Date.now() - start) / 1000;
    const statusCode = res.statusCode;

    // Record metrics
    httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
    httpRequestTotal.inc({ method, route, status_code: statusCode });
    httpRequestInProgress.dec({ method, route });

    // Call original end
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Helper functions for business metrics
export const recordPullRequest = (repository: string, status: string, team?: string) => {
  pullRequestsTotal.inc({ repository, status, team: team || 'unknown' });
};

export const recordSyncJob = (repository: string, status: string, duration?: number) => {
  syncJobsTotal.inc({ repository, status });
  if (duration) {
    syncJobDuration.observe({ repository }, duration);
  }
};

export const recordAzureApiCall = (endpoint: string, status: string, duration?: number) => {
  azureApiCalls.inc({ endpoint, status });
  if (duration) {
    azureApiDuration.observe({ endpoint }, duration);
  }
};

export const recordError = (type: string, service: string) => {
  errorsTotal.inc({ type, service });
};

export const recordCycleTime = (team: string, repository: string, days: number) => {
  cycleTimeSummary.observe({ team, repository }, days);
};

export const recordReviewTime = (team: string, repository: string, days: number) => {
  reviewTimeSummary.observe({ team, repository }, days);
};

export const updateActiveUsers = (count: number) => {
  activeUsers.set(count);
};

export const updateDevelopersCount = (team: string, count: number) => {
  developersTotal.set({ team }, count);
};

export const updateRepositoriesCount = (organization: string, count: number) => {
  repositoriesTotal.set({ organization }, count);
};

export const updateDatabaseConnections = (count: number) => {
  databaseConnections.set(count);
};

export const recordCacheHit = (cacheType: string) => {
  cacheHits.inc({ cache_type: cacheType });
};

export const recordCacheMiss = (cacheType: string) => {
  cacheMisses.inc({ cache_type: cacheType });
};

export const updateCacheSize = (cacheType: string, size: number) => {
  cacheSize.set({ cache_type: cacheType }, size);
};

export const updateAzureRateLimit = (endpoint: string, remaining: number) => {
  azureApiRateLimit.set({ endpoint }, remaining);
};

// Get metrics as string
export const getMetrics = async (): Promise<string> => {
  return await register.metrics();
};

// Get metrics as JSON
export const getMetricsJson = async (): Promise<any> => {
  return await register.getMetricsAsJSON();
};

// Reset metrics (useful for testing)
export const resetMetrics = (): void => {
  register.clear();
};
