import { Router } from 'express';
import { asyncHandler } from '@/middlewares/errorHandler';
import { logger } from '@/utils/logger';
import { AzureDevOpsService } from '@/services/azureDevOpsService';

const router = Router();
const azureDevOpsService = new AzureDevOpsService();

// Get Azure DevOps configuration
router.get('/config', asyncHandler(async (req, res) => {
  try {
    const config = await azureDevOpsService.getConfig();

    logger.info({
      requestId: req.requestId,
    }, 'Azure DevOps configuration retrieved successfully');

    res.json({
      success: true,
      data: {
        organization: config.organization,
      },
      message: 'Configuration retrieved successfully',
    });
  } catch (error) {
    logger.error('Failed to get Azure DevOps configuration:', error);
    res.status(400).json({
      success: false,
      error: 'CONFIG_ERROR',
      message: 'Failed to get Azure DevOps configuration. Please configure the organization and personal access token.',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

// Check Azure DevOps API status and rate limits
router.get('/status', asyncHandler(async (req, res) => {
  try {
    const status = await azureDevOpsService.checkApiStatus();

    logger.info({
      requestId: req.requestId,
      status: status.isAvailable,
      rateLimitRemaining: status.rateLimitRemaining,
      rateLimitReset: status.rateLimitReset,
    }, 'Azure DevOps API status checked successfully');

    res.json({
      success: true,
      data: status,
      message: 'API status checked successfully',
    });
  } catch (error) {
    logger.error('Failed to check Azure DevOps API status:', error);
    res.status(500).json({
      success: false,
      error: 'STATUS_CHECK_ERROR',
      message: 'Failed to check Azure DevOps API status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

// Validate Azure DevOps connection
router.post('/validate', asyncHandler(async (req, res) => {
  try {
    const { organization, personalAccessToken } = req.body;

    if (!organization || !personalAccessToken) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PARAMETERS',
        message: 'Organization and personal access token are required',
      });
    }

    const isValid = await azureDevOpsService.validateConnectionWithCredentials(organization, personalAccessToken);

    if (isValid) {
      logger.info({
        requestId: req.requestId,
        organization,
      }, 'Azure DevOps connection validated successfully');

      res.json({
        success: true,
        data: {
          message: 'Connection validated successfully',
        },
        message: 'Azure DevOps connection is valid',
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'CONNECTION_ERROR',
        message: 'Failed to connect to Azure DevOps. Please check your configuration.',
      });
    }
  } catch (error) {
    logger.error('Azure DevOps validation failed:', error);
    res.status(400).json({
      success: false,
      error: 'CONNECTION_ERROR',
      message: 'Failed to validate Azure DevOps connection. Please check your organization and personal access token.',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

// Get Azure DevOps projects
router.get('/projects', asyncHandler(async (req, res) => {
  try {
    const projects = await azureDevOpsService.getProjects();

    logger.info({
      projectCount: projects.length,
      requestId: req.requestId,
    }, 'Azure DevOps projects retrieved successfully');

    res.json({
      success: true,
      data: projects,
      message: 'Projects retrieved successfully',
    });
  } catch (error) {
    logger.error('Failed to get Azure DevOps projects:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: 'Failed to fetch projects from Azure DevOps',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

// Get Azure DevOps repositories for a project
router.get('/projects/:projectId/repositories', asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  try {
    const repositories = await azureDevOpsService.getRepositories(projectId);

    logger.info({
      projectId,
      repositoryCount: repositories.length,
      requestId: req.requestId,
    }, 'Azure DevOps repositories retrieved successfully');

    res.json({
      success: true,
      data: repositories,
      message: 'Repositories retrieved successfully',
    });
  } catch (error) {
    logger.error('Failed to get Azure DevOps repositories:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: 'Failed to fetch repositories from Azure DevOps',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

// Get Azure DevOps pull requests for a repository
router.get('/repositories/:repositoryId/pull-requests', asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const { status, fromDate, toDate } = req.query;

  try {
    const searchCriteria: any = {};
    if (status) searchCriteria.status = status;
    if (fromDate) searchCriteria.fromDate = fromDate;
    if (toDate) searchCriteria.toDate = toDate;

    const pullRequests = await azureDevOpsService.getPullRequests(repositoryId, searchCriteria);

    logger.info({
      repositoryId,
      pullRequestCount: pullRequests.length,
      requestId: req.requestId,
    }, 'Azure DevOps pull requests retrieved successfully');

    res.json({
      success: true,
      data: pullRequests,
      message: 'Pull requests retrieved successfully',
    });
  } catch (error) {
    logger.error('Failed to get Azure DevOps pull requests:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: 'Failed to fetch pull requests from Azure DevOps',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

// Get Azure DevOps commits for a repository
router.get('/repositories/:repositoryId/commits', asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const { fromDate, toDate, author } = req.query;

  try {
    const searchCriteria: any = {};
    if (fromDate) searchCriteria.fromDate = fromDate;
    if (toDate) searchCriteria.toDate = toDate;
    if (author) searchCriteria.author = author;

    const commits = await azureDevOpsService.getCommits(repositoryId, searchCriteria);

    logger.info({
      repositoryId,
      commitCount: commits.length,
      requestId: req.requestId,
    }, 'Azure DevOps commits retrieved successfully');

    res.json({
      success: true,
      data: commits,
      message: 'Commits retrieved successfully',
    });
  } catch (error) {
    logger.error('Failed to get Azure DevOps commits:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: 'Failed to fetch commits from Azure DevOps',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

export default router;
