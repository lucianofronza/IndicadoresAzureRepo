import axios from 'axios';
import { logger } from '@/utils/logger';
import { SystemConfigService } from './systemConfigService';

export interface AzureDevOpsConfig {
  organization: string;
  personalAccessToken: string;
}

export interface AzureDevOpsProject {
  id: string;
  name: string;
  description?: string;
  url: string;
}

export interface AzureDevOpsRepository {
  id: string;
  name: string;
  url: string;
  project: {
    id: string;
    name: string;
  };
  defaultBranch: string;
}

export interface AzureDevOpsPullRequest {
  id: number;
  title: string;
  description?: string;
  status: string;
  createdBy: {
    id: string;
    displayName: string;
    uniqueName: string;
  };
  creationDate: string;
  closedDate?: string;
  mergeStatus: string;
  isDraft: boolean;
  url: string;
  sourceRefName: string;
  targetRefName: string;
}

export interface AzureDevOpsCommit {
  commitId: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
  comment: string;
  url: string;
}

export interface AzureDevOpsReview {
  id: number;
  reviewer: {
    id: string;
    displayName: string;
    uniqueName: string;
  };
  vote: number; // 10 = approved, 5 = approved with suggestions, -10 = rejected, 0 = no vote
  isContainer: boolean;
  createdDate: string;
  updatedDate: string;
}

export class AzureDevOpsService {
  private systemConfigService: SystemConfigService;

  constructor() {
    this.systemConfigService = new SystemConfigService();
  }

  async getConfig(): Promise<AzureDevOpsConfig> {
    const config = await this.systemConfigService.getAzureDevOpsConfig();
    
    if (!config) {
      throw new Error('Azure DevOps configuration not found. Please configure the organization and personal access token.');
    }

    return config;
  }

  private getAuthHeaders(personalAccessToken: string) {
    return {
      'Authorization': `Basic ${Buffer.from(`:${personalAccessToken}`).toString('base64')}`,
      'Accept': 'application/json',
    };
  }

  async validateConnection(): Promise<boolean> {
    try {
      const config = await this.getConfig();
      const baseUrl = `https://dev.azure.com/${config.organization}`;
      
      const response = await axios.get(`${baseUrl}/_apis/projects?api-version=7.0&$top=1`, {
        headers: this.getAuthHeaders(config.personalAccessToken),
        timeout: 10000, // 10 seconds timeout
      });

      return response.status === 200;
    } catch (error) {
      logger.error('Failed to validate Azure DevOps connection:', error);
      return false;
    }
  }

  async validateConnectionWithCredentials(organization: string, personalAccessToken: string): Promise<boolean> {
    try {
      const baseUrl = `https://dev.azure.com/${organization}`;
      
      logger.info({ 
        organization,
        hasToken: !!personalAccessToken,
        tokenLength: personalAccessToken.length
      }, 'Validating Azure DevOps connection with provided credentials');
      
      const response = await axios.get(`${baseUrl}/_apis/projects?api-version=7.0&$top=1`, {
        headers: this.getAuthHeaders(personalAccessToken),
        timeout: 10000, // 10 seconds timeout
      });

      logger.info({ 
        organization,
        status: response.status,
        hasData: !!response.data,
        projectCount: response.data?.value?.length || 0
      }, 'Azure DevOps connection validation successful');

      return response.status === 200;
    } catch (error: any) {
      const status = error.response?.status;
      const errorMessage = error.response?.data?.message || error.message;
      
      logger.error({ 
        organization,
        status,
        error: errorMessage,
        responseData: error.response?.data
      }, 'Azure DevOps connection validation failed');
      
      return false;
    }
  }

  async checkApiStatus(): Promise<{
    isAvailable: boolean;
    rateLimitRemaining?: number;
    rateLimitReset?: string;
    lastError?: string;
    responseTime?: number;
  }> {
    try {
      const config = await this.getConfig();
      const baseUrl = `https://dev.azure.com/${config.organization}`;
      
      const startTime = Date.now();
      
      const response = await axios.get(`${baseUrl}/_apis/projects?api-version=7.0&$top=1`, {
        headers: this.getAuthHeaders(config.personalAccessToken),
        timeout: 10000, // 10 seconds timeout
      });
      
      const responseTime = Date.now() - startTime;
      
      // Check rate limit headers (Azure DevOps may not always provide these)
      const rateLimitRemaining = response.headers['x-ratelimit-remaining'] || 
                                response.headers['x-ms-ratelimit-remaining'] ||
                                undefined;
      
      const rateLimitReset = response.headers['x-ratelimit-reset'] || 
                            response.headers['x-ms-ratelimit-reset'] ||
                            undefined;
      
      logger.info({
        status: response.status,
        responseTime,
        rateLimitRemaining,
        rateLimitReset,
        headers: Object.keys(response.headers)
      }, 'Azure DevOps API status check completed');
      
      return {
        isAvailable: response.status === 200,
        rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined,
        rateLimitReset,
        responseTime,
      };
    } catch (error: any) {
      const status = error.response?.status;
      const isRateLimit = status === 429;
      
      logger.error({
        status,
        isRateLimit,
        error: error.response?.data || error.message,
        headers: error.response?.headers
      }, 'Azure DevOps API status check failed');
      
      return {
        isAvailable: false,
        lastError: error.response?.data?.message || error.message,
        rateLimitRemaining: isRateLimit ? 0 : undefined,
        rateLimitReset: error.response?.headers?.['x-ratelimit-reset'] || 
                       error.response?.headers?.['x-ms-ratelimit-reset'] ||
                       undefined,
      };
    }
  }

  async getProjects(): Promise<AzureDevOpsProject[]> {
    try {
      const config = await this.getConfig();
      const baseUrl = `https://dev.azure.com/${config.organization}`;
      
      const response = await axios.get(`${baseUrl}/_apis/projects?api-version=7.0`, {
        headers: this.getAuthHeaders(config.personalAccessToken),
      });

      return response.data.value.map((project: any) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        url: project.url,
      }));
    } catch (error) {
      logger.error('Failed to get Azure DevOps projects:', error);
      throw new Error('Failed to fetch projects from Azure DevOps');
    }
  }

  async getRepositories(projectId: string): Promise<AzureDevOpsRepository[]> {
    try {
      const config = await this.getConfig();
      const baseUrl = `https://dev.azure.com/${config.organization}`;
      
      const response = await axios.get(
        `${baseUrl}/${projectId}/_apis/git/repositories?api-version=7.0`,
        {
          headers: this.getAuthHeaders(config.personalAccessToken),
        }
      );

      return response.data.value.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        url: repo.url,
        project: {
          id: repo.project.id,
          name: repo.project.name,
        },
        defaultBranch: repo.defaultBranch,
      }));
    } catch (error) {
      logger.error('Failed to get Azure DevOps repositories:', error);
      throw new Error('Failed to fetch repositories from Azure DevOps');
    }
  }

  async getPullRequests(repositoryId: string, searchCriteria?: any): Promise<AzureDevOpsPullRequest[]> {
    try {
      const config = await this.getConfig();
      const baseUrl = `https://dev.azure.com/${config.organization}`;
      
      const params = new URLSearchParams({
        'api-version': '7.0',
        'searchCriteria.status': searchCriteria?.status || 'all',
        'searchCriteria.targetRefName': searchCriteria?.targetRefName || 'refs/heads/main',
      });

      if (searchCriteria?.createdBy) {
        params.append('searchCriteria.createdBy', searchCriteria.createdBy);
      }

      if (searchCriteria?.fromDate) {
        params.append('searchCriteria.fromDate', searchCriteria.fromDate);
      }

      if (searchCriteria?.toDate) {
        params.append('searchCriteria.toDate', searchCriteria.toDate);
      }

      const response = await axios.get(
        `${baseUrl}/_apis/git/repositories/${repositoryId}/pullrequests?${params.toString()}`,
        {
          headers: this.getAuthHeaders(config.personalAccessToken),
        }
      );

      return response.data.value.map((pr: any) => ({
        id: pr.pullRequestId,
        title: pr.title,
        description: pr.description,
        status: pr.status,
        createdBy: {
          id: pr.createdBy.id,
          displayName: pr.createdBy.displayName,
          uniqueName: pr.createdBy.uniqueName,
        },
        creationDate: pr.creationDate,
        closedDate: pr.closedDate,
        mergeStatus: pr.mergeStatus,
        isDraft: pr.isDraft,
        url: pr.url,
        sourceRefName: pr.sourceRefName,
        targetRefName: pr.targetRefName,
      }));
    } catch (error) {
      logger.error('Failed to get Azure DevOps pull requests:', error);
      throw new Error('Failed to fetch pull requests from Azure DevOps');
    }
  }

  async getPullRequestDetails(repositoryId: string, pullRequestId: number): Promise<any> {
    try {
      const config = await this.getConfig();
      const baseUrl = `https://dev.azure.com/${config.organization}`;
      
      const response = await axios.get(
        `${baseUrl}/_apis/git/repositories/${repositoryId}/pullrequests/${pullRequestId}?api-version=7.0`,
        {
          headers: this.getAuthHeaders(config.personalAccessToken),
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to get Azure DevOps pull request details:', error);
      throw new Error('Failed to fetch pull request details from Azure DevOps');
    }
  }

  async getPullRequestReviews(repositoryId: string, pullRequestId: number): Promise<AzureDevOpsReview[]> {
    try {
      const config = await this.getConfig();
      const baseUrl = `https://dev.azure.com/${config.organization}`;
      
      const response = await axios.get(
        `${baseUrl}/_apis/git/repositories/${repositoryId}/pullrequests/${pullRequestId}/reviews?api-version=7.0`,
        {
          headers: this.getAuthHeaders(config.personalAccessToken),
        }
      );

      return response.data.value.map((review: any) => ({
        id: review.id,
        reviewer: {
          id: review.reviewer.id,
          displayName: review.reviewer.displayName,
          uniqueName: review.reviewer.uniqueName,
        },
        vote: review.vote,
        isContainer: review.isContainer,
        createdDate: review.createdDate,
        updatedDate: review.updatedDate,
      }));
    } catch (error) {
      logger.error('Failed to get Azure DevOps pull request reviews:', error);
      throw new Error('Failed to fetch pull request reviews from Azure DevOps');
    }
  }

  async getCommits(repositoryId: string, searchCriteria?: any): Promise<AzureDevOpsCommit[]> {
    try {
      const config = await this.getConfig();
      const baseUrl = `https://dev.azure.com/${config.organization}`;
      
      const params = new URLSearchParams({
        'api-version': '7.0',
      });

      if (searchCriteria?.fromDate) {
        params.append('fromDate', searchCriteria.fromDate);
      }

      if (searchCriteria?.toDate) {
        params.append('toDate', searchCriteria.toDate);
      }

      if (searchCriteria?.author) {
        params.append('author', searchCriteria.author);
      }

      const response = await axios.get(
        `${baseUrl}/_apis/git/repositories/${repositoryId}/commits?${params.toString()}`,
        {
          headers: this.getAuthHeaders(config.personalAccessToken),
        }
      );

      return response.data.value.map((commit: any) => ({
        commitId: commit.commitId,
        author: {
          name: commit.author.name,
          email: commit.author.email,
          date: commit.author.date,
        },
        committer: {
          name: commit.committer.name,
          email: commit.committer.email,
          date: commit.committer.date,
        },
        comment: commit.comment,
        url: commit.url,
      }));
    } catch (error) {
      logger.error('Failed to get Azure DevOps commits:', error);
      throw new Error('Failed to fetch commits from Azure DevOps');
    }
  }

  async getRepositoryStats(repositoryId: string): Promise<any> {
    try {
      const config = await this.getConfig();
      const baseUrl = `https://dev.azure.com/${config.organization}`;
      
      const response = await axios.get(
        `${baseUrl}/_apis/git/repositories/${repositoryId}/stats?api-version=7.0`,
        {
          headers: this.getAuthHeaders(config.personalAccessToken),
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to get Azure DevOps repository stats:', error);
      throw new Error('Failed to fetch repository stats from Azure DevOps');
    }
  }
}
