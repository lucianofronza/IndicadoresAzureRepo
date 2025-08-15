// Base types
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Team types
export interface Team extends BaseEntity {
  name: string;
  management: string | null;
  developers?: Developer[];
  repositories?: Repository[];
}

export interface CreateTeamDto {
  name: string;
  management?: string;
}

export interface UpdateTeamDto {
  name?: string;
  management?: string;
}

// Role types
export interface Role extends BaseEntity {
  name: string;
  developers?: Developer[];
}

export interface CreateRoleDto {
  name: string;
}

export interface UpdateRoleDto {
  name?: string;
}

// Stack types
export interface Stack extends BaseEntity {
  name: string;
  color: string;
  developers?: Developer[];
}

export interface CreateStackDto {
  name: string;
  color?: string;
}

export interface UpdateStackDto {
  name?: string;
  color?: string;
}

// Developer types
export interface Developer extends BaseEntity {
  name: string;
  login: string;
  teamId: string;
  roleId: string;
  stackId: string;
  leadId: string | null;
  managerId: string | null;
  team?: Team;
  role?: Role;
  stack?: Stack;
  lead?: Developer;
  manager?: Developer;
  teamMembers?: Developer[];
  managedDevelopers?: Developer[];
  pullRequests?: PullRequest[];
  commits?: Commit[];
  reviews?: Review[];
  comments?: Comment[];
}

export interface CreateDeveloperDto {
  name: string;
  email?: string;
  login: string;
  teamId: string;
  roleId: string;
  stackIds?: string[];
  leadId?: string;
  managerId?: string;
}

export interface UpdateDeveloperDto {
  name?: string;
  email?: string;
  login?: string;
  teamId?: string;
  roleId?: string;
  stackIds?: string[];
  leadId?: string;
  managerId?: string;
}

// Repository types
export interface Repository extends BaseEntity {
  name: string;
  organization: string;
  project: string;
  url: string;
  lastSyncAt?: Date;
  teamId: string | null;
  team?: Team;
  pullRequests?: PullRequest[];
}

export interface CreateRepositoryDto {
  name: string;
  organization: string;
  project: string;
  url: string;
  azureId?: string;
  clientId: string;
  clientSecret: string;
  teamId?: string;
}

export interface UpdateRepositoryDto {
  name?: string;
  organization?: string;
  project?: string;
  url?: string;
  azureId?: string;
  clientId?: string;
  clientSecret?: string;
  teamId?: string;
}

// Azure Repos types
export interface PullRequest extends BaseEntity {
  repositoryId: string;
  externalId: string;
  title: string;
  status: string;
  authorDevId: string;
  createdAt: Date;
  firstReviewAt?: Date;
  mergedAt?: Date;
  closedAt?: Date;
  updatedAt: Date;
  cycleTimeDays?: number;
  reviewQueueDays?: number;
  syncedAt: Date;
  repository?: Repository;
  author?: Developer;
  commits?: Commit[];
  reviews?: Review[];
  comments?: Comment[];
  filesChanged?: PrFileChanged[];
}

export interface Commit extends BaseEntity {
  pullRequestId: string;
  externalId: string;
  authorDevId: string;
  committedAt: Date;
  syncedAt: Date;
  pullRequest?: PullRequest;
  author?: Developer;
}

export interface Review extends BaseEntity {
  pullRequestId: string;
  reviewerDevId: string;
  state: string;
  submittedAt: Date;
  syncedAt: Date;
  pullRequest?: PullRequest;
  reviewer?: Developer;
}

export interface Comment extends BaseEntity {
  pullRequestId: string;
  authorDevId: string;
  body: string;
  createdAt: Date;
  syncedAt: Date;
  pullRequest?: PullRequest;
  author?: Developer;
}

export interface PrFileChanged extends BaseEntity {
  pullRequestId: string;
  filePath: string;
  additions: number;
  deletions: number;
  changes: number;
  syncedAt: Date;
  pullRequest?: PullRequest;
}

// Sync types
export interface SyncJob extends BaseEntity {
  repositoryId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  syncType: 'full' | 'incremental';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface CreateSyncJobDto {
  repositoryId: string;
}

// Azure DevOps API types
export interface AzurePullRequest {
  id: number;
  title: string;
  status: string;
  createdBy: {
    displayName: string;
    uniqueName: string;
  };
  creationDate: string;
  closedDate?: string;
  closedBy?: {
    displayName: string;
    uniqueName: string;
  };
  reviewers: Array<{
    displayName: string;
    uniqueName: string;
    vote: number;
    votedDate?: string;
  }>;
  commits: Array<{
    commitId: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  }>;
  comments: Array<{
    id: number;
    content: string;
    author: {
      displayName: string;
      uniqueName: string;
    };
    publishedDate: string;
  }>;
  changes: Array<{
    changeId: number;
    item: {
      path: string;
    };
    changeType: string;
  }>;
}

export interface AzureTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

// Filter types
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface KpiFilters {
  dateRange?: DateRange;
  management?: string;
  teamId?: string;
  leadId?: string;
  status?: string;
  stackId?: string;
  roleId?: string;
  developerId?: string;
  repositoryId?: string;
}

// Pagination types
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: PaginatedResponse<T>['pagination'];
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  code?: string;
  details?: any;
}

// Health check types
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
    };
    redis: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
    };
  };
}

// Metrics types
export interface MetricsResponse {
  metrics: string;
}

// Auth types
export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  userId: string;
}

export interface AzureAuthCallback {
  code: string;
  state?: string;
}

// Request types
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    login: string;
    name: string;
  };
  requestId?: string;
  log?: any;
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
