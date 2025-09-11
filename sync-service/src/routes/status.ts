import { Router } from 'express';
import { asyncHandler } from '@/middlewares/errorHandler';
import { SchedulerService } from '@/services/schedulerService';
import { SyncOrchestrator } from '@/services/syncOrchestrator';
import { RateLimiter } from '@/services/rateLimiter';
import { NotificationService } from '@/services/notificationService';

const router = Router();

// Get scheduler status
router.get('/scheduler', asyncHandler(async (req, res) => {
  const schedulerService = new SchedulerService(new NotificationService(), req.app.get('io'));
  const status = await schedulerService.getStatus();
  
  res.json({
    success: true,
    data: status
  });
}));

// Get sync status for a specific repository
router.get('/sync/:repositoryId', asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const syncOrchestrator = new SyncOrchestrator(new NotificationService(), req.app.get('io'));
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
  
  const syncOrchestrator = new SyncOrchestrator(new NotificationService(), req.app.get('io'));
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
  const schedulerService = new SchedulerService(new NotificationService(), req.app.get('io'));
  const notificationService = new NotificationService();
  
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
