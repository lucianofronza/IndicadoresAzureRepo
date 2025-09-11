import { config } from 'dotenv';
import path from 'path';

// Load environment variables from .env.docker in the project root
config({ path: path.resolve(__dirname, '../../.env.docker') });
import express from 'express';
import compression from 'compression';
import { logger } from '@/utils/logger';
import { metricsMiddleware, getMetrics } from '@/utils/metrics';
import { connectDatabase, disconnectDatabase, healthCheck as dbHealthCheck } from '@/config/database';
import { connectRedis, disconnectRedis, healthCheck as redisHealthCheck } from '@/config/redis';
import { securityMiddlewares } from '@/middlewares/security';
import { errorHandler, notFoundHandler } from '@/middlewares/errorHandler';
import { apiRateLimiter } from '@/middlewares/security';
import { addUserPermissions } from '@/middlewares/permissions';

// Import routes
import healthRoutes from '@/routes/health';

import teamRoutes from '@/routes/teams';
import roleRoutes from '@/routes/roles';
import stackRoutes from '@/routes/stacks';
import developerRoutes from '@/routes/developers';
import repositoryRoutes from '@/routes/repositories';
import syncRoutes from '@/routes/sync';
import syncNewRoutes from '@/routes/syncNew';
import schedulerRoutes from '@/routes/scheduler';
import kpiRoutes from '@/routes/kpis';
import azureDevOpsRoutes from '@/routes/azureDevOps';
import authRoutes from '@/routes/auth';
import userTeamRoutes from '@/routes/userTeams';
import notificationRoutes from '@/routes/notifications';

const app = express();
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Graceful shutdown handling
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  try {
    await disconnectDatabase();
    await disconnectRedis();
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Middleware setup
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security middlewares
app.use(securityMiddlewares);

// Middleware para adicionar permissões do usuário
app.use(addUserPermissions);

// Metrics middleware
app.use(metricsMiddleware);

// Rate limiting
app.use('/api', apiRateLimiter);

// Health check endpoint (no rate limiting)
app.get('/healthz', async (req, res) => {
  try {
    const dbHealthy = await dbHealthCheck();
    const redisHealthy = await redisHealthCheck();
    
    const status = dbHealthy && redisHealthy ? 'healthy' : 'unhealthy';
    const statusCode = status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: {
          status: dbHealthy ? 'healthy' : 'unhealthy',
        },
        redis: {
          status: redisHealthy ? 'healthy' : 'unhealthy',
        },
      },
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

// Readiness check
app.get('/readyz', async (req, res) => {
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
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const metrics = await getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    logger.error('Metrics generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'METRICS_ERROR',
      message: 'Failed to generate metrics',
    });
  }
});

// API routes
app.use('/api/health', healthRoutes);

app.use('/api/teams', teamRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/stacks', stackRoutes);
app.use('/api/developers', developerRoutes);
app.use('/api/repositories', repositoryRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/sync-new', syncNewRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/azure-devops', azureDevOpsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user-teams', userTeamRoutes);
app.use('/api/notifications', notificationRoutes);

// API documentation
app.get('/api', (req, res) => {
  res.json({
    name: 'Indicadores Azure Repos API',
    version: '1.0.0',
    description: 'API para análise de indicadores de desenvolvedores do Azure Repos',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      teams: '/api/teams',
      roles: '/api/roles',
      stacks: '/api/stacks',
      developers: '/api/developers',
      repositories: '/api/repositories',
      sync: '/api/sync',
      'sync-new': '/api/sync-new',
      scheduler: '/api/scheduler',
      kpis: '/api/kpis',
    },
    documentation: '/api/docs',
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('Database connected successfully');

    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected successfully');

    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`Server started on port ${PORT} in ${NODE_ENV} mode`);
      logger.info(`Health check: http://localhost:${PORT}/healthz`);
      logger.info(`Metrics: http://localhost:${PORT}/metrics`);
      logger.info(`API docs: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
