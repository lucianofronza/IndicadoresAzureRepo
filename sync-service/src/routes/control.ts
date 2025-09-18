import { Router } from 'express';
import { asyncHandler } from '@/middlewares/errorHandler';
import { SchedulerService } from '@/services/schedulerService';
import { SyncOrchestrator } from '@/services/syncOrchestrator';
import { NotificationService } from '@/services/notificationService';

const router = Router();

// Start scheduler
router.post('/scheduler/start', asyncHandler(async (req, res) => {
  const schedulerService = req.app.get('schedulerService');
  await schedulerService.start();
  
  res.json({
    success: true,
    message: 'Scheduler started successfully'
  });
}));

// Stop scheduler
router.post('/scheduler/stop', asyncHandler(async (req, res) => {
  const schedulerService = req.app.get('schedulerService');
  await schedulerService.stop();
  
  res.json({
    success: true,
    message: 'Scheduler stopped successfully'
  });
}));

// Run scheduler immediately
router.post('/scheduler/run-now', asyncHandler(async (req, res) => {
  const schedulerService = req.app.get('schedulerService');
  await schedulerService.runNow();
  
  res.json({
    success: true,
    message: 'Scheduler execution started immediately'
  });
}));

// Start manual sync for a specific repository
router.post('/sync/:repositoryId', asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const { syncType = 'incremental' } = req.body;
  
  if (!['full', 'incremental'].includes(syncType)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid sync type. Must be "full" or "incremental"'
    });
  }
  
  const redisStorage = req.app.get('redisStorage');
  const notificationService = req.app.get('notificationService');
  const syncOrchestrator = new SyncOrchestrator(notificationService, req.app.get('io'), redisStorage);
  const result = await syncOrchestrator.syncRepository(repositoryId, syncType);
  
  res.json({
    success: true,
    message: 'Manual sync started successfully',
    data: {
      repositoryId,
      syncType,
      result
    }
  });
}));

// Cancel sync for a specific repository
router.delete('/sync/:repositoryId', asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const redisStorage = req.app.get('redisStorage');
  const notificationService = req.app.get('notificationService');
  const syncOrchestrator = new SyncOrchestrator(notificationService, req.app.get('io'), redisStorage);
  await syncOrchestrator.cancelSync(repositoryId);
  
  res.json({
    success: true,
    message: 'Sync cancelled successfully'
  });
}));

// Test notification
router.post('/notifications/test', asyncHandler(async (req, res) => {
  const { type = 'failure' } = req.body;
  const notificationService = new NotificationService();
  
  if (type === 'failure') {
    await notificationService.sendFailureNotification({
      batchId: 'test-batch-' + Date.now(),
      failureCount: 1,
      totalProcessed: 5,
      recipients: []
    });
  } else if (type === 'success') {
    await notificationService.sendSuccessNotification(
      'test-batch-' + Date.now(),
      5
    );
  }
  
  res.json({
    success: true,
    message: `Test ${type} notification sent successfully`
  });
}));

export default router;
