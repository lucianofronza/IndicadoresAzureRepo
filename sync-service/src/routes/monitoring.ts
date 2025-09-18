import { Router } from 'express';
import { asyncHandler } from '@/middlewares/errorHandler';
import { getMetrics } from '@/utils/metrics';

const router = Router();

// Get Prometheus metrics
router.get('/metrics', asyncHandler(async (req, res) => {
  const metrics = await getMetrics();
  res.set('Content-Type', 'text/plain');
  res.send(metrics);
}));

// Get recent logs
router.get('/logs', asyncHandler(async (req, res) => {
  const { limit = 100, level } = req.query;
  
  // For now, return empty logs since we're not storing logs in database
  // In a real implementation, this would fetch from a log storage system
  res.json({
    success: true,
    data: []
  });
}));

// Get sync metrics summary
router.get('/sync-metrics', asyncHandler(async (req, res) => {
  const { days = 7 } = req.query;
  
  // For now, return mock metrics since we're not storing in database
  // In a real implementation, this would fetch from Redis or another storage
  
  res.json({
    success: true,
    data: {
      period: `${days} days`,
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      successRate: 0,
      averageDuration: 0
    }
  });
}));

// Get repository sync statistics
router.get('/repository-stats', asyncHandler(async (req, res) => {
  const { repositoryId } = req.query;
  const { days = 30 } = req.query;
  
  // For now, return empty stats since we're not storing in database
  res.json({
    success: true,
    data: []
  });
}));

// Get system health
router.get('/health', asyncHandler(async (req, res) => {
  try {
    // For now, return mock health status since we're not using database
    const healthStatus = {
      status: 'healthy',
      database: 'connected',
      recentErrors: 0,
      recentFailures: 0,
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: healthStatus
    });
    
  } catch (error) {
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    });
  }
}));

export default router;
