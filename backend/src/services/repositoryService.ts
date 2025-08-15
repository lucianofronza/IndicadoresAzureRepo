// @ts-nocheck
import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';
import { Repository, CreateRepositoryDto, UpdateRepositoryDto, PaginationParams, PaginatedResponse } from '@/types';
import { NotFoundError, ConflictError } from '@/middlewares/errorHandler';
import bcrypt from 'bcryptjs';

export class RepositoryService {
  async getAll(params: PaginationParams): Promise<PaginatedResponse<Repository>> {
    const { page = 1, pageSize = 10, sortBy = 'name', sortOrder = 'asc' } = params;
    const skip = (page - 1) * pageSize;

    const [repositories, total] = await Promise.all([
      prisma.repository.findMany({
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
        include: {
          team: true,
          _count: {
            select: { pullRequests: true },
          },
        },
      }),
      prisma.repository.count(),
    ]);

    return {
      data: repositories as Repository[],
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

  async getById(id: string): Promise<Repository> {
    const repository = await prisma.repository.findUnique({
      where: { id },
      include: {
        team: true,
        pullRequests: {
          include: {
            createdBy: { select: { id: true, name: true, login: true } },
            reviews: true,
            comments: true,
          },
        },
        _count: {
          select: { pullRequests: true },
        },
      },
    });

    if (!repository) throw new NotFoundError('Repository');
    return repository as Repository;
  }

  async create(data: CreateRepositoryDto): Promise<Repository> {
    // Prepare data, handling empty teamId
    const repositoryData: any = {
      name: data.name,
      organization: data.organization,
      project: data.project,
      url: data.url,
      azureId: data.azureId,
    };

    // Only include teamId if it's not empty
    if (data.teamId && data.teamId.trim() !== '') {
      repositoryData.teamId = data.teamId;
    }

    const repository = await prisma.repository.create({
      data: repositoryData,
      include: {
        team: true,
        _count: {
          select: { pullRequests: true },
        },
      },
    });

    logger.info({ repositoryId: repository.id, repositoryName: repository.name }, 'Repository created successfully');
    return repository as Repository;
  }

  async update(id: string, data: UpdateRepositoryDto): Promise<Repository> {
    const existing = await prisma.repository.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Repository');

    const updateData: any = {
      name: data.name,
      organization: data.organization,
      project: data.project,
      url: data.url,
      azureId: data.azureId,
    };

    // Only include teamId if it's not empty
    if (data.teamId && data.teamId.trim() !== '') {
      updateData.teamId = data.teamId;
    } else {
      updateData.teamId = null; // Set to null if empty
    }



    const repository = await prisma.repository.update({
      where: { id },
      data: updateData,
      include: {
        team: true,
        _count: {
          select: { pullRequests: true },
        },
      },
    });

    logger.info({ repositoryId: repository.id, repositoryName: repository.name }, 'Repository updated successfully');
    return repository;
  }

  async delete(id: string): Promise<void> {
    const repository = await prisma.repository.findUnique({
      where: { id },
      include: {
        _count: {
          select: { pullRequests: true },
        },
      },
    });

    if (!repository) throw new NotFoundError('Repository');

    await prisma.repository.delete({ where: { id } });
    logger.info({ repositoryId: id, repositoryName: repository.name }, 'Repository deleted successfully');
  }

  async getStats(id: string): Promise<any> {
    const repository = await prisma.repository.findUnique({
      where: { id },
      include: {
        team: true,
        pullRequests: {
          include: {
            createdBy: { select: { id: true, name: true, login: true } },
            reviews: true,
            comments: true,
          },
        },
      },
    });

    if (!repository) throw new NotFoundError('Repository');

    const totalPRs = repository.pullRequests.length;
    const mergedPRs = repository.pullRequests.filter((pr: any) => pr.status === 'completed').length;
    const openPRs = repository.pullRequests.filter((pr: any) => pr.status === 'active').length;

    const totalCommits = await prisma.commit.count({ where: { repositoryId: repository.id } });
    const totalReviews = await prisma.review.count({ 
      where: { pullRequest: { repositoryId: repository.id } } 
    });
    const totalComments = await prisma.comment.count({ 
      where: { pullRequest: { repositoryId: repository.id } } 
    });

    const avgCycleTime = Math.round(repository.pullRequests
      .filter((pr: any) => pr.cycleTimeDays)
      .reduce((sum: number, pr: any) => sum + (pr.cycleTimeDays || 0), 0) / 
      repository.pullRequests.filter((pr: any) => pr.cycleTimeDays).length || 0);

    const totalFilesChanged = repository.pullRequests
      .filter((pr: any) => pr.filesChanged !== null && pr.filesChanged !== undefined)
      .reduce((sum: number, pr: any) => sum + (pr.filesChanged || 0), 0);
    
    const totalLinesChanged = repository.pullRequests
      .filter((pr: any) => (pr.linesAdded || pr.linesDeleted))
      .reduce((sum: number, pr: any) => sum + (pr.linesAdded || 0) + (pr.linesDeleted || 0), 0);

    return {
      repositoryId: repository.id,
      repositoryName: repository.name,
      organization: repository.organization,
      project: repository.project,
      team: repository.team?.name,
      totals: {
        pullRequests: totalPRs,
        mergedPRs,
        openPRs,
        commits: totalCommits,
        reviews: totalReviews,
        comments: totalComments,
        filesChanged: totalFilesChanged,
        linesChanged: totalLinesChanged,
      },
      averages: {
        cycleTimeDays: avgCycleTime,
      },
    };
  }
}
