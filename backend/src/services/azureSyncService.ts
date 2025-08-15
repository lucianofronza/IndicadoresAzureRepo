import axios from 'axios';
import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';
import { NotFoundError } from '@/middlewares/errorHandler';
import { SystemConfigService } from './systemConfigService';

interface AzurePullRequest {
  pullRequestId: number;
  title: string;
  status: string;
  createdBy: {
    displayName: string;
    uniqueName: string;
  };
  creationDate: string;
  closedDate?: string;
  mergeStatus?: string;
  isDraft?: boolean;
  sourceRefName?: string;
  targetRefName?: string;
  description?: string;
}

interface AzureCommit {
  commitId: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  comment: string;
}

interface AzureReview {
  id: number;
  reviewer: {
    displayName: string;
    uniqueName: string;
  };
  vote: number;
  submittedDate: string;
}

interface AzureComment {
  id: number;
  author: {
    displayName: string;
    uniqueName: string;
  };
  content: string;
  publishedDate: string;
}

interface AzureFileChange {
  changeId: number;
  item: {
    path: string;
  };
  changeType: string;
  additions?: number;
  deletions?: number;
}

export class AzureSyncService {
  private systemConfigService = new SystemConfigService();

  private async getAzureToken(): Promise<string> {
    // Get Personal Access Token from system configuration
    const token = await this.systemConfigService.getDecryptedValue('azure_devops_personal_access_token');

    if (!token) {
      throw new Error('Azure DevOps Personal Access Token not configured');
    }

    logger.info({ 
      hasToken: !!token, 
      tokenLength: token.length
    }, 'Azure DevOps token configuration');

    return token;
  }

  private async makeAzureRequest(url: string, token: string, retryCount = 0): Promise<any> {
    const maxRetries = 2;
    const baseDelay = 300; // Reduced to 300ms for better performance
    
    try {
      logger.info({ url, retryCount }, 'Making Azure DevOps request');
      
      // Add minimal delay to respect rate limits
      const delay = baseDelay * Math.pow(1.2, retryCount); // Reduced exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${token}`).toString('base64')}`,
          'Accept': 'application/json',
        },
        timeout: 8000, // Reduced to 8 seconds
      });
      
      logger.info({ 
        url, 
        status: response.status, 
        dataKeys: Object.keys(response.data),
        hasValue: !!response.data?.value,
        valueLength: response.data?.value?.length || 0
      }, 'Azure DevOps response received');
      
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const isRateLimit = status === 429;
      const isServerError = status >= 500 && status < 600;
      
      logger.error({ 
        url, 
        status,
        statusText: error.response?.statusText,
        error: error.response?.data || error.message,
        errorType: error.constructor.name,
        retryCount,
        isRateLimit,
        isServerError
      }, 'Azure API request failed');
      
      // Retry on rate limiting or server errors
      if ((isRateLimit || isServerError) && retryCount < maxRetries) {
        const retryDelay = baseDelay * Math.pow(1.5, retryCount + 1);
        logger.info({ 
          url, 
          retryCount: retryCount + 1, 
          retryDelay,
          reason: isRateLimit ? 'rate_limit' : 'server_error'
        }, 'Retrying Azure DevOps request');
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.makeAzureRequest(url, token, retryCount + 1);
      }
      
      throw error;
    }
  }

  async syncRepository(repositoryId: string, syncType: 'full' | 'incremental' = 'incremental'): Promise<void> {
    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
    });

    if (!repository) {
      throw new NotFoundError('Repository');
    }

    logger.info({ repositoryId, repositoryName: repository.name, syncType }, 'Starting Azure sync');

    try {
      const token = await this.getAzureToken();
      
      // Phase 1: Sync basic PR data, commits, reviews and comments (always needed for KPIs)
      await this.syncPullRequestsBasic(repository, token, syncType);
      
      // Also sync commits in basic phase (both full and incremental)
      await this.syncRepositoryCommits(repository, token, syncType);
      
      // Also sync reviews and comments for all PRs (both full and incremental)
      await this.syncAdditionalData(repository, token, syncType);
      
      logger.info({ repositoryId, syncType }, 'Azure sync completed successfully');
    } catch (error) {
      logger.error({ repositoryId, syncType, error }, 'Azure sync failed');
      throw error;
    }
  }

  // Phase 1: Sync basic PR data (essential for core KPIs)
  private async syncPullRequestsBasic(repository: any, token: string, syncType: 'full' | 'incremental'): Promise<void> {
    const baseUrl = `https://dev.azure.com/${repository.organization}/${repository.project}/_apis/git`;
    let skip = 0;
    const top = 100;
    let hasMore = true;
    let totalProcessed = 0;
    const maxPullRequests = 5000; // Increased limit for production

    logger.info({ 
      repositoryId: repository.id, 
      organization: repository.organization, 
      project: repository.project,
      baseUrl,
      syncType
    }, 'Starting basic pull requests sync');

    // Build URL based on sync type
    let pullRequestsUrl: string;
    
    if (syncType === 'incremental' && repository.lastSyncAt) {
      // Incremental sync: only get PRs updated since last sync
      const lastSyncDate = repository.lastSyncAt.toISOString();
      pullRequestsUrl = `${baseUrl}/pullrequests?api-version=7.0&$skip=${skip}&$top=${top}&searchCriteria.status=all&searchCriteria.updatedAfter=${lastSyncDate}`;
      logger.info({ repositoryId: repository.id, lastSyncAt: lastSyncDate }, 'Performing incremental sync');
    } else {
      // Full sync: get all PRs (either syncType is 'full' or lastSyncAt is null)
      pullRequestsUrl = `${baseUrl}/pullrequests?api-version=7.0&$skip=${skip}&$top=${top}&searchCriteria.status=all`;
      logger.info({ 
        repositoryId: repository.id, 
        syncType, 
        hasLastSyncAt: !!repository.lastSyncAt 
      }, 'Performing full sync (no previous sync or explicit full sync)');
    }

    while (hasMore) {
      // Build the URL with current skip value for this iteration
      let currentUrl: string;
      if (syncType === 'incremental' && repository.lastSyncAt) {
        const lastSyncDate = repository.lastSyncAt.toISOString();
        currentUrl = `${baseUrl}/pullrequests?api-version=7.0&$skip=${skip}&$top=${top}&searchCriteria.status=all&searchCriteria.updatedAfter=${lastSyncDate}`;
      } else {
        currentUrl = `${baseUrl}/pullrequests?api-version=7.0&$skip=${skip}&$top=${top}&searchCriteria.status=all`;
      }
      
      const pullRequestsData = await this.makeAzureRequest(currentUrl, token);

      // Check if the response has the expected structure
      if (!pullRequestsData || !pullRequestsData.value || !Array.isArray(pullRequestsData.value)) {
        logger.error({ 
          repositoryId: repository.id, 
          pullRequestsData,
          hasData: !!pullRequestsData,
          hasValue: !!pullRequestsData?.value,
          isArray: Array.isArray(pullRequestsData?.value),
          dataType: typeof pullRequestsData,
          valueType: typeof pullRequestsData?.value
        }, 'Invalid response structure from Azure DevOps');
        throw new Error(`Invalid response structure from Azure DevOps: ${JSON.stringify(pullRequestsData)}`);
      }

      logger.info({ 
        repositoryId: repository.id, 
        pullRequestsCount: pullRequestsData.value.length,
        hasMore: pullRequestsData.value.length === top,
        totalProcessed,
        skip,
        currentUrl
      }, 'Processing pull requests batch');

      // Process PRs in parallel with limited concurrency
      const batchSize = 10; // Increased batch size for better performance
      for (let i = 0; i < pullRequestsData.value.length; i += batchSize) {
        const batch = pullRequestsData.value.slice(i, i + batchSize);
        
        // Check if we've reached the limit before processing batch
        if (totalProcessed >= maxPullRequests) {
          logger.warn({ 
            repositoryId: repository.id, 
            totalProcessed, 
            maxPullRequests 
          }, 'Reached maximum pull requests limit, stopping sync');
          hasMore = false;
          break;
        }

        // Process batch in parallel
        const batchPromises = batch.map(async (azurePR) => {
          // Validate required fields from Azure DevOps API
          if (!azurePR.pullRequestId || !azurePR.title || !azurePR.createdBy) {
            logger.warn({ 
              repositoryId: repository.id, 
              azurePR,
              missingFields: {
                pullRequestId: !azurePR.pullRequestId,
                title: !azurePR.title,
                createdBy: !azurePR.createdBy
              }
            }, 'Skipping pull request with missing required fields');
            return false; // Indicate failure
          }

          try {
            await this.syncPullRequestBasic(repository, azurePR, token);
            return true; // Indicate success
          } catch (error) {
            logger.error({ 
              repositoryId: repository.id, 
              prId: azurePR.pullRequestId,
              error: error instanceof Error ? error.message : 'Unknown error'
            }, 'Failed to sync pull request, continuing with next one');
            return false; // Indicate failure
          }
        });

        const results = await Promise.all(batchPromises);
        const successfulCount = results.filter(result => result === true).length;
        totalProcessed += successfulCount;
        
        logger.info({ 
          repositoryId: repository.id, 
          totalProcessed, 
          batchSize: batch.length,
          hasMore,
          skip
        }, 'Pull requests batch processed');
      }

      // Update hasMore based on whether we received a full page
      hasMore = pullRequestsData.value.length === top;
      skip += top;
      
      logger.info({ 
        repositoryId: repository.id, 
        totalProcessed, 
        batchSize: pullRequestsData.value.length,
        hasMore,
        skip,
        receivedCount: pullRequestsData.value.length,
        expectedCount: top
      }, 'Pull requests sync progress');
    }
  }

  // Phase 2: Sync additional data for detailed KPIs (reviews and comments)
  private async syncAdditionalData(repository: any, token: string, syncType: 'full' | 'incremental' = 'full'): Promise<void> {
    logger.info({ repositoryId: repository.id, syncType }, 'Starting additional data sync for detailed KPIs');

    // Build where clause based on sync type
    let whereClause: any = { repositoryId: repository.id };
    
    if (syncType === 'incremental' && repository.lastSyncAt) {
      // For incremental sync, only get PRs updated since last sync
      whereClause.updatedAt = {
        gte: repository.lastSyncAt
      };
      logger.info({ 
        repositoryId: repository.id, 
        lastSyncAt: repository.lastSyncAt.toISOString() 
      }, 'Performing incremental additional data sync');
    } else {
      // For full sync, get all PRs from the last 6 months for performance
      whereClause.createdAt = {
        gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000)
      };
      logger.info({ 
        repositoryId: repository.id, 
        syncType, 
        hasLastSyncAt: !!repository.lastSyncAt 
      }, 'Performing full additional data sync');
    }

    // Get PRs that need additional data
    const recentPRs = await prisma.pullRequest.findMany({
      where: whereClause,
      select: { id: true, azureId: true },
      take: 500 // Limit to prevent overwhelming the API
    });

    logger.info({ 
      repositoryId: repository.id, 
      prsToSync: recentPRs.length 
    }, 'Found PRs for additional data sync');

    // Process in smaller batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < recentPRs.length; i += batchSize) {
      const batch = recentPRs.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (pr) => {
        try {
          // Sync reviews (important for review metrics)
          await this.syncReviewsForPR(repository, pr, token);
          
          // Sync comments (important for interaction metrics)
          await this.syncCommentsForPR(repository, pr, token);
          
        } catch (error) {
          logger.error({ 
            repositoryId: repository.id, 
            prId: pr.azureId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Failed to sync additional data for PR');
        }
      });

      await Promise.all(batchPromises);
      
      logger.info({ 
        repositoryId: repository.id, 
        processed: Math.min(i + batchSize, recentPRs.length),
        total: recentPRs.length
      }, 'Additional data sync progress');
    }
  }

  // Sync basic PR data (essential for core KPIs)
  private async syncPullRequestBasic(repository: any, azurePR: AzurePullRequest, token: string): Promise<void> {
    try {
      // Find or create developer
      const developer = await this.findOrCreateDeveloper(azurePR.createdBy);

      // Calculate cycle time
      const createdAt = new Date(azurePR.creationDate);
      const closedAt = azurePR.closedDate ? new Date(azurePR.closedDate) : null;
      const cycleTimeDays = closedAt ? (closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24) : null;

      // Prepare pull request data
      const pullRequestData = {
        azureId: azurePR.pullRequestId,
        title: azurePR.title,
        description: azurePR.description || azurePR.title,
        status: this.mapAzureStatus(azurePR.status),
        sourceBranch: azurePR.sourceRefName?.replace('refs/heads/', '') || 'unknown',
        targetBranch: azurePR.targetRefName?.replace('refs/heads/', '') || 'unknown',
        repositoryId: repository.id,
        createdById: developer.id,
        createdAt,
        updatedAt: new Date(),
        mergedAt: azurePR.mergeStatus === 'succeeded' ? closedAt : null,
        closedAt,
        cycleTimeDays,
        isDraft: azurePR.isDraft || false,
      };

      const pullRequest = await prisma.pullRequest.upsert({
        where: {
          azureId: azurePR.pullRequestId,
        },
        update: {
          title: azurePR.title,
          description: azurePR.description || azurePR.title,
          status: this.mapAzureStatus(azurePR.status),
          sourceBranch: azurePR.sourceRefName?.replace('refs/heads/', '') || 'unknown',
          targetBranch: azurePR.targetRefName?.replace('refs/heads/', '') || 'unknown',
          createdById: developer.id,
          createdAt,
          mergedAt: azurePR.mergeStatus === 'succeeded' ? closedAt : null,
          closedAt,
          cycleTimeDays,
          updatedAt: new Date(),
        },
        create: pullRequestData,
      });

      logger.info({ 
        repositoryId: repository.id, 
        prId: azurePR.pullRequestId,
        pullRequestId: pullRequest.id,
        operation: 'upsert'
      }, 'Pull request upserted successfully');

    } catch (error) {
      logger.error({ 
        repositoryId: repository.id, 
        prId: azurePR.pullRequestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to process pull request');
      throw error;
    }
  }

  // Sync reviews for a specific PR
  private async syncReviewsForPR(repository: any, pr: any, token: string): Promise<void> {
    const baseUrl = `https://dev.azure.com/${repository.organization}/${repository.project}/_apis/git`;
    const reviewsUrl = `${baseUrl}/repositories/${repository.azureId}/pullrequests/${pr.azureId}/reviews?api-version=7.0`;
    
    try {
      const reviewsData = await this.makeAzureRequest(reviewsUrl, token);

      if (!reviewsData || !reviewsData.value || !Array.isArray(reviewsData.value)) {
        return;
      }

      for (const azureReview of reviewsData.value) {
        const developer = await this.findOrCreateDeveloper(azureReview.reviewer);

        await prisma.review.upsert({
          where: {
            azureId: azureReview.id,
          },
          update: {
            status: this.mapAzureVote(azureReview.vote),
            vote: azureReview.vote,
            createdAt: new Date(azureReview.submittedDate),
            updatedAt: new Date(azureReview.submittedDate),
          },
          create: {
            azureId: azureReview.id,
            status: this.mapAzureVote(azureReview.vote),
            vote: azureReview.vote,
            pullRequestId: pr.id,
            reviewerId: developer.id,
            createdAt: new Date(azureReview.submittedDate),
            updatedAt: new Date(azureReview.submittedDate),
          },
        });
      }
    } catch (error) {
      logger.error({ 
        repositoryId: repository.id, 
        prId: pr.azureId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to sync reviews for PR');
    }
  }

  // Sync comments for a specific PR
  private async syncCommentsForPR(repository: any, pr: any, token: string): Promise<void> {
    const baseUrl = `https://dev.azure.com/${repository.organization}/${repository.project}/_apis/git`;
    const commentsUrl = `${baseUrl}/repositories/${repository.azureId}/pullrequests/${pr.azureId}/threads?api-version=7.0`;
    
    try {
      const threadsData = await this.makeAzureRequest(commentsUrl, token);

      if (!threadsData || !threadsData.value || !Array.isArray(threadsData.value)) {
        return;
      }

      for (const thread of threadsData.value) {
        for (const comment of thread.comments || []) {
          const developer = await this.findOrCreateDeveloper(comment.author);

          await prisma.comment.upsert({
            where: {
              azureId: comment.id,
            },
            update: {
              pullRequestId: pr.id,
              authorId: developer.id,
              content: comment.content,
              createdAt: new Date(comment.publishedDate),
            },
            create: {
              azureId: comment.id,
              pullRequestId: pr.id,
              authorId: developer.id,
              content: comment.content,
              createdAt: new Date(comment.publishedDate),
              updatedAt: new Date(comment.publishedDate),
            },
          });
        }
      }
    } catch (error) {
      logger.error({ 
        repositoryId: repository.id, 
        prId: pr.azureId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to sync comments for PR');
    }
  }

  // Sync commits directly from repository
  private async syncRepositoryCommits(repository: any, token: string, syncType: 'full' | 'incremental' = 'full'): Promise<void> {
    const baseUrl = `https://dev.azure.com/${repository.organization}/${repository.project}/_apis/git`;
    
    try {
      logger.info({ repositoryId: repository.id, syncType }, 'Starting repository commits sync');
      
      // Determine if we should do incremental sync
      const shouldDoIncremental = syncType === 'incremental' && repository.lastSyncAt;
      
      if (shouldDoIncremental) {
        logger.info({ 
          repositoryId: repository.id, 
          lastSyncAt: repository.lastSyncAt.toISOString() 
        }, 'Performing incremental commits sync');
      } else {
        logger.info({ 
          repositoryId: repository.id, 
          syncType, 
          hasLastSyncAt: !!repository.lastSyncAt 
        }, 'Performing full commits sync (no previous sync or explicit full sync)');
      }
      
      let skip = 0;
      let hasMore = true;
      let totalProcessed = 0;
      const maxCommits = 5000; // Limit to prevent overwhelming the API

      while (hasMore && totalProcessed < maxCommits) {
        // Build URL based on sync type
        let currentUrl: string;
        if (shouldDoIncremental) {
          const lastSyncDate = repository.lastSyncAt.toISOString();
          currentUrl = `${baseUrl}/repositories/${repository.azureId}/commits?api-version=7.0&$top=100&$skip=${skip}&searchCriteria.fromDate=${lastSyncDate}`;
        } else {
          currentUrl = `${baseUrl}/repositories/${repository.azureId}/commits?api-version=7.0&$top=100&$skip=${skip}`;
        }
        
        const commitsData = await this.makeAzureRequest(currentUrl, token);

        if (!commitsData || !commitsData.value || !Array.isArray(commitsData.value)) {
          logger.warn({ repositoryId: repository.id }, 'No commits data received from Azure DevOps');
          break;
        }

        logger.info({ 
          repositoryId: repository.id, 
          commitsCount: commitsData.value.length,
          totalProcessed
        }, 'Processing commits batch');

        // Process commits in parallel
        const commitPromises = commitsData.value.map(async (azureCommit) => {
          try {
            const developer = await this.findOrCreateDeveloper({
              displayName: azureCommit.author.name,
              uniqueName: azureCommit.author.email,
            });

            await prisma.commit.upsert({
              where: {
                azureId: azureCommit.commitId,
              },
              update: {
                authorId: developer.id,
                createdAt: new Date(azureCommit.author.date),
              },
              create: {
                azureId: azureCommit.commitId,
                message: azureCommit.comment || 'No message',
                hash: azureCommit.commitId,
                repositoryId: repository.id,
                authorId: developer.id,
                createdAt: new Date(azureCommit.author.date),
              },
            });

            return true;
          } catch (error) {
            logger.error({ 
              repositoryId: repository.id, 
              commitId: azureCommit.commitId,
              error: error instanceof Error ? error.message : 'Unknown error'
            }, 'Failed to sync commit');
            return false;
          }
        });

        const results = await Promise.all(commitPromises);
        const successfulCount = results.filter(result => result === true).length;
        totalProcessed += successfulCount;

        hasMore = commitsData.value.length === 100;
        skip += 100;

        logger.info({ 
          repositoryId: repository.id, 
          totalProcessed,
          hasMore,
          skip
        }, 'Repository commits sync progress');
      }

      logger.info({ 
        repositoryId: repository.id, 
        totalProcessed 
      }, 'Repository commits sync completed');

    } catch (error) {
      logger.error({ 
        repositoryId: repository.id, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to sync repository commits');
    }
  }

  // Sync commits for a specific PR
  private async syncCommitsForPR(repository: any, pr: any, token: string): Promise<void> {
    const baseUrl = `https://dev.azure.com/${repository.organization}/${repository.project}/_apis/git`;
    const commitsUrl = `${baseUrl}/repositories/${repository.azureId}/pullrequests/${pr.azureId}/commits?api-version=7.0`;
    
    try {
      const commitsData = await this.makeAzureRequest(commitsUrl, token);

      if (!commitsData || !commitsData.value || !Array.isArray(commitsData.value)) {
        return;
      }

      for (const azureCommit of commitsData.value) {
        const developer = await this.findOrCreateDeveloper({
          displayName: azureCommit.author.name,
          uniqueName: azureCommit.author.email,
        });

        await prisma.commit.upsert({
          where: {
            azureId: azureCommit.commitId,
          },
          update: {
            authorId: developer.id,
            createdAt: new Date(azureCommit.author.date),
          },
          create: {
            azureId: azureCommit.commitId,
            message: azureCommit.comment || 'No message',
            hash: azureCommit.commitId,
            repositoryId: repository.id,
            authorId: developer.id,
            createdAt: new Date(azureCommit.author.date),
          },
        });
      }
    } catch (error) {
      logger.error({ 
        repositoryId: repository.id, 
        prId: pr.azureId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to sync commits for PR');
    }
  }

  // Keep the original syncPullRequest method for backward compatibility
  private async syncPullRequest(repository: any, azurePR: AzurePullRequest, token: string): Promise<void> {
    try {
      logger.info({ 
        repositoryId: repository.id, 
        prId: azurePR.pullRequestId,
        title: azurePR.title,
        status: azurePR.status,
        createdBy: azurePR.createdBy
      }, 'Processing pull request');

      // Find or create developer
      const developer = await this.findOrCreateDeveloper(azurePR.createdBy);

      // Calculate cycle time and review queue time
      const createdAt = new Date(azurePR.creationDate);
      const closedAt = azurePR.closedDate ? new Date(azurePR.closedDate) : null;
      const cycleTimeDays = closedAt ? (closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24) : null;

      // Validate required fields before database operation
      if (!azurePR.pullRequestId || !azurePR.title || !developer.id || !repository.id) {
        logger.error({ 
          repositoryId: repository.id, 
          prId: azurePR.pullRequestId,
          title: azurePR.title,
          developerId: developer.id,
          azurePR
        }, 'Missing required fields for pull request creation');
        throw new Error('Missing required fields for pull request creation');
      }

      // Prepare pull request data
      const pullRequestData = {
        azureId: azurePR.pullRequestId,
        title: azurePR.title,
        description: azurePR.title, // Use title as description if no description
        status: this.mapAzureStatus(azurePR.status),
        sourceBranch: 'unknown', // Will need to be updated with actual branch info
        targetBranch: 'unknown', // Will need to be updated with actual branch info
        repositoryId: repository.id,
        createdById: developer.id,
        createdAt,
        updatedAt: new Date(),
        mergedAt: azurePR.mergeStatus === 'succeeded' ? closedAt : null,
        closedAt,
        cycleTimeDays,
        isDraft: azurePR.isDraft || false,
      };

      // Log the data being inserted
      logger.info({ 
        repositoryId: repository.id, 
        prId: azurePR.pullRequestId,
        developerId: developer.id,
        title: azurePR.title,
        status: this.mapAzureStatus(azurePR.status),
        createdAt: createdAt.toISOString(),
        closedAt: closedAt?.toISOString(),
        cycleTimeDays,
        pullRequestData
      }, 'Attempting to upsert pull request');

      // Validate data types before database operation
      if (typeof pullRequestData.azureId !== 'number') {
        throw new Error(`Invalid azureId type: ${typeof pullRequestData.azureId}, expected number`);
      }
      if (typeof pullRequestData.title !== 'string' || pullRequestData.title.length === 0) {
        throw new Error(`Invalid title: ${pullRequestData.title}`);
      }
      if (typeof pullRequestData.repositoryId !== 'string' || pullRequestData.repositoryId.length === 0) {
        throw new Error(`Invalid repositoryId: ${pullRequestData.repositoryId}`);
      }
      if (typeof pullRequestData.createdById !== 'string' || pullRequestData.createdById.length === 0) {
        throw new Error(`Invalid createdById: ${pullRequestData.createdById}`);
      }

      const pullRequest = await prisma.pullRequest.upsert({
        where: {
          azureId: azurePR.pullRequestId,
        },
        update: {
          title: azurePR.title,
          status: this.mapAzureStatus(azurePR.status),
          createdById: developer.id,
          createdAt,
          mergedAt: azurePR.mergeStatus === 'succeeded' ? closedAt : null,
          closedAt,
          cycleTimeDays,
          updatedAt: new Date(),
        },
        create: pullRequestData,
      });

      logger.info({ 
        repositoryId: repository.id, 
        prId: azurePR.pullRequestId,
        pullRequestId: pullRequest.id,
        operation: 'upsert'
      }, 'Pull request upserted successfully');

      // Sync commits
      await this.syncCommits(repository, pullRequest, azurePR.pullRequestId, token);

      // Sync reviews
      await this.syncReviews(repository, pullRequest, azurePR.pullRequestId, token);

      // Sync comments
      await this.syncComments(repository, pullRequest, azurePR.pullRequestId, token);

      // Sync file changes
      logger.info({ 
        repositoryId: repository.id, 
        prId: azurePR.pullRequestId,
        pullRequestId: pullRequest.id
      }, 'About to sync file changes');
      
      await this.syncFileChanges(repository, pullRequest, azurePR.pullRequestId, token);

      logger.info({ 
        repositoryId: repository.id, 
        prId: azurePR.pullRequestId,
        pullRequestId: pullRequest.id
      }, 'Pull request processed successfully');
    } catch (error) {
      logger.error({ 
        repositoryId: repository.id, 
        prId: azurePR.pullRequestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to process pull request');
      throw error;
    }
  }

  private async syncCommits(repository: any, pullRequest: any, prId: number, token: string): Promise<void> {
    const baseUrl = `https://dev.azure.com/${repository.organization}/${repository.project}/_apis/git`;
    const commitsUrl = `${baseUrl}/repositories/${repository.azureId}/pullrequests/${prId}/commits?api-version=7.0`;
    
    try {
      const commitsData = await this.makeAzureRequest(commitsUrl, token);

      // Check if the response has the expected structure
      if (!commitsData || !commitsData.value || !Array.isArray(commitsData.value)) {
        logger.warn({ repositoryId: repository.id, prId, commitsData }, 'Invalid commits response structure');
        return;
      }

      for (const azureCommit of commitsData.value) {
        const developer = await this.findOrCreateDeveloper({
          displayName: azureCommit.author.name,
          uniqueName: azureCommit.author.email,
        });

        await prisma.commit.upsert({
          where: {
            azureId: azureCommit.commitId,
          },
          update: {
            authorId: developer.id,
            createdAt: new Date(azureCommit.author.date),
          },
          create: {
            azureId: azureCommit.commitId,
            message: azureCommit.comment || 'No message',
            hash: azureCommit.commitId,
            repositoryId: repository.id,
            authorId: developer.id,
            createdAt: new Date(azureCommit.author.date),
          },
        });
      }
    } catch (error) {
      logger.error({ 
        repositoryId: repository.id, 
        prId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to sync commits');
    }
  }

  private async syncReviews(repository: any, pullRequest: any, prId: number, token: string): Promise<void> {
    const baseUrl = `https://dev.azure.com/${repository.organization}/${repository.project}/_apis/git`;
    const reviewsUrl = `${baseUrl}/repositories/${repository.azureId}/pullrequests/${prId}/reviews?api-version=7.0`;
    
    try {
      const reviewsData = await this.makeAzureRequest(reviewsUrl, token);

      for (const azureReview of reviewsData.value) {
        const developer = await this.findOrCreateDeveloper(azureReview.reviewer);

        await prisma.review.upsert({
          where: {
            azureId: azureReview.id,
          },
          update: {
            status: this.mapAzureVote(azureReview.vote),
            vote: azureReview.vote,
            createdAt: new Date(azureReview.submittedDate),
            updatedAt: new Date(azureReview.submittedDate),
          },
          create: {
            azureId: azureReview.id,
            status: this.mapAzureVote(azureReview.vote),
            vote: azureReview.vote,
            pullRequestId: pullRequest.id,
            reviewerId: developer.id,
            createdAt: new Date(azureReview.submittedDate),
            updatedAt: new Date(azureReview.submittedDate),
          },
        });
      }
    } catch (error) {
      logger.error({ 
        repositoryId: repository.id, 
        prId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to sync reviews');
    }
  }

  private async syncComments(repository: any, pullRequest: any, prId: number, token: string): Promise<void> {
    const baseUrl = `https://dev.azure.com/${repository.organization}/${repository.project}/_apis/git`;
    const commentsUrl = `${baseUrl}/repositories/${repository.azureId}/pullrequests/${prId}/threads?api-version=7.0`;
    
    try {
      const threadsData = await this.makeAzureRequest(commentsUrl, token);

      for (const thread of threadsData.value) {
        for (const comment of thread.comments || []) {
          const developer = await this.findOrCreateDeveloper(comment.author);

          await prisma.comment.upsert({
            where: {
              azureId: comment.id,
            },
            update: {
              pullRequestId: pullRequest.id,
              authorId: developer.id,
              content: comment.content,
              createdAt: new Date(comment.publishedDate),
            },
            create: {
              azureId: comment.id,
              pullRequestId: pullRequest.id,
              authorId: developer.id,
              content: comment.content,
              createdAt: new Date(comment.publishedDate),
              updatedAt: new Date(comment.publishedDate),
            },
          });
        }
      }
    } catch (error) {
      logger.error({ 
        repositoryId: repository.id, 
        prId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to sync comments');
    }
  }

  private async syncFileChanges(repository: any, pullRequest: any, prId: number, token: string): Promise<void> {
    const baseUrl = `https://dev.azure.com/${repository.organization}/${repository.project}/_apis/git`;
    const changesUrl = `${baseUrl}/repositories/${repository.azureId}/pullrequests/${prId}/changes?api-version=7.0`;
    
    logger.info({ 
      repositoryId: repository.id, 
      prId, 
      changesUrl 
    }, 'Starting file changes sync');
    
    try {
      const changesData = await this.makeAzureRequest(changesUrl, token);
      
      logger.info({ 
        repositoryId: repository.id, 
        prId,
        hasValue: !!changesData.value,
        valueLength: changesData.value?.length,
        valueType: typeof changesData.value
      }, 'File changes API response received');
      
      if (changesData.value && Array.isArray(changesData.value)) {
        let totalFilesChanged = 0;
        let totalLinesAdded = 0;
        let totalLinesDeleted = 0;
        
        // Count unique files changed
        const uniqueFiles = new Set();
        
        changesData.value.forEach((change: any) => {
          if (change.item && change.item.path) {
            uniqueFiles.add(change.item.path);
          }
          
          if (change.additions) {
            totalLinesAdded += change.additions;
          }
          
          if (change.deletions) {
            totalLinesDeleted += change.deletions;
          }
        });
        
        totalFilesChanged = uniqueFiles.size;
        
        // Update the pull request with file change statistics
        await prisma.pullRequest.update({
          where: { id: pullRequest.id },
          data: {
            filesChanged: totalFilesChanged,
            linesAdded: totalLinesAdded,
            linesDeleted: totalLinesDeleted,
          },
        });
        
        logger.info({ 
          repositoryId: repository.id, 
          prId, 
          totalFilesChanged,
          totalLinesAdded,
          totalLinesDeleted
        }, 'Successfully synced file changes for PR');
      } else {
        logger.warn({ 
          repositoryId: repository.id, 
          prId,
          hasValue: !!changesData.value,
          valueType: typeof changesData.value
        }, 'No file changes data found for PR');
      }
    } catch (error) {
      logger.error({ 
        repositoryId: repository.id, 
        prId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to sync file changes');
    }
  }



  private async findOrCreateDeveloper(azureUser: { displayName: string; uniqueName: string }): Promise<any> {
    try {
      logger.info({ 
        displayName: azureUser.displayName, 
        uniqueName: azureUser.uniqueName 
      }, 'Finding or creating developer');

      // Try to find by login (uniqueName)
      let developer = await prisma.developer.findUnique({
        where: { login: azureUser.uniqueName },
      });

      if (!developer) {
        // Create a new developer with default values
        logger.info({ 
          displayName: azureUser.displayName, 
          uniqueName: azureUser.uniqueName 
        }, 'Creating new developer');

        // Validate developer data before creation
        if (!azureUser.displayName) {
          logger.error({ 
            displayName: azureUser.displayName, 
            uniqueName: azureUser.uniqueName 
          }, 'Invalid developer data for creation');
          throw new Error('Invalid developer data: displayName is required');
        }

        // Use displayName as uniqueName if uniqueName is empty
        const uniqueName = azureUser.uniqueName || azureUser.displayName;

        developer = await prisma.developer.create({
          data: {
            name: azureUser.displayName,
            login: uniqueName,
            email: uniqueName, // Use uniqueName as email if no email provided
            teamId: null, // Will need to be set manually
            roleId: null, // Will need to be set manually
          },
        });

        logger.info({ 
          developerId: developer.id, 
          developerName: developer.name,
          developerLogin: developer.login,
          developerEmail: developer.email
        }, 'Created new developer from Azure sync');
      } else {
        logger.info({ 
          developerId: developer.id, 
          developerName: developer.name 
        }, 'Found existing developer');
      }

      return developer;
    } catch (error) {
      logger.error({ 
        displayName: azureUser.displayName, 
        uniqueName: azureUser.uniqueName,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to find or create developer');
      throw error;
    }
  }

  private mapAzureStatus(azureStatus: string): string {
    switch (azureStatus.toLowerCase()) {
      case 'active':
        return 'active';
      case 'abandoned':
        return 'closed';
      case 'completed':
        return 'completed';
      default:
        return 'active';
    }
  }

  private mapAzureVote(vote: number): string {
    switch (vote) {
      case 10:
        return 'approved';
      case 5:
        return 'approved_with_suggestions';
      case -5:
        return 'waiting_for_author';
      case -10:
        return 'rejected';
      default:
        return 'no_response';
    }
  }
}
