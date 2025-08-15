// @ts-nocheck
import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';
import { getCachedData, setCachedData, cacheKeys } from '@/config/redis';
import { KpiFilters, PaginationParams, PaginatedResponse } from '@/types';

export class KpiService {
  async getPrReviewComments(filters: any): Promise<any> {
    const cacheKey = cacheKeys.kpis(`pr-review-comments-${JSON.stringify(filters)}`);
    const cached = await getCachedData(cacheKey);
    if (cached) return cached;

    // First, get developers that match the filters (including role filter)
    const developerWhere = this.buildDeveloperWhereClause(filters);
    const developers = await prisma.developer.findMany({
      where: developerWhere,
      select: { 
        id: true, 
        name: true, 
        login: true, 
        team: { select: { name: true } },
        role: { select: { name: true } }
      },
    });

    // If no developers match the filter, return empty result
    if (developers.length === 0) {
      await setCachedData(cacheKey, [], 300);
      return [];
    }

    const developerIds = developers.map(d => d.id);
    const where = this.buildWhereClause(filters);

    // Get PRs only for the filtered developers
    const prData = await prisma.pullRequest.groupBy({
      by: ['createdById'],
      where: {
        ...where,
        createdById: { in: developerIds }
      },
      _count: {
        id: true,
      },
    });

    // Get reviews count with pull request creator info
    const reviewData = await prisma.review.groupBy({
      by: ['pullRequestId'],
      where: {
        pullRequest: {
          ...where,
          createdById: { in: developerIds }
        },
      },
      _count: {
        id: true,
      },
    });

    // Get comments count with pull request creator info
    const commentData = await prisma.comment.groupBy({
      by: ['pullRequestId'],
      where: {
        pullRequest: {
          ...where,
          createdById: { in: developerIds }
        },
      },
      _count: {
        id: true,
      },
    });

    // Get all PRs for the filtered developers to map IDs to creators
    const allPRs = await prisma.pullRequest.findMany({
      where: {
        ...where,
        createdById: { in: developerIds }
      },
      select: {
        id: true,
        createdById: true
      }
    });

    // Create a map of PR ID to creator ID
    const prToCreatorMap = new Map();
    allPRs.forEach(pr => prToCreatorMap.set(pr.id, pr.createdById));

    // Calculate average PRs across all developers
    const totalPRs = prData.reduce((sum: number, item: any) => sum + item._count.id, 0);
    const averagePRs = developers.length > 0 ? Math.round(totalPRs / developers.length) : 0;

    const result = prData.map((item: any) => {
      const developer = developers.find((d: any) => d.id === item.createdById);
      
      // Count reviews for PRs created by this developer
      const reviews = reviewData
        .filter((r: any) => prToCreatorMap.get(r.pullRequestId) === item.createdById)
        .reduce((sum: number, r: any) => sum + r._count.id, 0);
      
      // Count comments for PRs created by this developer
      const comments = commentData
        .filter((c: any) => prToCreatorMap.get(c.pullRequestId) === item.createdById)
        .reduce((sum: number, c: any) => sum + c._count.id, 0);
      
      return {
        developer,
        pullRequests: item._count.id,
        reviews,
        comments,
        averagePRs: averagePRs,
      };
    }).filter(item => item.developer); // Only include items with valid developers

    await setCachedData(cacheKey, result, 300); // 5 minutes cache
    return result;
  }

  async getPrCommit(filters: any): Promise<any> {
    const where = this.buildWhereClause(filters);

    // Get PRs grouped by team
    const prData = await prisma.pullRequest.groupBy({
      by: ['createdById'],
      where,
      _count: {
        id: true,
      },
    });

    // Get commits that match the same filters as PRs
    // Since commits don't have direct PR relationship, we filter by repository and date range
    const commitData = await prisma.commit.groupBy({
      by: ['authorId'],
      where: this.buildWhereClause(filters, 'commit'),
      _count: {
        id: true,
      },
    });

    // Get developer data with team information
    const developerIds = [...new Set([
      ...prData.map((item: any) => item.createdById),
      ...commitData.map((item: any) => item.authorId)
    ])];
    
    const developers = await prisma.developer.findMany({
      where: { 
        id: { in: developerIds }
      },
      select: { 
        id: true, 
        name: true, 
        login: true, 
        team: { select: { name: true } },
        role: { select: { name: true } }
      },
    });

    // Get all teams that match the filter
    const developerWhere = this.buildDeveloperWhereClause(filters);
    const allTeams = await prisma.team.findMany({
      where: {
        developers: {
          some: {
            ...developerWhere
          }
        }
      },
      select: {
        id: true,
        name: true
      }
    });

    // Group by team
    const teamData = new Map();

    // Initialize all teams with zero values
    allTeams.forEach(team => {
      teamData.set(team.name, { team: { name: team.name }, pullRequests: 0, commits: 0 });
    });

    // Only include "Sem time informado" if no specific filters
    const hasSpecificFilter = (
      (filters.teamId && filters.teamId !== 'all') ||
      (filters.roleId && filters.roleId !== 'all') ||
      (filters.stackId && filters.stackId !== 'all') ||
      (filters.developerId && filters.developerId !== 'all')
    );
    if (!hasSpecificFilter) {
      teamData.set('Sem time informado', { team: { name: 'Sem time informado' }, pullRequests: 0, commits: 0 });
    }

    // Process PR data
    prData.forEach((item: any) => {
      const developer = developers.find((d: any) => d.id === item.createdById);
      if (developer) {
        const teamName = developer.team?.name || 'Sem time informado';
        if (teamData.has(teamName)) {
          teamData.get(teamName).pullRequests += item._count.id;
        }
      }
    });

    // Process commit data
    commitData.forEach((item: any) => {
      const developer = developers.find((d: any) => d.id === item.authorId);
      if (developer) {
        const teamName = developer.team?.name || 'Sem time informado';
        if (teamData.has(teamName)) {
          teamData.get(teamName).commits += item._count.id;
        }
      }
    });

    // Convert to array, filter out teams with zero data, and calculate ratio
    const result = Array.from(teamData.values())
      .filter(item => item.pullRequests > 0 || item.commits > 0) // Only include teams with PRs or commits
      .map(item => ({
        ...item,
        ratio: item.pullRequests > 0 ? (item.commits / item.pullRequests).toFixed(2) : 0,
        idealRatio: 1.0
      }));

    return result;
  }

  async getPrReviewByTeam(filters: any): Promise<any> {
    const where = this.buildWhereClause(filters);

    // Get PR data grouped by creator
    const prData = await prisma.pullRequest.groupBy({
      by: ['createdById'],
      where,
      _count: {
        id: true,
      },
    });

    // Get review data for PRs that match the filters
    // Reviews are children of PRs, so we filter by PR first, then get all reviews for those PRs
    const reviewData = await prisma.review.groupBy({
      by: ['reviewerId'],
      where: {
        pullRequest: where // Use the same filters as PRs
      },
      _count: {
        id: true,
      },
    });

    // Get developer data with team information
    const developerIds = [...new Set([
      ...prData.map((item: any) => item.createdById),
      ...reviewData.map((item: any) => item.reviewerId)
    ])];
    
    const developers = await prisma.developer.findMany({
      where: { 
        id: { in: developerIds }
      },
      select: { 
        id: true, 
        name: true, 
        login: true, 
        team: { select: { name: true } },
        role: { select: { name: true } }
      },
    });

    // Get all teams that match the filter
    const developerWhere = this.buildDeveloperWhereClause(filters);
    const allTeams = await prisma.team.findMany({
      where: {
        developers: {
          some: {
            ...developerWhere
          }
        }
      },
      select: {
        id: true,
        name: true
      }
    });

    // Group by team
    const teamData = new Map();

    // Initialize all teams with zero values
    allTeams.forEach(team => {
      teamData.set(team.name, { team: { name: team.name }, pullRequests: 0, reviews: 0 });
    });

    // Only include "Sem time informado" if no specific filters
    const hasSpecificFilter = (
      (filters.teamId && filters.teamId !== 'all') ||
      (filters.roleId && filters.roleId !== 'all') ||
      (filters.stackId && filters.stackId !== 'all') ||
      (filters.developerId && filters.developerId !== 'all')
    );
    if (!hasSpecificFilter) {
      teamData.set('Sem time informado', { team: { name: 'Sem time informado' }, pullRequests: 0, reviews: 0 });
    }

    // Process PR data
    prData.forEach((item: any) => {
      const developer = developers.find((d: any) => d.id === item.createdById);
      if (developer) {
        const teamName = developer.team?.name || 'Sem time informado';
        if (teamData.has(teamName)) {
          teamData.get(teamName).pullRequests += item._count.id;
        }
      }
    });

    // Process review data
    // We need to get the PR creator for each review to group by team
    const reviewPRs = await prisma.review.findMany({
      where: {
        pullRequest: where
      },
      select: {
        id: true,
        pullRequest: {
          select: {
            createdById: true
          }
        }
      }
    });

    // Group reviews by PR creator's team
    reviewPRs.forEach((review: any) => {
      const prCreatorId = review.pullRequest.createdById;
      const developer = developers.find((d: any) => d.id === prCreatorId);
      if (developer) {
        const teamName = developer.team?.name || 'Sem time informado';
        if (teamData.has(teamName)) {
          teamData.get(teamName).reviews += 1;
        }
      }
    });

    // Convert to array, filter out teams with zero data, and calculate ratio
    const result = Array.from(teamData.values())
      .filter(item => item.pullRequests > 0 || item.reviews > 0) // Only include teams with PRs or reviews
      .map(item => ({
        ...item,
        ratio: item.pullRequests > 0 ? (item.reviews / item.pullRequests).toFixed(2) : 0,
        idealRatio: 1.0
      }));

    return result;
  }

  async getReviewsPerformedByTeam(filters: any): Promise<any> {
    const where = this.buildWhereClause(filters);

    // Get reviews for PRs that match the filters
    // We need to get the PR creator for each review to group by team
    const reviewPRs = await prisma.review.findMany({
      where: {
        pullRequest: where // Reviews of PRs that match the filters
      },
      select: {
        id: true,
        pullRequest: {
          select: {
            createdById: true
          }
        }
      }
    });

    // Get developer data with team information
    const developerIds = [...new Set(reviewPRs.map((item: any) => item.pullRequest.createdById))];
    
    const developers = await prisma.developer.findMany({
      where: { 
        id: { in: developerIds }
      },
      select: { 
        id: true, 
        name: true, 
        login: true, 
        team: { select: { name: true } },
        role: { select: { name: true } }
      },
    });

    // Get all teams that match the filter
    const developerWhere = this.buildDeveloperWhereClause(filters);
    const allTeams = await prisma.team.findMany({
      where: {
        developers: {
          some: {
            ...developerWhere
          }
        }
      },
      select: {
        id: true,
        name: true
      }
    });

    // Group by team
    const teamData = new Map();

    // Initialize all teams with zero values
    allTeams.forEach(team => {
      teamData.set(team.name, { team: { name: team.name }, reviews: 0 });
    });

    // Only include "Sem time informado" if no specific filters
    const hasSpecificFilter = (
      (filters.teamId && filters.teamId !== 'all') ||
      (filters.roleId && filters.roleId !== 'all') ||
      (filters.stackId && filters.stackId !== 'all') ||
      (filters.developerId && filters.developerId !== 'all')
    );
    if (!hasSpecificFilter) {
      teamData.set('Sem time informado', { team: { name: 'Sem time informado' }, reviews: 0 });
    }

    // Process review data
    // Group reviews by PR creator's team
    reviewPRs.forEach((review: any) => {
      const prCreatorId = review.pullRequest.createdById;
      const developer = developers.find((d: any) => d.id === prCreatorId);
      if (developer) {
        const teamName = developer.team?.name || 'Sem time informado';
        if (teamData.has(teamName)) {
          teamData.get(teamName).reviews += 1;
        }
      }
    });

    // Convert to array and filter out teams with zero data
    const result = Array.from(teamData.values())
      .filter(item => item.reviews > 0) // Only include teams with reviews
      .map(item => ({
        team: item.team,
        count: item.reviews
      }));

    return result;
  }

  async getPrReview(filters: any): Promise<any> {
    const where = this.buildWhereClause(filters);

    const data = await prisma.pullRequest.groupBy({
      by: ['createdById'],
      where,
      _count: {
        id: true,
      },
    });

    // Get developer data separately
    const developerIds = [...new Set(data.map((item: any) => item.createdById))];
    const developerWhere = this.buildDeveloperWhereClause(filters);
    const developers = await prisma.developer.findMany({
      where: { 
        id: { in: developerIds },
        ...developerWhere
      },
      select: { 
        id: true, 
        name: true, 
        login: true, 
        team: { select: { name: true } },
        role: { select: { name: true } }
      },
    });

    return data.map(item => {
      const developer = developers.find((d: any) => d.id === item.createdById);
      return {
        developer,
        pullRequests: item._count?.id || 0,
        reviews: 0, // Placeholder - will be calculated when review data is available
      };
    });
  }

  async getReviewsPerformed(filters: any): Promise<any> {
    // First, get developers that match the filters (including role filter)
    const developerWhere = this.buildDeveloperWhereClause(filters);
    const developers = await prisma.developer.findMany({
      where: developerWhere,
      select: { 
        id: true, 
        name: true, 
        login: true, 
        team: { select: { name: true } },
        role: { select: { name: true } }
      },
    });

    // If no developers match the filter, return empty result
    if (developers.length === 0) {
      return [];
    }

    const developerIds = developers.map(d => d.id);
    const where = this.buildReviewWhereClause(filters);

    const data = await prisma.review.groupBy({
      by: ['reviewerId'],
      where: {
        ...where,
        reviewerId: { in: developerIds }
      },
      _count: {
        id: true,
      },
    });

    return data.map(item => {
      const reviewer = developers.find((r: any) => r.id === item.reviewerId);
      return {
        reviewer,
        reviews: item._count?.id || 0,
      };
    }).filter(item => item.reviewer); // Only include items with valid reviewers
  }

  async getRolesByTeam(filters: any): Promise<any> {
    const where = this.buildDeveloperWhereClause(filters);

    const data = await prisma.developer.groupBy({
      by: ['teamId', 'roleId'],
      where,
      _count: {
        id: true,
      },
      include: {
        team: { select: { name: true } },
        role: { select: { name: true } },
      },
    });

    return data.map(item => ({
      team: item.team?.name || 'Unknown',
      role: item.role?.name || 'Unknown',
      count: item._count?.id || 0,
    }));
  }



  async getCycleTime(filters: any): Promise<any> {
    const where = this.buildWhereClause(filters);

    const data = await prisma.pullRequest.findMany({
      where: { ...where, cycleTimeDays: { not: null } },
      select: {
        id: true,
        title: true,
        cycleTimeDays: true,
        createdBy: { select: { name: true, team: { select: { name: true } } } },
      },
      orderBy: { cycleTimeDays: 'desc' },
    });

    return data.map(item => ({
      pullRequest: { id: item.id, title: item.title },
      author: item.createdBy,
      cycleTimeDays: item.cycleTimeDays,
    }));
  }

  async getTimeToFirstReview(filters: any): Promise<any> {
    const where = this.buildWhereClause(filters);

    const data = await prisma.pullRequest.findMany({
      select: {
        id: true,
        title: true,
        createdAt: true,
        createdBy: { select: { name: true, team: { select: { name: true } } } },
      },
    });

    return data.map(item => {
      return {
        pullRequest: { id: item.id, title: item.title },
        author: item.createdBy,
        timeToReviewDays: 0, // Placeholder - will be calculated when review data is available
      };
    });
  }

  async getTopCycleTime(filters: any, pagination: PaginationParams): Promise<PaginatedResponse<any>> {
    const where = this.buildWhereClause(filters);
    const { page = 1, pageSize = 10 } = pagination;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      prisma.pullRequest.findMany({
        where: { ...where, cycleTimeDays: { not: null } },
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          mergedAt: true,
          cycleTimeDays: true,
          createdBy: { select: { name: true, team: { select: { name: true } } } },
        },
        orderBy: { cycleTimeDays: 'desc' },
      }),
      prisma.pullRequest.count({
        where: { ...where, cycleTimeDays: { not: null } },
      }),
    ]);

    return {
      data: data.map(item => ({
        pullRequest: {
          id: item.id,
          title: item.title,
          status: item.status,
          createdAt: item.createdAt,
          mergedAt: item.mergedAt,
        },
        author: item.createdBy,
        cycleTimeDays: item.cycleTimeDays,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page < Math.ceil(total / pageSize),
        hasPrev: page > 1,
      },
    };
  }

  async getTopTimeToReview(filters: any, pagination: PaginationParams): Promise<PaginatedResponse<any>> {
    const where = this.buildWhereClause(filters);
    const { page = 1, pageSize = 10 } = pagination;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      prisma.pullRequest.findMany({
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          createdBy: { select: { name: true, team: { select: { name: true } } } },
        },
      }),
      prisma.pullRequest.count({
      }),
    ]);

    return {
      data: data.map(item => {
        return {
          pullRequest: {
            id: item.id,
            title: item.title,
            status: item.status,
            createdAt: item.createdAt,
          },
          author: item.createdBy,
          timeToReviewDays: timeToReview,
        };
      }),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page < Math.ceil(total / pageSize),
        hasPrev: page > 1,
      },
    };
  }

  async getDashboardSummary(filters: any): Promise<any> {
    const where = this.buildWhereClause(filters);

    const [
      totalPRs,
      mergedPRs,
      openPRs,
      totalCommits,
      totalReviews,
      totalComments,
      avgCycleTime,
      totalTeams,
      totalRoles,
      totalDevelopers,
      totalStacks,
      pullRequestsByStatus,
      pullRequestsByTeam,
      rolesByTeam,
      topDevelopers,
    ] = await Promise.all([
      prisma.pullRequest.count({ where }),
      prisma.pullRequest.count({ where: { ...where, status: 'completed' } }),
      prisma.pullRequest.count({ where: { ...where, status: 'active' } }),
      prisma.commit.count({ where: this.buildWhereClause(filters, 'commit') }),
      prisma.review.count({ where: { pullRequest: where } }),
      prisma.comment.count({ where: { pullRequest: where } }),
      prisma.pullRequest.aggregate({
        where: { ...where, cycleTimeDays: { not: null } },
        _avg: { cycleTimeDays: true },
      }),
      // Total de Times (filtrado)
      prisma.team.count({
        where: {
          developers: {
            some: {
              pullRequests: {
                some: where
              }
            }
          }
        }
      }),
      // Total de Cargos (filtrado)
      prisma.role.count({
        where: {
          developers: {
            some: {
              pullRequests: {
                some: where
              }
            }
          }
        }
      }),
      // Total de Desenvolvedores (filtrado)
      prisma.developer.count({
        where: {
          ...this.buildDeveloperWhereClause(filters),
          pullRequests: {
            some: where
          }
        }
      }),
      // Total de Stacks (filtrado)
      prisma.stack.count({
        where: {
          developers: {
            some: {
              pullRequests: {
                some: where
              }
            }
          }
        }
      }),
      // Pull Requests por Status
      prisma.pullRequest.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      // Pull Requests por Time
      prisma.pullRequest.groupBy({
        by: ['createdById'],
        where,
        _count: { id: true },
      }),
      // Cargos por Time - baseado nos PRs filtrados
      prisma.developer.groupBy({
        by: ['roleId'],
        where: {
          ...this.buildDeveloperWhereClause(filters),
          pullRequests: {
            some: where // Aplicar filtros aos PRs, não aos desenvolvedores
          }
        },
        _count: { id: true },
      }),
      // Top Developers
      prisma.developer.findMany({
        where: this.buildDeveloperWhereClause(filters),
        select: {
          id: true,
          name: true,
          login: true,
          team: { select: { name: true } },
          role: { select: { name: true } },
          _count: {
            select: {
              pullRequests: true,
              reviews: true,
            }
          }
        },
        orderBy: {
          pullRequests: { _count: 'desc' }
        },
        take: 10,
      }),
    ]);

    // Processar dados de Pull Requests por Status
    const processedPullRequestsByStatus = pullRequestsByStatus
      .filter((item: any) => item._count.id > 0) // Only include statuses with PRs
      .map((item: any) => ({
        status: item.status,
        count: item._count.id,
      }));

    // Processar dados de Pull Requests por Time
    const processedPullRequestsByTeam = await Promise.all(
      pullRequestsByTeam
        .filter((item: any) => item._count.id > 0) // Only include teams with PRs
        .map(async (item: any) => {
          const developer = await prisma.developer.findUnique({
            where: { id: item.createdById },
            select: { team: { select: { name: true } } }
          });
          return {
            team: developer?.team || { name: 'Sem Time' },
            count: item._count.id,
          };
        })
    );

    // Processar dados de Cargos por Time
    const processedRolesByTeam = await Promise.all(
      rolesByTeam
        .map(async (item: any) => {
          if (item.roleId === null) {
            return {
              name: 'Sem cargo informado',
              count: item._count.id,
            };
          }
          
          const role = await prisma.role.findUnique({
            where: { id: item.roleId },
            select: { name: true }
          });
          return {
            name: role?.name || 'Sem cargo informado',
            count: item._count.id,
          };
        })
    );

    // Filter out roles with zero developers and "Sem cargo informado" if no specific role filter
    const hasRoleFilter = filters.roleId && filters.roleId !== 'all';
    const filteredRolesByTeam = processedRolesByTeam.filter((item: any) => {
      // Always filter out roles with zero count
      if (item.count === 0) return false;
      
      // Filter out "Sem cargo informado" if there's a specific role filter
      if (hasRoleFilter && item.name === 'Sem cargo informado') return false;
      
      return true;
    });

    // Replace the array with filtered results
    processedRolesByTeam.length = 0;
    processedRolesByTeam.push(...filteredRolesByTeam);

    // Processar Top Developers
    const processedTopDevelopers = topDevelopers
      .filter((developer: any) => developer._count.pullRequests > 0) // Only include developers with PRs
      .map((developer: any) => ({
        developer: {
          id: developer.id,
          name: developer.name,
          login: developer.login,
          team: developer.team,
          role: developer.role,
        },
        pullRequests: developer._count.pullRequests,
        reviews: developer._count.reviews,
        averageCycleTime: 0, // TODO: Calcular cycle time médio por desenvolvedor
        averageReviewTime: 0, // TODO: Calcular review time médio por desenvolvedor
      }));

    return {
      totalPullRequests: totalPRs,
      totalReviews: totalReviews,
      totalComments: totalComments,
      totalCommits: totalCommits,
      totalTeams: totalTeams,
      totalRoles: totalRoles,
      totalDevelopers: totalDevelopers,
      totalStacks: totalStacks,
      averageCycleTime: Math.round((avgCycleTime._avg.cycleTimeDays || 0) * 24 * 60 * 60 * 1000), // Converter para milissegundos
      averageReviewTime: 0, // TODO: Calcular review time médio
      topDevelopers: processedTopDevelopers,
      pullRequestsByStatus: processedPullRequestsByStatus,
      pullRequestsByTeam: processedPullRequestsByTeam,
      rolesByTeam: processedRolesByTeam,
    };
  }

  private buildWhereClause(filters: any, entityType: 'pullRequest' | 'commit' | 'review' = 'pullRequest'): any {
    const where: any = {};

    if (filters.startDate && filters.endDate) {
      where.createdAt = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      };
    }

    if (filters.status && entityType === 'pullRequest') {
      where.status = filters.status;
    }

    if (filters.repositoryId) {
      where.repositoryId = filters.repositoryId;
    }

    if (filters.developerId) {
      if (entityType === 'commit') {
        where.authorId = filters.developerId;
      } else if (entityType === 'review') {
        where.reviewerId = filters.developerId;
      } else {
        where.createdById = filters.developerId;
      }
    }

    if (filters.teamId) {
      if (entityType === 'commit') {
        where.author = { teamId: filters.teamId };
      } else if (entityType === 'review') {
        where.reviewer = { teamId: filters.teamId };
      } else {
        where.createdBy = { teamId: filters.teamId };
      }
    }

    if (filters.management) {
      if (entityType === 'commit') {
        where.author = { team: { management: filters.management } };
      } else if (entityType === 'review') {
        where.reviewer = { team: { management: filters.management } };
      } else {
        where.createdBy = { team: { management: filters.management } };
      }
    }

    return where;
  }



  private buildDeveloperWhereClause(filters: any): any {
    const where: any = {};

    if (filters.developerId) {
      where.id = filters.developerId;
    }

    if (filters.teamId) {
      where.teamId = filters.teamId;
    }

    if (filters.roleId) {
      where.roleId = filters.roleId;
    }

    if (filters.stackId) {
      where.stacks = { some: { id: filters.stackId } };
    }

    return where;
  }

  private buildPrFileWhereClause(filters: any): any {
    const where: any = {};

    if (filters.startDate && filters.endDate) {
      where.pullRequest = {
        createdAt: {
          gte: new Date(filters.startDate),
          lte: new Date(filters.endDate),
        },
      };
    }

    if (filters.repositoryId) {
      where.pullRequest = { repositoryId: filters.repositoryId };
    }

    return where;
  }

  async getFilesChangedByTeam(filters: any): Promise<any> {
    const where = this.buildWhereClause(filters);

    // Get PRs with files changed data, grouped by creator
    const prData = await prisma.pullRequest.groupBy({
      by: ['createdById'],
      where: {
        ...where,
        filesChanged: { not: null } // Only PRs with files changed data
      },
      _count: {
        id: true,
      },
      _sum: {
        filesChanged: true,
      },
    });

    // Get developer data with team information
    const developerIds = prData.map((item: any) => item.createdById);
    
    const developers = await prisma.developer.findMany({
      where: { 
        id: { in: developerIds }
      },
      select: { 
        id: true, 
        name: true, 
        login: true, 
        team: { select: { name: true } },
        role: { select: { name: true } }
      },
    });

    // Get all teams that match the filter
    const developerWhere = this.buildDeveloperWhereClause(filters);
    const allTeams = await prisma.team.findMany({
      where: {
        developers: {
          some: {
            ...developerWhere
          }
        }
      },
      select: {
        id: true,
        name: true
      }
    });

    // Group by team
    const teamData = new Map();

    // Initialize all teams with zero values
    allTeams.forEach(team => {
      teamData.set(team.name, { 
        team: { name: team.name }, 
        pullRequests: 0, 
        totalFilesChanged: 0,
        averageFilesChanged: 0
      });
    });

    // Only include "Sem time informado" if no specific filters
    const hasSpecificFilter = (
      (filters.teamId && filters.teamId !== 'all') ||
      (filters.roleId && filters.roleId !== 'all') ||
      (filters.stackId && filters.stackId !== 'all') ||
      (filters.developerId && filters.developerId !== 'all')
    );
    if (!hasSpecificFilter) {
      teamData.set('Sem time informado', { 
        team: { name: 'Sem time informado' }, 
        pullRequests: 0, 
        totalFilesChanged: 0,
        averageFilesChanged: 0
      });
    }

    // Process PR data
    prData.forEach((item: any) => {
      const developer = developers.find((d: any) => d.id === item.createdById);
      if (developer) {
        const teamName = developer.team?.name || 'Sem time informado';
        if (teamData.has(teamName)) {
          const teamEntry = teamData.get(teamName);
          teamEntry.pullRequests += item._count.id;
          teamEntry.totalFilesChanged += item._sum.filesChanged || 0;
        }
      }
    });

    // Calculate averages
    teamData.forEach((teamEntry) => {
      if (teamEntry.pullRequests > 0) {
        teamEntry.averageFilesChanged = Math.round(teamEntry.totalFilesChanged / teamEntry.pullRequests);
      }
    });

    // Convert to array and filter out teams with zero data
    const result = Array.from(teamData.values())
      .filter(item => item.pullRequests > 0) // Only include teams with PRs
      .map(item => ({
        team: item.team,
        pullRequests: item.pullRequests,
        totalFilesChanged: item.totalFilesChanged,
        averageFilesChanged: item.averageFilesChanged
      }));

    return result;
  }

  async getCycleTimeByTeam(filters: any): Promise<any> {
    const where = this.buildWhereClause(filters);

    // Get PRs with cycle time data, grouped by creator
    const prData = await prisma.pullRequest.groupBy({
      by: ['createdById'],
      where: {
        ...where,
        cycleTimeDays: { not: null } // Only PRs with cycle time data
      },
      _count: {
        id: true,
      },
      _avg: {
        cycleTimeDays: true,
        reviewTimeDays: true,
      },
    });

    // Get developer data with team information
    const developerIds = prData.map((item: any) => item.createdById);
    
    const developers = await prisma.developer.findMany({
      where: { 
        id: { in: developerIds }
      },
      select: { 
        id: true, 
        name: true, 
        login: true, 
        team: { select: { name: true } },
        role: { select: { name: true } }
      },
    });

    // Get all teams that match the filter
    const developerWhere = this.buildDeveloperWhereClause(filters);
    const allTeams = await prisma.team.findMany({
      where: {
        developers: {
          some: {
            ...developerWhere
          }
        }
      },
      select: {
        id: true,
        name: true
      }
    });

    // Group by team
    const teamData = new Map();

    // Initialize all teams with zero values
    allTeams.forEach(team => {
      teamData.set(team.name, { 
        team: { name: team.name }, 
        pullRequests: 0, 
        totalCycleTime: 0,
        totalReviewTime: 0,
        averageCycleTime: 0,
        averageReviewTime: 0
      });
    });

    // Only include "Sem time informado" if no specific filters
    const hasSpecificFilter = (
      (filters.teamId && filters.teamId !== 'all') ||
      (filters.roleId && filters.roleId !== 'all') ||
      (filters.stackId && filters.stackId !== 'all') ||
      (filters.developerId && filters.developerId !== 'all')
    );
    if (!hasSpecificFilter) {
      teamData.set('Sem time informado', { 
        team: { name: 'Sem time informado' }, 
        pullRequests: 0, 
        totalCycleTime: 0,
        totalReviewTime: 0,
        averageCycleTime: 0,
        averageReviewTime: 0
      });
    }

    // Process PR data
    prData.forEach((item: any) => {
      const developer = developers.find((d: any) => d.id === item.createdById);
      if (developer) {
        const teamName = developer.team?.name || 'Sem time informado';
        if (teamData.has(teamName)) {
          const teamEntry = teamData.get(teamName);
          teamEntry.pullRequests += item._count.id;
          teamEntry.totalCycleTime += (item._avg.cycleTimeDays || 0) * item._count.id;
          teamEntry.totalReviewTime += (item._avg.reviewTimeDays || 0) * item._count.id;
        }
      }
    });

    // Calculate averages
    teamData.forEach((teamEntry) => {
      if (teamEntry.pullRequests > 0) {
        teamEntry.averageCycleTime = Math.round((teamEntry.totalCycleTime / teamEntry.pullRequests) * 10) / 10; // Keep in days, round to 1 decimal
        teamEntry.averageReviewTime = Math.round((teamEntry.totalReviewTime / teamEntry.pullRequests) * 10) / 10; // Keep in days, round to 1 decimal
      }
    });

    // Convert to array and filter out teams with zero data
    const result = Array.from(teamData.values())
      .filter(item => item.pullRequests > 0) // Only include teams with PRs
      .map(item => ({
        team: item.team,
        pullRequests: item.pullRequests,
        averageCycleTime: item.averageCycleTime,
        averageReviewTime: item.averageReviewTime
      }));

    return result;
  }

  async getTopCycleTimePRs(filters: any, pagination: { page: number, pageSize: number }): Promise<any> {
    const where = this.buildWhereClause(filters);
    const { page = 1, pageSize = 10 } = pagination;
    const skip = (page - 1) * pageSize;

    // Get PRs with cycle time data, ordered by cycle time (highest first)
    const prs = await prisma.pullRequest.findMany({
      where: {
        ...where,
        cycleTimeDays: { not: null }
      },
      skip,
      take: pageSize,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        mergedAt: true,
        cycleTimeDays: true,
        reviewTimeDays: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            login: true,
            team: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        cycleTimeDays: 'desc'
      }
    });

    // Get total count for pagination
    const total = await prisma.pullRequest.count({
      where: {
        ...where,
        cycleTimeDays: { not: null }
      }
    });

    // Process data
    const result = prs.map((pr, index) => ({
      position: skip + index + 1,
      team: pr.createdBy.team?.name || 'Sem time informado',
      title: pr.title,
      status: pr.status,
      createdAt: pr.createdAt,
      mergedAt: pr.mergedAt,
      cycleTimeDays: pr.cycleTimeDays,
      reviewTimeDays: pr.reviewTimeDays,
      developer: pr.createdBy.name
    }));

    return {
      data: result,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }
}
