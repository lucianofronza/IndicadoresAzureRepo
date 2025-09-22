import { Router } from 'express';
import { asyncHandler } from '@/middlewares/errorHandler';
import { requirePermission } from '@/middlewares/permissions';
import { SyncService } from '@/services/syncService';

const router = Router();
const syncService = new SyncService();

// Get scheduler status
router.get('/status', 
  requirePermission('sync:status:read'),
  asyncHandler(async (req, res) => {
    const status = await syncService.getSchedulerStatus();
    
    res.json({
      success: true,
      data: status
    });
  })
);

// Start scheduler
router.post('/start', 
  requirePermission('sync:scheduler:control'),
  asyncHandler(async (req, res) => {
    await syncService.startScheduler();
    
    res.json({
      success: true,
      message: 'Scheduler started successfully'
    });
  })
);

// Stop scheduler
router.post('/stop', 
  requirePermission('sync:scheduler:control'),
  asyncHandler(async (req, res) => {
    await syncService.stopScheduler();
    
    res.json({
      success: true,
      message: 'Scheduler stopped successfully'
    });
  })
);

// Run scheduler immediately
router.post('/run-now', 
  requirePermission('sync:scheduler:control'),
  asyncHandler(async (req, res) => {
    await syncService.runSchedulerNow();
    
    res.json({
      success: true,
      message: 'Scheduler execution started immediately'
    });
  })
);

// Get sync configuration
router.get('/config', 
  requirePermission('sync:config:read'),
  asyncHandler(async (req, res) => {
    const config = await syncService.getSyncConfig();
    
    res.json({
      success: true,
      data: config
    });
  })
);

// Update sync configuration
router.put('/config', 
  requirePermission('sync:config:write'),
  asyncHandler(async (req, res) => {
    const config = await syncService.updateSyncConfig(req.body);
    
    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: config
    });
  })
);

// Get sync metrics
router.get('/metrics', 
  requirePermission('sync:monitor:read'),
  asyncHandler(async (req, res) => {
    const { days = 7 } = req.query;
    const metrics = await syncService.getSyncMetrics({ days: parseInt(days as string) });
    
    res.json({
      success: true,
      data: metrics
    });
  })
);

// Get repository statistics
router.get('/repository-stats', 
  requirePermission('sync:monitor:read'),
  asyncHandler(async (req, res) => {
    const { repositoryId, days = 30 } = req.query;
    const stats = await syncService.getRepositoryStats({
      repositoryId: repositoryId as string,
      days: parseInt(days as string)
    });
    
    res.json({
      success: true,
      data: stats
    });
  })
);

// Get system status
router.get('/system-status', 
  requirePermission('sync:monitor:read'),
  asyncHandler(async (req, res) => {
    const status = await syncService.getSystemStatus();
    
    res.json({
      success: true,
      data: status
    });
  })
);

// Health check for sync service
router.get('/health', 
  requirePermission('sync:monitor:read'),
  asyncHandler(async (req, res) => {
    const isHealthy = await syncService.isSyncServiceHealthy();
    
    res.json({
      success: true,
      data: {
        isHealthy,
        timestamp: new Date().toISOString()
      }
    });
  })
);

export default router;
