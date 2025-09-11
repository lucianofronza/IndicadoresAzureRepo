import { Router } from 'express';
import { asyncHandler } from '@/middlewares/errorHandler';
import { getMetrics } from '@/utils/metrics';
import { getPrisma } from '@/config/database';

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
  const prisma = getPrisma();
  
  const where = level ? { level: level as string } : {};
  
  const logs = await prisma.schedulerLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit as string)
  });
  
  res.json({
    success: true,
    data: logs
  });
}));

// Get sync metrics summary
router.get('/sync-metrics', asyncHandler(async (req, res) => {
  const { days = 7 } = req.query;
  const prisma = getPrisma();
  
  const since = new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000);
  
  const [totalSyncs, successfulSyncs, failedSyncs, avgDuration] = await Promise.all([
    prisma.syncMetrics.count({
      where: { createdAt: { gte: since } }
    }),
    prisma.syncMetrics.count({
      where: { 
        createdAt: { gte: since },
        status: 'success'
      }
    }),
    prisma.syncMetrics.count({
      where: { 
        createdAt: { gte: since },
        status: 'failed'
      }
    }),
    prisma.syncMetrics.aggregate({
      where: { 
        createdAt: { gte: since },
        status: 'success'
      },
      _avg: { duration: true }
    })
  ]);
  
  const successRate = totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0;
  
  res.json({
    success: true,
    data: {
      period: `${days} days`,
      totalSyncs,
      successfulSyncs,
      failedSyncs,
      successRate: Math.round(successRate * 100) / 100,
      averageDuration: Math.round(avgDuration._avg.duration || 0)
    }
  });
}));

// Get repository sync statistics
router.get('/repository-stats', asyncHandler(async (req, res) => {
  const { repositoryId } = req.query;
  const { days = 30 } = req.query;
  const prisma = getPrisma();
  
  const since = new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000);
  const where: any = { createdAt: { gte: since } };
  
  if (repositoryId) {
    where.repositoryId = repositoryId as string;
  }
  
  const stats = await prisma.syncMetrics.groupBy({
    by: ['repositoryId', 'status'],
    where,
    _count: { id: true },
    _avg: { duration: true }
  });
  
  // Group by repository
  const repositoryStats = stats.reduce((acc, stat) => {
    const repoId = stat.repositoryId;
    if (!acc[repoId]) {
      acc[repoId] = {
        repositoryId: repoId,
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        averageDuration: 0
      };
    }
    
    acc[repoId].totalSyncs += stat._count.id;
    if (stat.status === 'success') {
      acc[repoId].successfulSyncs += stat._count.id;
      acc[repoId].averageDuration = Math.round(stat._avg.duration || 0);
    } else {
      acc[repoId].failedSyncs += stat._count.id;
    }
    
    return acc;
  }, {} as any);
  
  // Calculate success rates
  Object.values(repositoryStats).forEach((stat: any) => {
    stat.successRate = stat.totalSyncs > 0 
      ? Math.round((stat.successfulSyncs / stat.totalSyncs) * 10000) / 100
      : 0;
  });
  
  res.json({
    success: true,
    data: Object.values(repositoryStats)
  });
}));

// Get system health
router.get('/health', asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    // Get recent error count
    const recentErrors = await prisma.schedulerLog.count({
      where: {
        level: 'error',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });
    
    // Get failed syncs in last hour
    const recentFailures = await prisma.syncMetrics.count({
      where: {
        status: 'failed',
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      }
    });
    
    const healthStatus = {
      status: 'healthy',
      database: 'connected',
      recentErrors,
      recentFailures,
      timestamp: new Date().toISOString()
    };
    
    // Mark as unhealthy if too many errors
    if (recentErrors > 10 || recentFailures > 5) {
      healthStatus.status = 'unhealthy';
    }
    
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
