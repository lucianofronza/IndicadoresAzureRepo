import axios, { AxiosInstance } from 'axios';
import { getPrisma } from '@/config/database';
import { logger } from '@/utils/logger';
import { syncMetrics, recordAzureApiRequest } from '@/utils/metrics';

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  error?: string;
}

export interface AzureRepository {
  id: string;
  name: string;
  organization: string;
  project: string;
  encryptedToken: string;
  lastSyncAt: Date | null;
}

export class AzureSyncService {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: process.env.AZURE_DEVOPS_BASE_URL || 'https://dev.azure.com',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Indicadores-Sync-Service/1.0.0'
      }
    });

    // Add request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.debug('Azure API request:', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL
        });
        return config;
      },
      (error) => {
        logger.error('Azure API request error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging and metrics
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const duration = Date.now() - (response.config as any).startTime;
        recordAzureApiRequest(
          response.config.url || 'unknown',
          response.status.toString(),
          duration
        );
        return response;
      },
      (error) => {
        const duration = Date.now() - (error.config?.startTime || Date.now());
        recordAzureApiRequest(
          error.config?.url || 'unknown',
          error.response?.status?.toString() || 'error',
          duration
        );
        return Promise.reject(error);
      }
    );
  }

  async syncRepository(
    repositoryId: string,
    syncType: 'full' | 'incremental' = 'incremental'
  ): Promise<SyncResult> {
    try {
      logger.info('Starting Azure sync', { repositoryId, syncType });

      // Get repository configuration
      const repository = await this.getRepository(repositoryId);
      if (!repository) {
        throw new Error('Repository not found');
      }

      // Decrypt token
      const token = await this.decryptToken(repository.encryptedToken);
      if (!token) {
        throw new Error('Invalid or missing Azure DevOps token');
      }

      // Set up authentication
      this.axiosInstance.defaults.auth = {
        username: '',
        password: token
      };

      // Determine sync parameters
      const since = syncType === 'incremental' && repository.lastSyncAt 
        ? repository.lastSyncAt.toISOString()
        : undefined;

      let totalRecordsProcessed = 0;

      // Sync pull requests
      const prRecords = await this.syncPullRequests(repository, since);
      totalRecordsProcessed += prRecords;

      // Sync commits
      const commitRecords = await this.syncCommits(repository, since);
      totalRecordsProcessed += commitRecords;

      // Sync work items (if needed)
      const workItemRecords = await this.syncWorkItems(repository, since);
      totalRecordsProcessed += workItemRecords;

      logger.info('Azure sync completed', {
        repositoryId,
        syncType,
        recordsProcessed: totalRecordsProcessed
      });

      return {
        success: true,
        recordsProcessed: totalRecordsProcessed
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Azure sync failed', {
        repositoryId,
        syncType,
        error: errorMessage
      });

      return {
        success: false,
        recordsProcessed: 0,
        error: errorMessage
      };
    }
  }

  private async getRepository(repositoryId: string): Promise<AzureRepository | null> {
    const prisma = getPrisma();
    
    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
      select: {
        id: true,
        name: true,
        organization: true,
        project: true,
        encryptedToken: true,
        lastSyncAt: true
      }
    });

    return repository;
  }

  private async decryptToken(encryptedToken: string): Promise<string | null> {
    try {
      // TODO: Implement proper token decryption
      // For now, return the token as-is (in production, use proper encryption)
      return encryptedToken;
    } catch (error) {
      logger.error('Failed to decrypt token:', error);
      return null;
    }
  }

  private async syncPullRequests(
    repository: AzureRepository,
    since?: string
  ): Promise<number> {
    try {
      const url = `/${repository.organization}/${repository.project}/_apis/git/repositories/${repository.name}/pullrequests`;
      const params: any = {
        'api-version': '7.0',
        '$top': 100
      };

      if (since) {
        params.searchCriteria = {
          targetRefName: 'refs/heads/main',
          status: 'completed',
          createdDate: since
        };
      }

      const response = await this.makeRequest('GET', url, { params });
      const pullRequests = response.data.value || [];

      // Process and save pull requests
      const recordsProcessed = await this.processPullRequests(repository.id, pullRequests);

      logger.info('Pull requests synced', {
        repositoryId: repository.id,
        count: pullRequests.length,
        recordsProcessed
      });

      return recordsProcessed;

    } catch (error) {
      logger.error('Failed to sync pull requests:', error);
      return 0;
    }
  }

  private async syncCommits(
    repository: AzureRepository,
    since?: string
  ): Promise<number> {
    try {
      const url = `/${repository.organization}/${repository.project}/_apis/git/repositories/${repository.name}/commits`;
      const params: any = {
        'api-version': '7.0',
        '$top': 100
      };

      if (since) {
        params.fromDate = since;
      }

      const response = await this.makeRequest('GET', url, { params });
      const commits = response.data.value || [];

      // Process and save commits
      const recordsProcessed = await this.processCommits(repository.id, commits);

      logger.info('Commits synced', {
        repositoryId: repository.id,
        count: commits.length,
        recordsProcessed
      });

      return recordsProcessed;

    } catch (error) {
      logger.error('Failed to sync commits:', error);
      return 0;
    }
  }

  private async syncWorkItems(
    repository: AzureRepository,
    since?: string
  ): Promise<number> {
    try {
      // Get work items linked to commits/PRs
      const url = `/${repository.organization}/${repository.project}/_apis/wit/wiql`;
      
      const query = {
        query: since 
          ? `SELECT [System.Id] FROM WorkItems WHERE [System.ChangedDate] >= '${since}'`
          : `SELECT [System.Id] FROM WorkItems WHERE [System.ChangedDate] >= @Today - 30`
      };

      const response = await this.makeRequest('POST', url, {
        data: query,
        params: { 'api-version': '7.0' }
      });

      const workItemIds = response.data.workItems?.map((wi: any) => wi.id) || [];
      
      if (workItemIds.length === 0) {
        return 0;
      }

      // Get work item details
      const workItemsUrl = `/${repository.organization}/${repository.project}/_apis/wit/workitems`;
      const workItemsResponse = await this.makeRequest('GET', workItemsUrl, {
        params: {
          ids: workItemIds.join(','),
          'api-version': '7.0',
          '$expand': 'all'
        }
      });

      const workItems = workItemsResponse.data.value || [];

      // Process and save work items
      const recordsProcessed = await this.processWorkItems(repository.id, workItems);

      logger.info('Work items synced', {
        repositoryId: repository.id,
        count: workItems.length,
        recordsProcessed
      });

      return recordsProcessed;

    } catch (error) {
      logger.error('Failed to sync work items:', error);
      return 0;
    }
  }

  private async makeRequest(method: string, url: string, config: any = {}) {
    const startTime = Date.now();
    (config as any).startTime = startTime;

    try {
      const response = await this.axiosInstance.request({
        method: method as any,
        url,
        ...config
      });

      return response;
    } catch (error: any) {
      if (error.response?.status === 429) {
        // Rate limit hit, wait and retry
        const retryAfter = error.response.headers['retry-after'] || 60;
        logger.warn('Rate limit hit, waiting', { retryAfter });
        await this.delay(retryAfter * 1000);
        
        // Retry the request
        return this.makeRequest(method, url, config);
      }
      
      throw error;
    }
  }

  private async processPullRequests(repositoryId: string, pullRequests: any[]): Promise<number> {
    const prisma = getPrisma();
    let processed = 0;

    for (const pr of pullRequests) {
      try {
        // Check if PR already exists
        const existing = await prisma.pullRequest.findUnique({
          where: { azureId: pr.pullRequestId.toString() }
        });

        if (!existing) {
          // Create new PR record
          await prisma.pullRequest.create({
            data: {
              azureId: pr.pullRequestId.toString(),
              repositoryId,
              title: pr.title,
              description: pr.description,
              status: pr.status,
              createdBy: pr.createdBy?.displayName || 'Unknown',
              createdDate: new Date(pr.creationDate),
              closedDate: pr.closedDate ? new Date(pr.closedDate) : null,
              mergeStatus: pr.mergeStatus,
              sourceRefName: pr.sourceRefName,
              targetRefName: pr.targetRefName,
              isDraft: pr.isDraft || false
            }
          });
          processed++;
        }
      } catch (error) {
        logger.error('Failed to process pull request:', { prId: pr.pullRequestId, error });
      }
    }

    return processed;
  }

  private async processCommits(repositoryId: string, commits: any[]): Promise<number> {
    const prisma = getPrisma();
    let processed = 0;

    for (const commit of commits) {
      try {
        // Check if commit already exists
        const existing = await prisma.commit.findUnique({
          where: { azureId: commit.commitId }
        });

        if (!existing) {
          // Create new commit record
          await prisma.commit.create({
            data: {
              azureId: commit.commitId,
              repositoryId,
              message: commit.comment,
              author: commit.author?.name || 'Unknown',
              authorEmail: commit.author?.email || '',
              committer: commit.committer?.name || 'Unknown',
              committerEmail: commit.committer?.email || '',
              commitDate: new Date(commit.author?.date || commit.committer?.date),
              pushDate: new Date(commit.push?.pushedDate),
              changeCounts: commit.changeCounts || {}
            }
          });
          processed++;
        }
      } catch (error) {
        logger.error('Failed to process commit:', { commitId: commit.commitId, error });
      }
    }

    return processed;
  }

  private async processWorkItems(repositoryId: string, workItems: any[]): Promise<number> {
    const prisma = getPrisma();
    let processed = 0;

    for (const workItem of workItems) {
      try {
        // Check if work item already exists
        const existing = await prisma.workItem.findUnique({
          where: { azureId: workItem.id.toString() }
        });

        if (!existing) {
          // Create new work item record
          await prisma.workItem.create({
            data: {
              azureId: workItem.id.toString(),
              repositoryId,
              title: workItem.fields['System.Title'] || '',
              workItemType: workItem.fields['System.WorkItemType'] || '',
              state: workItem.fields['System.State'] || '',
              assignedTo: workItem.fields['System.AssignedTo']?.displayName || '',
              createdBy: workItem.fields['System.CreatedBy']?.displayName || '',
              createdDate: new Date(workItem.fields['System.CreatedDate']),
              changedDate: new Date(workItem.fields['System.ChangedDate']),
              priority: workItem.fields['Microsoft.VSTS.Common.Priority'] || 0,
              severity: workItem.fields['Microsoft.VSTS.Common.Severity'] || ''
            }
          });
          processed++;
        }
      } catch (error) {
        logger.error('Failed to process work item:', { workItemId: workItem.id, error });
      }
    }

    return processed;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
