// @ts-nocheck
import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';
import { Team, CreateTeamDto, UpdateTeamDto, PaginationParams, PaginatedResponse } from '@/types';
import { NotFoundError, ConflictError } from '@/middlewares/errorHandler';

export class TeamService {
  /**
   * Get all teams with pagination
   */
  async getAll(params: PaginationParams): Promise<PaginatedResponse<Team>> {
    const { page = 1, pageSize = 10, sortBy = 'name', sortOrder = 'asc' } = params;
    const skip = (page - 1) * pageSize;

    const [teams, total] = await Promise.all([
      prisma.team.findMany({
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              developers: true,
              repositories: true,
            },
          },
        },
      }),
      prisma.team.count(),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: teams,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get team by ID
   */
  async getById(id: string): Promise<Team> {
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        developers: {
          include: {
            role: true,
            stack: true,
            lead: true,
            manager: true,
          },
        },
        repositories: true,
        _count: {
          select: {
            developers: true,
            repositories: true,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundError('Team');
    }

    return team;
  }

  /**
   * Create new team
   */
  async create(data: CreateTeamDto): Promise<Team> {
    // Check if team name already exists
    const existingTeam = await prisma.team.findUnique({
      where: { name: data.name },
    });

    if (existingTeam) {
      throw new ConflictError('Team with this name already exists');
    }

    const team = await prisma.team.create({
      data: {
        name: data.name,
        management: data.management,
      },
      include: {
        _count: {
          select: {
            developers: true,
            repositories: true,
          },
        },
      },
    });

    logger.info({
      teamId: team.id,
      teamName: team.name,
    }, 'Team created successfully');

    return team;
  }

  /**
   * Update team
   */
  async update(id: string, data: UpdateTeamDto): Promise<Team> {
    // Check if team exists
    const existingTeam = await prisma.team.findUnique({
      where: { id },
    });

    if (!existingTeam) {
      throw new NotFoundError('Team');
    }

    // Check if new name conflicts with existing team
    if (data.name && data.name !== existingTeam.name) {
      const nameConflict = await prisma.team.findUnique({
        where: { name: data.name },
      });

      if (nameConflict) {
        throw new ConflictError('Team with this name already exists');
      }
    }

    const team = await prisma.team.update({
      where: { id },
      data: {
        name: data.name,
        management: data.management,
      },
      include: {
        _count: {
          select: {
            developers: true,
            repositories: true,
          },
        },
      },
    });

    logger.info({
      teamId: team.id,
      teamName: team.name,
    }, 'Team updated successfully');

    return team;
  }

  /**
   * Delete team
   */
  async delete(id: string): Promise<void> {
    // Check if team exists
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            developers: true,
            repositories: true,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundError('Team');
    }

    // Check if team has developers or repositories
    if (team._count.developers > 0) {
      throw new ConflictError('Cannot delete team with developers. Please reassign developers first.');
    }

    if (team._count.repositories > 0) {
      throw new ConflictError('Cannot delete team with repositories. Please reassign repositories first.');
    }

    await prisma.team.delete({
      where: { id },
    });

    logger.info({
      teamId: id,
      teamName: team.name,
    }, 'Team deleted successfully');
  }

  /**
   * Get team statistics
   */
  async getStats(id: string): Promise<any> {
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        developers: {
          include: {
            role: true,
            stack: true,
            _count: {
              select: {
                pullRequests: true,
                commits: true,
                reviews: true,
                comments: true,
              },
            },
          },
        },
        repositories: {
          include: {
            _count: {
              select: {
                pullRequests: true,
              },
            },
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundError('Team');
    }

    // Calculate statistics
    const totalDevelopers = team.developers.length;
    const totalRepositories = team.repositories.length;
    const totalPullRequests = team.repositories.reduce((sum, repo) => sum + repo._count.pullRequests, 0);
    
    const totalCommits = team.developers.reduce((sum, dev) => sum + dev._count.commits, 0);
    const totalReviews = team.developers.reduce((sum, dev) => sum + dev._count.reviews, 0);
    const totalComments = team.developers.reduce((sum, dev) => sum + dev._count.comments, 0);

    // Role distribution
    const roleDistribution = team.developers.reduce((acc, dev) => {
      const roleName = dev.role.name;
      acc[roleName] = (acc[roleName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Stack distribution
    const stackDistribution = team.developers.reduce((acc, dev) => {
      const stackName = dev.stack.name;
      acc[stackName] = (acc[stackName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      teamId: team.id,
      teamName: team.name,
      management: team.management,
      totals: {
        developers: totalDevelopers,
        repositories: totalRepositories,
        pullRequests: totalPullRequests,
        commits: totalCommits,
        reviews: totalReviews,
        comments: totalComments,
      },
      distributions: {
        roles: roleDistribution,
        stacks: stackDistribution,
      },
    };
  }

  /**
   * Get team developers with pagination
   */
  async getDevelopers(id: string, params: PaginationParams): Promise<PaginatedResponse<any>> {
    const { page = 1, pageSize = 10 } = params;
    const skip = (page - 1) * pageSize;

    const [developers, total] = await Promise.all([
      prisma.developer.findMany({
        where: { teamId: id },
        skip,
        take: pageSize,
        include: {
          role: true,
          stack: true,
          lead: {
            select: { id: true, name: true, login: true },
          },
          manager: {
            select: { id: true, name: true, login: true },
          },
          _count: {
            select: {
              pullRequests: true,
              commits: true,
              reviews: true,
              comments: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.developer.count({
        where: { teamId: id },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: developers,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get team repositories with pagination
   */
  async getRepositories(id: string, params: PaginationParams): Promise<PaginatedResponse<any>> {
    const { page = 1, pageSize = 10 } = params;
    const skip = (page - 1) * pageSize;

    const [repositories, total] = await Promise.all([
      prisma.repository.findMany({
        where: { teamId: id },
        skip,
        take: pageSize,
        include: {
          _count: {
            select: {
              pullRequests: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.repository.count({
        where: { teamId: id },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: repositories,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }
}
