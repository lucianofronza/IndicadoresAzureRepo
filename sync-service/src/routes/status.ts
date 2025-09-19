import { Router } from 'express';
import { asyncHandler } from '@/middlewares/errorHandler';
import { SchedulerService } from '@/services/schedulerService';
import { SyncOrchestrator } from '@/services/syncOrchestrator';
import { RateLimiter } from '@/services/rateLimiter';
import { NotificationService } from '@/services/notificationService';

const router = Router();

// Get scheduler status
router.get('/scheduler', asyncHandler(async (req, res) => {
  const schedulerService = req.app.get('schedulerService');
  const status = await schedulerService.getStatus();
  
  res.json({
    success: true,
    data: status
  });
}));

// DEBUG: Get scheduler status without auth
router.get('/debug/scheduler', asyncHandler(async (req, res) => {
  const schedulerService = req.app.get('schedulerService');
  const status = await schedulerService.getStatus();
  const config = schedulerService.configService.getConfig();
  
  res.json({
    success: true,
    data: {
      status,
      config: {
        enabled: config.scheduler.enabled,
        intervalMinutes: config.sync.defaultIntervalMinutes,
        lastRun: config.scheduler.lastRun,
        nextRun: config.scheduler.nextRun
      }
    }
  });
}));

// Get scheduler execution logs
router.get('/scheduler/logs', asyncHandler(async (req, res) => {
  const schedulerService = req.app.get('schedulerService');
  const limit = parseInt(req.query.limit as string) || 10;
  const logs = await schedulerService.getExecutionLogs(limit);
  
  res.json({
    success: true,
    data: logs
  });
}));

// Get sync status for a specific repository
router.get('/sync/:repositoryId', asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const redisStorage = req.app.get('redisStorage');
  const notificationService = req.app.get('notificationService');
  const syncOrchestrator = new SyncOrchestrator(notificationService, req.app.get('io'), redisStorage);
  const status = await syncOrchestrator.getSyncStatus(repositoryId);
  
  res.json({
    success: true,
    data: status
  });
}));

// Get sync history for a specific repository
router.get('/sync/:repositoryId/history', asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const { page = 1, pageSize = 10 } = req.query;
  
  const redisStorage = req.app.get('redisStorage');
  const notificationService = req.app.get('notificationService');
  const syncOrchestrator = new SyncOrchestrator(notificationService, req.app.get('io'), redisStorage);
  const history = await syncOrchestrator.getSyncHistory(repositoryId, {
    page: parseInt(page as string),
    pageSize: parseInt(pageSize as string)
  });
  
  res.json({
    success: true,
    data: history.data,
    pagination: history.pagination
  });
}));

// Get rate limit status for a specific repository
router.get('/rate-limit/:repositoryId', asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const rateLimiter = new RateLimiter();
  const status = await rateLimiter.getRateLimitStatus(repositoryId);
  
  res.json({
    success: true,
    data: status
  });
}));

// Get overall system status
router.get('/system', asyncHandler(async (req, res) => {
  const schedulerService = req.app.get('schedulerService');
  const notificationService = req.app.get('notificationService');
  
  const [schedulerStatus, notificationConfig] = await Promise.all([
    schedulerService.getStatus(),
    notificationService.getConfig()
  ]);
  
  res.json({
    success: true,
    data: {
      scheduler: schedulerStatus,
      notifications: {
        enabled: notificationConfig.enabled,
        recipients: notificationConfig.emailRecipients.length
      },
      timestamp: new Date().toISOString()
    }
  });
}));

export default router;
