// Base types
export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
}

// Team types
export interface Team extends BaseEntity {
  name: string
  management?: string
  developers?: Developer[]
  repositories?: Repository[]
}

// Role types
export interface Role extends BaseEntity {
  name: string
  developers?: Developer[]
  _count?: {
    developers?: number
  }
}

// Stack types
export interface Stack extends BaseEntity {
  name: string
  color: string
  developers?: Developer[]
  _count?: {
    developers?: number
  }
}

// Developer types
export interface Developer extends BaseEntity {
  name: string
  email?: string
  login: string
  teamId?: string
  roleId?: string
  team?: Team
  role?: Role
  stacks?: Stack[]
  _count?: {
    pullRequests?: number
    reviews?: number
    commits?: number
    comments?: number
  }
}

// Repository types
export interface Repository extends BaseEntity {
  name: string
  organization: string
  project: string
  url: string
  teamId?: string
  team?: Team
  _count?: {
    pullRequests?: number
    commits?: number
    reviews?: number
    comments?: number
  }
}

// Pull Request types
export interface PullRequest extends BaseEntity {
  repositoryId: string
  externalId: string
  title: string
  status: string
  authorDevId: string
  createdAt: string
  firstReviewAt?: string
  mergedAt?: string
  closedAt?: string
  updatedAt: string
  cycleTimeDays?: number
  reviewQueueDays?: number
  syncedAt: string
  repository?: Repository
  author?: Developer
  commits?: Commit[]
  reviews?: Review[]
  comments?: Comment[]
  filesChanged?: PrFileChanged[]
}

// Commit types
export interface Commit extends BaseEntity {
  pullRequestId: string
  externalId: string
  authorDevId: string
  committedAt: string
  syncedAt: string
  pullRequest?: PullRequest
  author?: Developer
}

// Review types
export interface Review extends BaseEntity {
  pullRequestId: string
  reviewerDevId: string
  state: string
  submittedAt: string
  syncedAt: string
  pullRequest?: PullRequest
  reviewer?: Developer
}

// Comment types
export interface Comment extends BaseEntity {
  pullRequestId: string
  authorDevId: string
  body: string
  createdAt: string
  syncedAt: string
  pullRequest?: PullRequest
  author?: Developer
}

// File Changed types
export interface PrFileChanged extends BaseEntity {
  pullRequestId: string
  filePath: string
  additions: number
  deletions: number
  changes: number
  syncedAt: string
  pullRequest?: PullRequest
}

// Sync Job types
export interface SyncJob extends BaseEntity {
  repositoryId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt?: string
  completedAt?: string
  error?: string
}

// KPI types
export interface KPI {
  totalPullRequests: number
  totalReviews: number
  totalComments: number
  totalCommits: number
  totalTeams: number
  totalRoles: number
  totalDevelopers: number
  totalStacks: number
  averageCycleTime: number
  averageReviewTime: number
  topDevelopers: Array<{
    developer: Developer
    pullRequests: number
    reviews: number
    averageCycleTime?: number
    averageReviewTime?: number
  }>
  pullRequestsByStatus: Array<{
    status: string
    count: number
  }>
  pullRequestsByTeam: Array<{
    team: Team
    count: number
  }>
  rolesByTeam?: Array<{
    name: string
    count: number
  }>
}

// Auth types
export interface User {
  id: string
  name: string
  email: string
  avatarUrl?: string
}

export interface AuthResponse {
  user: User
  token: string
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Filter types
export interface DashboardFilters {
  startDate?: string
  endDate?: string
  teamId?: string
  roleId?: string
  developerId?: string
  stackId?: string
  status?: string
}

// Form types
export interface CreateTeamData {
  name: string
  management?: string
}

export interface CreateRoleData {
  name: string
}

export interface UpdateRoleData {
  name?: string
}

export interface CreateStackData {
  name: string
  color?: string
}

export interface UpdateStackData {
  name?: string
  color?: string
}

export interface CreateDeveloperData {
  name: string
  email?: string
  login: string
  teamId: string
  roleId: string
  stackIds?: string[]
}

export interface UpdateDeveloperData {
  name?: string
  email?: string
  login?: string
  teamId?: string
  roleId?: string
  stackIds?: string[]
}

export interface CreateRepositoryData {
  name: string
  organization: string
  project: string
  url: string
  azureId?: string
  teamId?: string
}

export interface UpdateRepositoryData {
  name?: string
  organization?: string
  project?: string
  url?: string
  azureId?: string
  teamId?: string
}
