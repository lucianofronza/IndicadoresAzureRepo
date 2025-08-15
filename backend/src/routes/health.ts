import { Router } from 'express';
import { healthCheck as dbHealthCheck } from '@/config/database';
import { healthCheck as redisHealthCheck } from '@/config/redis';
import { logger } from '@/utils/logger';
import { asyncHandler } from '@/middlewares/errorHandler';

const router = Router();

// Health check endpoint
router.get('/', asyncHandler(async (req, res) => {
  const start = Date.now();
  
  try {
    const dbHealthy = await dbHealthCheck();
    const redisHealthy = await redisHealthCheck();
    
    const dbResponseTime = Date.now() - start;
    const status = dbHealthy && redisHealthy ? 'healthy' : 'unhealthy';
    const statusCode = status === 'healthy' ? 200 : 503;
    
    const response = {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: {
          status: dbHealthy ? 'healthy' : 'unhealthy',
          responseTime: dbResponseTime,
        },
        redis: {
          status: redisHealthy ? 'healthy' : 'unhealthy',
          responseTime: dbResponseTime,
        },
      },
    };

    logger.info({
      healthCheck: response,
      requestId: req.requestId,
    }, 'Health check completed');

    res.status(statusCode).json(response);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      requestId: req.requestId,
    });
  }
}));

// Detailed health check
router.get('/detailed', asyncHandler(async (req, res) => {
  const start = Date.now();
  const checks = {
    database: { status: 'unknown', responseTime: 0, error: null },
    redis: { status: 'unknown', responseTime: 0, error: null },
  };

  // Check database
  const dbStart = Date.now();
  try {
    await dbHealthCheck();
    checks.database.status = 'healthy';
    checks.database.responseTime = Date.now() - dbStart;
  } catch (error) {
    checks.database.status = 'unhealthy';
    checks.database.responseTime = Date.now() - dbStart;
    checks.database.error = error instanceof Error ? error.message : 'Unknown error';
  }

  // Check Redis
  const redisStart = Date.now();
  try {
    await redisHealthCheck();
    checks.redis.status = 'healthy';
    checks.redis.responseTime = Date.now() - redisStart;
  } catch (error) {
    checks.redis.status = 'unhealthy';
    checks.redis.responseTime = Date.now() - redisStart;
    checks.redis.error = error instanceof Error ? error.message : 'Unknown error';
  }

  const overallStatus = checks.database.status === 'healthy' && checks.redis.status === 'healthy' 
    ? 'healthy' 
    : 'unhealthy';

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    totalResponseTime: Date.now() - start,
    services: checks,
    environment: {
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
      databaseUrl: process.env.DATABASE_URL ? 'configured' : 'not configured',
      redisUrl: process.env.REDIS_URL ? 'configured' : 'not configured',
    },
  };

  logger.info({
    detailedHealthCheck: response,
    requestId: req.requestId,
  }, 'Detailed health check completed');

  res.status(overallStatus === 'healthy' ? 200 : 503).json(response);
}));

// Liveness probe (simple check)
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Readiness probe
router.get('/ready', asyncHandler(async (req, res) => {
  try {
    const dbHealthy = await dbHealthCheck();
    const redisHealthy = await redisHealthCheck();
    
    if (dbHealthy && redisHealthy) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        services: {
          database: dbHealthy ? 'ready' : 'not ready',
          redis: redisHealthy ? 'ready' : 'not ready',
        },
      });
    }
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed',
    });
  }
}));

export default router;
