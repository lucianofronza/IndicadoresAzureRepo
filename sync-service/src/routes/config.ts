import { Router } from 'express';
import { asyncHandler } from '@/middlewares/errorHandler';
import { SchedulerService } from '@/services/schedulerService';
import { NotificationService } from '@/services/notificationService';

const router = Router();

// Get global sync configuration
router.get('/', asyncHandler(async (req, res) => {
  const schedulerService = req.app.get('schedulerService');
  const config = await schedulerService.getConfig();
  
  res.json({
    success: true,
    data: config
  });
}));

// Update global sync configuration
router.put('/', asyncHandler(async (req, res) => {
  const schedulerService = req.app.get('schedulerService');
  const updatedConfig = await schedulerService.updateConfig(req.body);
  
  res.json({
    success: true,
    message: 'Configuration updated successfully',
    data: updatedConfig
  });
}));

// Get notification configuration
router.get('/notifications', asyncHandler(async (req, res) => {
  const notificationService = new NotificationService();
  const config = await notificationService.getConfig();
  
  res.json({
    success: true,
    data: config
  });
}));

// Update notification configuration
router.put('/notifications', asyncHandler(async (req, res) => {
  const notificationService = new NotificationService();
  const updatedConfig = await notificationService.updateConfig(req.body);
  
  res.json({
    success: true,
    message: 'Notification configuration updated successfully',
    data: updatedConfig
  });
}));

export default router;
