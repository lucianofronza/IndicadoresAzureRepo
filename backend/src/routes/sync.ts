import { Router } from 'express';
import { validate, syncRepositorySchema } from '@/middlewares/validation';
import { asyncHandler } from '@/middlewares/errorHandler';
import { syncRateLimiter } from '@/middlewares/security';
import { requireAuth } from '@/middlewares/auth';
import { requirePermission } from '@/middlewares/permissions';
import { SyncService } from '@/services/syncService';
import { SyncServiceClient } from '@/services/syncServiceClient';
import { prisma } from '@/config/database';

const router = Router();
const syncService = new SyncService();
const syncServiceClient = new SyncServiceClient();

// Scheduler routes (proxy to sync-service) - MUST come before /:repositoryId routes

// Get scheduler status
router.get('/scheduler/status',
  requireAuth,
  requirePermission('sync:status:read'),
  asyncHandler(async (req, res) => {
    try {
      const status = await syncServiceClient.getSchedulerStatus();
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get scheduler status'
      });
    }
  })
);

// Start scheduler
router.post('/scheduler/start',
  requireAuth,
  requirePermission('sync:scheduler:control'),
  asyncHandler(async (req, res) => {
    try {
      await syncServiceClient.startScheduler();
      res.json({
        success: true,
        message: 'Scheduler started successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to start scheduler'
      });
    }
  })
);

// Stop scheduler
router.post('/scheduler/stop',
  requireAuth,
  requirePermission('sync:scheduler:control'),
  asyncHandler(async (req, res) => {
    try {
      await syncServiceClient.stopScheduler();
      res.json({
        success: true,
        message: 'Scheduler stopped successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to stop scheduler'
      });
    }
  })
);

// Run scheduler immediately
router.post('/scheduler/run-now',
  requireAuth,
  requirePermission('sync:scheduler:control'),
  asyncHandler(async (req, res) => {
    try {
      await syncServiceClient.runSchedulerNow();
      res.json({
        success: true,
        message: 'Scheduler execution started immediately'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to run scheduler now'
      });
    }
  })
);

// Scheduler configuration routes (proxy to sync-service)

// Get scheduler configuration
router.get('/scheduler/config',
  requireAuth,
  requirePermission('sync:config:read'),
  asyncHandler(async (req, res) => {
    try {
      const config = await syncServiceClient.getConfig();
      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get scheduler configuration'
      });
    }
  })
);

// Update scheduler configuration
router.put('/scheduler/config',
  requireAuth,
  requirePermission('sync:config:write'),
  asyncHandler(async (req, res) => {
    try {
      const config = await syncServiceClient.updateConfig(req.body);
      res.json({
        success: true,
        message: 'Scheduler configuration updated successfully',
        data: config
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update scheduler configuration'
      });
    }
  })
);

// Start sync for repository
router.post('/:repositoryId', 
  requireAuth,
  syncRateLimiter,
  requirePermission('sync:manual:execute'),
  asyncHandler(async (req, res) => {
    const { repositoryId } = req.params;
    const { syncType = 'incremental' } = req.body; // Default to incremental
    
    // Validate sync type
    if (syncType && !['full', 'incremental'].includes(syncType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sync type. Must be "full" or "incremental"',
      });
    }
    
    const job = await syncService.startSync(repositoryId, syncType);
    
    res.status(201).json({
      success: true,
      message: 'Sync job started successfully',
      data: job,
    });
  })
);

// Test endpoint to check repository sync status
router.get('/:repositoryId/status', 
  requireAuth,
  requirePermission('sync:status:read'),
  asyncHandler(async (req, res) => {
    const { repositoryId } = req.params;
    
    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
      include: {
        syncJobs: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });
    
    if (!repository) {
      return res.status(404).json({
        success: false,
        message: 'Repository not found',
      });
    }

    // Get sync status from sync service
    const syncStatus = await syncService.getSyncStatus(repositoryId);
    
    res.json({
      success: true,
      data: {
        id: repository.id,
        name: repository.name,
        lastSyncAt: repository.lastSyncAt,
        hasLastSync: !!repository.lastSyncAt,
        recentSyncJobs: repository.syncJobs,
        // Add status information for the frontend (prioritize sync-service status)
        status: syncStatus.syncService?.status || syncStatus.status || 'no_jobs',
        jobId: syncStatus.syncService?.jobId || syncStatus.jobId,
        startedAt: syncStatus.syncService?.startedAt || syncStatus.startedAt,
        completedAt: syncStatus.syncService?.completedAt || syncStatus.completedAt,
        error: syncStatus.syncService?.error || syncStatus.error,
        syncType: syncStatus.syncType,
        // Sync service status
        syncService: syncStatus.syncService
      }
    });
  })
);

// Test endpoint to reset repository sync status (for testing)
router.post('/:repositoryId/reset', 
  requireAuth,
  requirePermission('sync:manual:execute'),
  asyncHandler(async (req, res) => {
    const { repositoryId } = req.params;
    
    const repository = await prisma.repository.update({
      where: { id: repositoryId },
      data: {
        lastSyncAt: null
      }
    });
    
    res.json({
      success: true,
      message: 'Repository sync status reset successfully',
      data: {
        id: repository.id,
        name: repository.name,
        lastSyncAt: repository.lastSyncAt
      }
    });
  })
);

// Get sync history
router.get('/:repositoryId/history', 
  requireAuth,
  validate(syncRepositorySchema),
  requirePermission('sync:history:read'),
  asyncHandler(async (req, res) => {
    const { repositoryId } = req.params;
    const { page = 1, pageSize = 10 } = req.query;
    
    const history = await syncService.getSyncHistory(repositoryId, {
      page: page as number,
      pageSize: pageSize as number,
    });
    
    res.json({
      success: true,
      data: history.data,
      pagination: history.pagination,
    });
  })
);

// Cancel sync job
router.delete('/:repositoryId', 
  requireAuth,
  syncRateLimiter,
  validate(syncRepositorySchema),
  requirePermission('sync:manual:execute'),
  asyncHandler(async (req, res) => {
    const { repositoryId } = req.params;
    await syncService.cancelSync(repositoryId);
    
    res.json({
      success: true,
      message: 'Sync job cancelled successfully',
    });
  })
);

// Get all sync jobs
router.get('/', 
  requireAuth,
  requirePermission('sync:history:read'),
  asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 10, status } = req.query;
    
    const jobs = await syncService.getAllJobs({
      page: page as number,
      pageSize: pageSize as number,
      status: status as string,
    });
    
    res.json({
      success: true,
      data: jobs.data,
      pagination: jobs.pagination,
    });
  })
);

// Get sync job by ID
router.get('/jobs/:jobId', 
  requireAuth,
  requirePermission('sync:history:read'),
  asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    
    const job = await prisma.syncJob.findUnique({
      where: { id: jobId },
      include: {
        repository: {
          select: {
            id: true,
            name: true,
            organization: true,
            project: true
          }
        }
      }
    });
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Sync job not found',
      });
    }
    
    res.json({
      success: true,
      data: job
    });
  })
);


export default router;
