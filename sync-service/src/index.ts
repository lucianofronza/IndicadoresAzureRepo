import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { logger } from '@/utils/logger';
import { metricsMiddleware, getMetrics } from '@/utils/metrics';
import { connectRedis, disconnectRedis, healthCheck as redisHealthCheck, getRedis } from '@/config/redis';
import { configService } from '@/services/ConfigService';
import { RedisStorageService } from '@/services/RedisStorageService';

// Import services
import { SchedulerService } from '@/services/schedulerService';
import { NotificationService } from '@/services/notificationService';

// Import routes
import configRoutes from '@/routes/config';
import statusRoutes from '@/routes/status';
import controlRoutes from '@/routes/control';
import monitoringRoutes from '@/routes/monitoring';

// Import middlewares
import { serviceAuthMiddleware } from '@/middlewares/auth';
import { errorHandler, notFoundHandler } from '@/middlewares/errorHandler';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Services
let schedulerService: SchedulerService;
let notificationService: NotificationService;
let redisStorage: RedisStorageService;

// Graceful shutdown handling
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  try {
    // Stop scheduler
    if (schedulerService) {
      await schedulerService.stop();
    }
    
    // Save configuration
    if (configService) {
      await configService.saveConfig();
    }
    
    // Disconnect from Redis
    await disconnectRedis();
    
    // Close server
    server.close(() => {
      logger.info('Graceful shutdown completed');
      process.exit(0);
    });
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
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));

// Metrics middleware
app.use(metricsMiddleware);

// Health check endpoint (no authentication required)
app.get('/healthz', async (req, res) => {
  try {
    const redisHealthy = await redisHealthCheck();
    const redisStatus = redisStorage ? await redisStorage.getHealthStatus() : { status: 'unhealthy', keys: 0 };
    
    const status = redisHealthy && redisStatus.status === 'healthy' ? 'healthy' : 'unhealthy';
    const statusCode = status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      service: 'sync-service',
      services: {
        redis: {
          status: redisHealthy ? 'healthy' : 'unhealthy',
          keys: redisStatus.keys,
        },
        config: {
          status: 'healthy', // File-based config is always available
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
    const redisHealthy = await redisHealthCheck();
    
    if (redisHealthy) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        service: 'sync-service',
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        services: {
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

// API routes with authentication
app.use('/api/config', serviceAuthMiddleware(['sync:config:read', 'sync:config:write']), configRoutes);
app.use('/api/status', serviceAuthMiddleware(['sync:status:read']), statusRoutes);
app.use('/api/control', serviceAuthMiddleware(['sync:scheduler:control']), controlRoutes);
app.use('/api/monitoring', serviceAuthMiddleware(['sync:monitor:read']), monitoringRoutes);

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info('WebSocket client connected', { socketId: socket.id });
  
  socket.on('disconnect', () => {
    logger.info('WebSocket client disconnected', { socketId: socket.id });
  });
  
  // Join monitoring room
  socket.on('join:monitoring', () => {
    socket.join('monitoring');
    logger.info('Client joined monitoring room', { socketId: socket.id });
  });
  
  // Leave monitoring room
  socket.on('leave:monitoring', () => {
    socket.leave('monitoring');
    logger.info('Client left monitoring room', { socketId: socket.id });
  });
});

// Export io for use in services
export { io };

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Load configuration
    await configService.loadConfig();
    logger.info('Configuration loaded successfully');

    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected successfully');

    // Get Redis client and initialize storage service
    const redis = getRedis();
    redisStorage = new RedisStorageService(redis);

    // Initialize services
    notificationService = new NotificationService();
    schedulerService = new SchedulerService(notificationService, io, redisStorage, configService);

    // Make services available to routes
    app.set('redisStorage', redisStorage);
    app.set('notificationService', notificationService);
    app.set('schedulerService', schedulerService);
    app.set('io', io);

    // Auto-start scheduler if enabled in configuration
    const config = configService.getConfig();
    if (config.scheduler.enabled) {
      logger.info('Scheduler is enabled in configuration, starting automatically...');
      schedulerService.start().catch(error => {
        logger.error('Failed to auto-start scheduler:', error);
      });
    } else {
      logger.info('Scheduler is disabled in configuration, not starting automatically');
    }

    // Start HTTP server
    server.listen(PORT, () => {
      logger.info(`Sync Service started on port ${PORT} in ${NODE_ENV} mode`);
      logger.info(`Health check: http://localhost:${PORT}/healthz`);
      logger.info(`Metrics: http://localhost:${PORT}/metrics`);
      logger.info(`WebSocket: ws://localhost:${PORT}`);
      logger.info('Using Redis + File System storage architecture');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
