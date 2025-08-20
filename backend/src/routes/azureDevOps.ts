import { Router } from 'express';
import { asyncHandler } from '@/middlewares/errorHandler';
import { logger } from '@/utils/logger';
import { AzureDevOpsService } from '@/services/azureDevOpsService';

const router = Router();
const azureDevOpsService = new AzureDevOpsService();

// Store temporary credentials for the session
const sessionCredentials = new Map<string, { organization: string; personalAccessToken: string }>();



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
      // Store credentials for this session
      const sessionId = req.requestId || `session_${Date.now()}`;
      sessionCredentials.set(sessionId, { organization, personalAccessToken });

      logger.info({
        requestId: req.requestId,
        organization,
        sessionId,
      }, 'Azure DevOps connection validated successfully');

      res.json({
        success: true,
        data: {
          message: 'Connection validated successfully',
          sessionId,
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

// Get Azure DevOps projects using session credentials
router.get('/projects', asyncHandler(async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_SESSION',
        message: 'Session ID is required. Please validate your connection first.',
      });
    }

    const credentials = sessionCredentials.get(sessionId);
    
    if (!credentials) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_SESSION',
        message: 'Session expired. Please validate your connection again.',
      });
    }

    const projects = await azureDevOpsService.getProjectsWithCredentials(
      credentials.organization, 
      credentials.personalAccessToken
    );

    logger.info({
      projectCount: projects.length,
      requestId: req.requestId,
      organization: credentials.organization,
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

// Get Azure DevOps repositories for a project using session credentials
router.get('/projects/:projectId/repositories', asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  try {
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_SESSION',
        message: 'Session ID is required. Please validate your connection first.',
      });
    }

    const credentials = sessionCredentials.get(sessionId);
    
    if (!credentials) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_SESSION',
        message: 'Session expired. Please validate your connection again.',
      });
    }

    const repositories = await azureDevOpsService.getRepositoriesWithCredentials(
      credentials.organization, 
      credentials.personalAccessToken, 
      projectId
    );

    logger.info({
      projectId,
      repositoryCount: repositories.length,
      requestId: req.requestId,
      organization: credentials.organization,
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

// Get Azure DevOps pull requests for a repository using session credentials
router.get('/repositories/:repositoryId/pull-requests', asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const { status, fromDate, toDate } = req.query;

  try {
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_SESSION',
        message: 'Session ID is required. Please validate your connection first.',
      });
    }

    const credentials = sessionCredentials.get(sessionId);
    
    if (!credentials) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_SESSION',
        message: 'Session expired. Please validate your connection again.',
      });
    }

    const searchCriteria: any = {};
    if (status) searchCriteria.status = status;
    if (fromDate) searchCriteria.fromDate = fromDate;
    if (toDate) searchCriteria.toDate = toDate;

    const pullRequests = await azureDevOpsService.getPullRequestsWithCredentials(
      credentials.organization,
      credentials.personalAccessToken,
      repositoryId,
      searchCriteria
    );

    logger.info({
      repositoryId,
      pullRequestCount: pullRequests.length,
      requestId: req.requestId,
      organization: credentials.organization,
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

// Get Azure DevOps commits for a repository using session credentials
router.get('/repositories/:repositoryId/commits', asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const { fromDate, toDate, author } = req.query;

  try {
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_SESSION',
        message: 'Session ID is required. Please validate your connection first.',
      });
    }

    const credentials = sessionCredentials.get(sessionId);
    
    if (!credentials) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_SESSION',
        message: 'Session expired. Please validate your connection again.',
      });
    }

    const searchCriteria: any = {};
    if (fromDate) searchCriteria.fromDate = fromDate;
    if (toDate) searchCriteria.toDate = toDate;
    if (author) searchCriteria.author = author;

    const commits = await azureDevOpsService.getCommitsWithCredentials(
      credentials.organization,
      credentials.personalAccessToken,
      repositoryId,
      searchCriteria
    );

    logger.info({
      repositoryId,
      commitCount: commits.length,
      requestId: req.requestId,
      organization: credentials.organization,
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
