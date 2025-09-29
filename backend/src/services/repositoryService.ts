// @ts-nocheck
import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';
import { Repository, CreateRepositoryDto, UpdateRepositoryDto, PaginationParams, PaginatedResponse } from '@/types';
import { NotFoundError } from '@/middlewares/errorHandler';
import { encrypt, decrypt } from '@/utils/encryption';

/**
 * Serviço de gerenciamento de repositórios Azure DevOps.
 * 
 * Responsável por:
 * - CRUD completo de repositórios
 * - Criptografia/descriptografia de Personal Access Tokens
 * - Consulta de estatísticas de repositórios
 * - Gerenciamento de credenciais
 * 
 * **Segurança:**
 * - Personal Access Tokens são armazenados criptografados (AES-256-CBC)
 * - Tokens são descriptografados apenas quando necessário
 * - Logs não expõem tokens
 * 
 * @class RepositoryService
 * @example
 * ```typescript
 * const repoService = new RepositoryService();
 * const repos = await repoService.getAll({ page: 1, pageSize: 10 });
 * ```
 */
export class RepositoryService {
  /**
   * Lista todos os repositórios com paginação.
   * 
   * **Features:**
   * - Paginação configurável
   * - Ordenação por qualquer campo
   * - Inclui time associado
   * - Conta de Pull Requests
   * - Descriptografia automática de tokens
   * 
   * @param {PaginationParams} params - Parâmetros de paginação e ordenação
   * @param {number} [params.page=1] - Número da página
   * @param {number} [params.pageSize=10] - Itens por página
   * @param {string} [params.sortBy='name'] - Campo para ordenação
   * @param {'asc'|'desc'} [params.sortOrder='asc'] - Direção da ordenação
   * 
   * @returns {Promise<PaginatedResponse<Repository>>} Lista paginada de repositórios
   * 
   * @example
   * ```typescript
   * const result = await repoService.getAll({
   *   page: 1,
   *   pageSize: 20,
   *   sortBy: 'lastSyncAt',
   *   sortOrder: 'desc'
   * });
   * // result: { data: [...], pagination: { total, totalPages, ... } }
   * ```
   */
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

    // Descriptografar tokens para todos os repositórios
    const repositoriesWithDecryptedTokens = repositories.map(repo => {
      if (repo.personalAccessToken) {
        try {
          repo.personalAccessToken = decrypt(repo.personalAccessToken);
        } catch (error) {
          logger.warn({ repositoryId: repo.id }, 'Failed to decrypt personal access token');
          repo.personalAccessToken = null;
        }
      }
      return repo;
    });

    return {
      data: repositoriesWithDecryptedTokens as Repository[],
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

  async getRepositoryCredentials(id: string): Promise<{ organization: string; personalAccessToken: string } | null> {
    const repository = await prisma.repository.findUnique({
      where: { id },
      select: { organization: true, personalAccessToken: true }
    });

    if (!repository || !repository.personalAccessToken) {
      return null;
    }

    try {
      const decryptedToken = decrypt(repository.personalAccessToken);
      return {
        organization: repository.organization,
        personalAccessToken: decryptedToken
      };
    } catch (error) {
      logger.warn({ repositoryId: id }, 'Failed to decrypt personal access token');
      return null;
    }
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
    
    // Descriptografar o token se existir
    if (repository.personalAccessToken) {
      try {
        repository.personalAccessToken = decrypt(repository.personalAccessToken);
      } catch (error) {
        logger.warn({ repositoryId: id }, 'Failed to decrypt personal access token');
        repository.personalAccessToken = null;
      }
    }
    
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
      personalAccessToken: data.personalAccessToken ? encrypt(data.personalAccessToken) : null,
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

    // Descriptografar o token se existir
    if (repository.personalAccessToken) {
      try {
        repository.personalAccessToken = decrypt(repository.personalAccessToken);
      } catch (error) {
        logger.warn({ repositoryId: repository.id }, 'Failed to decrypt personal access token');
        repository.personalAccessToken = null;
      }
    }

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
      lastSyncAt: data.lastSyncAt,
    };

    // Tratar o personalAccessToken: se fornecido, criptografar; se não fornecido, manter o existente
    if (data.personalAccessToken !== undefined) {
      updateData.personalAccessToken = data.personalAccessToken ? encrypt(data.personalAccessToken) : null;
    }

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

    // Descriptografar o token se existir
    if (repository.personalAccessToken) {
      try {
        repository.personalAccessToken = decrypt(repository.personalAccessToken);
      } catch (error) {
        logger.warn({ repositoryId: id }, 'Failed to decrypt personal access token');
        repository.personalAccessToken = null;
      }
    }

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
