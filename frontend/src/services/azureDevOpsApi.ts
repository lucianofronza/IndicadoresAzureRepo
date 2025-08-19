import api from './api'

export interface Repository {
  id: string
  name: string
  url: string
  project: string
  organization: string
}

export interface PullRequest {
  id: number
  title: string
  description: string
  status: string
  createdBy: {
    displayName: string
    uniqueName: string
  }
  creationDate: string
  closedDate?: string
  mergeStatus: string
  targetRefName: string
  sourceRefName: string
  repository: {
    name: string
    project: {
      name: string
    }
  }
}

export interface Commit {
  commitId: string
  author: {
    name: string
    email: string
    date: string
  }
  comment: string
  url: string
}

export interface Review {
  id: number
  reviewer: {
    displayName: string
    uniqueName: string
  }
  vote: number
  createdDate: string
  updatedDate: string
}

export interface Project {
  id: string
  name: string
  description: string
  url: string
}

export interface Team {
  id: string
  name: string
  description: string
  url: string
}

export interface AzureConfig {
  organization: string
  personalAccessToken: string
}

class AzureDevOpsApi {
  // Validate Azure DevOps connection
  async validateConnection(config: AzureConfig): Promise<{ success: boolean; message?: string }> {
    try {
      console.log('Validating Azure DevOps connection with config:', {
        organization: config.organization,
        hasToken: !!config.personalAccessToken,
        tokenLength: config.personalAccessToken.length
      })
      
      const response = await api.post('/azure-devops/validate', config)
      
      console.log('Azure DevOps validation response:', response.data)
      
      return { success: true, message: response.data.message }
    } catch (error: any) {
      console.error('Azure DevOps validation error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      })
      
      return { 
        success: false, 
        message: error.response?.data?.message || 'Erro ao validar conexão' 
      }
    }
  }

  // Get repositories for a specific project
  async getRepositories(projectId?: string): Promise<Repository[]> {
    if (!projectId) {
      // If no projectId is provided, return empty array
      return []
    }
    const response = await api.get(`/azure-devops/projects/${projectId}/repositories`)
    return response.data.data
  }

  // Get pull requests for a repository
  async getPullRequests(repositoryId: string, top: number = 100): Promise<PullRequest[]> {
    const response = await api.get(`/azure-devops/repositories/${repositoryId}/pull-requests`, {
      params: { top }
    })
    return response.data.data
  }

  // Get commits for a repository
  async getCommits(repositoryId: string, top: number = 100): Promise<Commit[]> {
    const response = await api.get(`/azure-devops/repositories/${repositoryId}/commits`, {
      params: { top }
    })
    return response.data.data
  }

  // Get reviews for a pull request
  async getPullRequestReviews(repositoryId: string, pullRequestId: number): Promise<Review[]> {
    const response = await api.get(`/azure-devops/repositories/${repositoryId}/pullrequests/${pullRequestId}/reviews`)
    return response.data.data
  }

  // Get Azure DevOps configuration
  async getConfig(): Promise<{ organization: string }> {
    const response = await api.get('/azure-devops/config')
    return response.data.data
  }

  // Check Azure DevOps API status
  async checkStatus(): Promise<{
    isAvailable: boolean;
    rateLimitRemaining?: number;
    rateLimitReset?: string;
    lastError?: string;
    responseTime?: number;
  }> {
    const response = await api.get('/azure-devops/status')
    return response.data.data
  }

  // Get projects
  async getProjects(): Promise<Project[]> {
    const response = await api.get('/azure-devops/projects')
    return response.data.data
  }

  // Get teams for a project
  async getTeams(projectId: string): Promise<Team[]> {
    const response = await api.get(`/azure-devops/projects/${projectId}/teams`)
    return response.data.data
  }
}

export const azureDevOpsApi = new AzureDevOpsApi()
