import { Router } from 'express';
import { validate, syncRepositorySchema } from '@/middlewares/validation';
import { asyncHandler } from '@/middlewares/errorHandler';
import { syncRateLimiter } from '@/middlewares/security';
import { SyncService } from '@/services/syncService';
import { prisma } from '@/config/database';

const router = Router();
const syncService = new SyncService();

// Start sync for repository
router.post('/:repositoryId', 
  syncRateLimiter,
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

    // Get the latest sync job
    const latestJob = repository.syncJobs[0];
    
    res.json({
      success: true,
      data: {
        id: repository.id,
        name: repository.name,
        lastSyncAt: repository.lastSyncAt,
        hasLastSync: !!repository.lastSyncAt,
        recentSyncJobs: repository.syncJobs,
        // Add status information for the frontend
        status: latestJob?.status || 'no_jobs',
        jobId: latestJob?.id,
        startedAt: latestJob?.startedAt,
        completedAt: latestJob?.completedAt,
        error: latestJob?.error,
        syncType: latestJob?.syncType
      }
    });
  })
);

// Test endpoint to reset repository sync status (for testing)
router.post('/:repositoryId/reset', 
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
  validate(syncRepositorySchema),
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
  syncRateLimiter,
  validate(syncRepositorySchema),
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
