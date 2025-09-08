import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';
import { Developer, CreateDeveloperDto, UpdateDeveloperDto, PaginationParams, PaginatedResponse } from '@/types';
import { NotFoundError, ConflictError } from '@/middlewares/errorHandler';

export class DeveloperService {
  async getAll(params: PaginationParams & { search?: string; teamId?: string; roleId?: string; stackId?: string }): Promise<PaginatedResponse<Developer>> {
    const { page = 1, pageSize = 10, sortBy = 'name', sortOrder = 'asc', search, teamId, roleId, stackId } = params;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { login: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (teamId) {
      // Handle multiple team IDs separated by comma
      if (teamId.includes(',')) {
        const teamIds = teamId.split(',').filter(id => id.trim() !== '');
        where.teamId = { in: teamIds };
      } else {
        where.teamId = teamId;
      }
    }
    
    if (roleId) {
      where.roleId = roleId;
    }
    
    if (stackId) {
      where.stacks = {
        some: {
          id: stackId
        }
      };
    }

          const [developers, total] = await Promise.all([
        prisma.developer.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
          include: {
            team: true,
            role: true,
            stacks: true,
            _count: {
              select: {
                pullRequests: true,
                commits: true,
                reviews: true,
                comments: true,
              },
            },
          },
        }),
        prisma.developer.count({ where }),
      ]);

    return {
      data: developers as any,
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

  async getById(id: string): Promise<Developer> {
    const developer = await prisma.developer.findUnique({
      where: { id },
      include: {
        team: true,
        role: true,
        stacks: true,
        _count: {
          select: {
            pullRequests: true,
            commits: true,
            reviews: true,
            comments: true,
          },
        },
      },
    });

    if (!developer) throw new NotFoundError('Developer');
    return developer as any;
  }

  async create(data: CreateDeveloperDto): Promise<Developer> {
    const existing = await prisma.developer.findUnique({ where: { login: data.login } });
    if (existing) throw new ConflictError('Developer with this login already exists');

    const developer = await prisma.developer.create({
      data: {
        name: data.name,
        email: data.email || `${data.login}@company.com`, // Default email if not provided
        login: data.login,
        teamId: data.teamId,
        roleId: data.roleId,
        stacks: data.stackIds ? {
          connect: data.stackIds.map(id => ({ id }))
        } : undefined,
      },
              include: {
          team: true,
          role: true,
          stacks: true,
          _count: {
            select: {
              pullRequests: true,
              commits: true,
              reviews: true,
              comments: true,
            },
          },
        },
    });

    logger.info({ developerId: developer.id, developerName: developer.name }, 'Developer created successfully');
    return developer as any;
  }

  async update(id: string, data: UpdateDeveloperDto): Promise<Developer> {
    const existing = await prisma.developer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Developer');

    if (data.login && data.login !== existing.login) {
      const conflict = await prisma.developer.findUnique({ where: { login: data.login } });
      if (conflict) throw new ConflictError('Developer with this login already exists');
    }

    const developer = await prisma.developer.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        login: data.login,
        teamId: data.teamId,
        roleId: data.roleId,
        stacks: data.stackIds !== undefined ? {
          set: data.stackIds.map(id => ({ id }))
        } : undefined,
      },
              include: {
          team: true,
          role: true,
          stacks: true,
          _count: {
            select: {
              pullRequests: true,
              commits: true,
              reviews: true,
              comments: true,
            },
          },
        },
    });

    logger.info({ developerId: developer.id, developerName: developer.name }, 'Developer updated successfully');
    return developer as any;
  }

  async delete(id: string): Promise<void> {
    const developer = await prisma.developer.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            pullRequests: true,
            commits: true,
            reviews: true,
            comments: true,
          },
        },
      },
    });

    if (!developer) throw new NotFoundError('Developer');

    await prisma.developer.delete({ where: { id } });
    logger.info({ developerId: id, developerName: developer.name }, 'Developer deleted successfully');
  }

  async getStats(id: string): Promise<any> {
    const developer = await prisma.developer.findUnique({
      where: { id },
      include: {
        team: true,
        role: true,
        stacks: true,
        pullRequests: {
          include: {
            repository: true,
          },
        },
        commits: {
          include: {
            repository: true,
          },
        },
        reviews: {
          include: {
            pullRequest: {
              include: { repository: true },
            },
          },
        },
        comments: {
          include: {
            pullRequest: {
              include: { repository: true },
            },
          },
        },
      },
    });

    if (!developer) throw new NotFoundError('Developer');

    // Calculate statistics
    const totalPRs = developer.pullRequests.length;
    const totalCommits = developer.commits.length;
    const totalReviews = developer.reviews.length;
    const totalComments = developer.comments.length;

    const mergedPRs = developer.pullRequests.filter(pr => pr.status === 'completed').length;
    const openPRs = developer.pullRequests.filter(pr => pr.status === 'active').length;

    const avgCycleTime = Math.round(developer.pullRequests
      .filter(pr => pr.cycleTimeDays)
      .reduce((sum, pr) => sum + (pr.cycleTimeDays || 0), 0) / 
      developer.pullRequests.filter(pr => pr.cycleTimeDays).length || 0);

    return {
      developerId: developer.id,
      developerName: developer.name,
      team: developer.team?.name || 'N/A',
      role: developer.role?.name || 'N/A',
      stacks: developer.stacks?.map(s => s.name).join(', ') || 'N/A',
      totals: {
        pullRequests: totalPRs,
        commits: totalCommits,
        reviews: totalReviews,
        comments: totalComments,
        mergedPRs,
        openPRs,
      },
      averages: {
        cycleTimeDays: avgCycleTime,
      },
    };
  }

}
