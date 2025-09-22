import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireApiKey } from '@/middlewares/apiKey';
import { asyncHandler } from '@/middlewares/errorHandler';
import { logger } from '@/utils/logger';
import { AzureSyncService } from '@/services/azureSyncService';

const router = Router();
const prisma = new PrismaClient();
const azureSyncService = new AzureSyncService();

// Endpoint para receber Pull Requests do sync-service
router.post('/pull-requests', 
  requireApiKey,
  asyncHandler(async (req, res) => {
    const { pullRequests } = req.body;

    if (!Array.isArray(pullRequests)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_DATA',
        message: 'pullRequests must be an array'
      });
    }

    let processed = 0;
    const errors: any[] = [];

    for (const prData of pullRequests) {
      try {
        // Verificar se o Pull Request já existe
        const existingPR = await prisma.pullRequest.findFirst({
          where: {
            azureId: prData.azureId,
            repositoryId: prData.repositoryId
          }
        });

        if (existingPR) {
          // Atualizar Pull Request existente
          await prisma.pullRequest.update({
            where: { id: existingPR.id },
            data: {
              title: prData.title,
              description: prData.description,
              status: prData.status,
              sourceBranch: prData.sourceBranch,
              targetBranch: prData.targetBranch,
              updatedAt: new Date(prData.updatedAt),
              closedAt: prData.closedAt ? new Date(prData.closedAt) : null,
              mergedAt: prData.mergedAt ? new Date(prData.mergedAt) : null,
              cycleTimeDays: prData.cycleTimeDays,
              leadTimeDays: prData.leadTimeDays,
              reviewTimeDays: prData.reviewTimeDays,
              filesChanged: prData.filesChanged,
              linesAdded: prData.linesAdded,
              linesDeleted: prData.linesDeleted,
              isDraft: prData.isDraft
            }
          });
        } else {
          // Processar dados do desenvolvedor
          let createdById = prData.createdById;
          
          // Se createdById é um objeto com dados do desenvolvedor, processar
          if (typeof createdById === 'object' && createdById !== null && 'displayName' in createdById) {
            try {
              const developer = await (azureSyncService as any).findOrCreateDeveloper(createdById);
              createdById = developer.id;
              logger.info({ 
                developerId: developer.id, 
                developerName: developer.name,
                prTitle: prData.title 
              }, 'Developer found/created for PR');
            } catch (error) {
              logger.error({ 
                error: error instanceof Error ? error.message : 'Unknown error',
                developerData: createdById,
                prTitle: prData.title
              }, 'Failed to find/create developer for PR, using Unknown Developer');
              createdById = 'unknown';
            }
          }
          
          // Se ainda é 'unknown' ou inválido, usar Unknown Developer
          if (!createdById || createdById === 'unknown') {
            const defaultAuthor = await prisma.developer.findFirst({
              where: { name: 'Unknown Developer' }
            });
            
            if (!defaultAuthor) {
              const newDefaultAuthor = await prisma.developer.create({
                data: {
                  name: 'Unknown Developer',
                  email: 'unknown@example.com',
                  login: 'unknown',
                  azureId: 'unknown'
                }
              });
              createdById = newDefaultAuthor.id;
            } else {
              createdById = defaultAuthor.id;
            }
          }

          // Criar novo Pull Request
          await prisma.pullRequest.create({
            data: {
              azureId: prData.azureId,
              title: prData.title,
              description: prData.description,
              status: prData.status,
              sourceBranch: prData.sourceBranch,
              targetBranch: prData.targetBranch,
              createdAt: new Date(prData.createdAt),
              updatedAt: new Date(prData.updatedAt),
              closedAt: prData.closedAt ? new Date(prData.closedAt) : null,
              mergedAt: prData.mergedAt ? new Date(prData.mergedAt) : null,
              cycleTimeDays: prData.cycleTimeDays,
              leadTimeDays: prData.leadTimeDays,
              reviewTimeDays: prData.reviewTimeDays,
              filesChanged: prData.filesChanged,
              linesAdded: prData.linesAdded,
              linesDeleted: prData.linesDeleted,
              isDraft: prData.isDraft,
              repositoryId: prData.repositoryId,
              createdById: createdById
            }
          });
        }
        processed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        
        logger.error('Failed to process pull request:', { 
          prData, 
          error: errorMessage,
          stack: errorStack
        });
        
        // Log detalhado para debug
        console.error('❌ Pull Request Error Details:', {
          azureId: prData.azureId,
          title: prData.title,
          repositoryId: prData.repositoryId,
          createdById: prData.createdById,
          error: errorMessage
        });
        
        errors.push({ azureId: prData.azureId, error: errorMessage });
      }
    }

    logger.info('Pull requests processed', { 
      total: pullRequests.length, 
      processed, 
      errors: errors.length 
    });

    res.json({
      success: true,
      data: {
        total: pullRequests.length,
        processed,
        errors: errors.length
      }
    });
  })
);

// Endpoint para receber Commits do sync-service
router.post('/commits', 
  requireApiKey,
  asyncHandler(async (req, res) => {
    const { commits } = req.body;

    if (!Array.isArray(commits)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_DATA',
        message: 'commits must be an array'
      });
    }

    let processed = 0;
    const errors: any[] = [];

    for (const commitData of commits) {
      try {
        // Verificar se o Commit já existe
        const existingCommit = await prisma.commit.findFirst({
          where: {
            azureId: commitData.azureId,
            repositoryId: commitData.repositoryId
          }
        });

        if (existingCommit) {
          // Atualizar Commit existente
          await prisma.commit.update({
            where: { id: existingCommit.id },
            data: {
              message: commitData.message,
              hash: commitData.hash,
              createdAt: new Date(commitData.createdAt)
            }
          });
        } else {
          // Processar dados do desenvolvedor
          let authorId = commitData.authorId;
          
          // Se authorId é um objeto com dados do desenvolvedor, processar
          if (typeof authorId === 'object' && authorId !== null && 'displayName' in authorId) {
            try {
              const developer = await (azureSyncService as any).findOrCreateDeveloper(authorId);
              authorId = developer.id;
              logger.info({ 
                developerId: developer.id, 
                developerName: developer.name,
                commitMessage: commitData.message 
              }, 'Developer found/created for commit');
            } catch (error) {
              logger.error({ 
                error: error instanceof Error ? error.message : 'Unknown error',
                developerData: authorId,
                commitMessage: commitData.message
              }, 'Failed to find/create developer for commit, using Unknown Developer');
              authorId = 'unknown';
            }
          }
          
          // Se ainda é 'unknown' ou inválido, usar Unknown Developer
          if (!authorId || authorId === 'unknown') {
            const defaultAuthor = await prisma.developer.findFirst({
              where: { name: 'Unknown Developer' }
            });
            
            if (!defaultAuthor) {
              const newDefaultAuthor = await prisma.developer.create({
                data: {
                  name: 'Unknown Developer',
                  email: 'unknown@example.com',
                  login: 'unknown',
                  azureId: 'unknown'
                }
              });
              authorId = newDefaultAuthor.id;
            } else {
              authorId = defaultAuthor.id;
            }
          }

          // Criar novo Commit
          await prisma.commit.create({
            data: {
              azureId: commitData.azureId,
              message: commitData.message,
              hash: commitData.hash,
              createdAt: new Date(commitData.createdAt),
              repositoryId: commitData.repositoryId,
              authorId: authorId
            }
          });
        }
        processed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        
        logger.error('Failed to process commit:', { 
          commitData, 
          error: errorMessage,
          stack: errorStack
        });
        
        // Log detalhado para debug
        console.error('❌ Commit Error Details:', {
          azureId: commitData.azureId,
          message: commitData.message,
          repositoryId: commitData.repositoryId,
          authorId: commitData.authorId,
          error: errorMessage
        });
        
        errors.push({ azureId: commitData.azureId, error: errorMessage });
      }
    }

    logger.info('Commits processed', { 
      total: commits.length, 
      processed, 
      errors: errors.length 
    });

    res.json({
      success: true,
      data: {
        total: commits.length,
        processed,
        errors: errors.length
      }
    });
  })
);

// Endpoint para receber Reviews do sync-service
router.post('/reviews', 
  requireApiKey,
  asyncHandler(async (req, res) => {
    const { repositoryId, reviews } = req.body;

    if (!repositoryId || !Array.isArray(reviews)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_DATA',
        message: 'repositoryId e reviews são obrigatórios'
      });
    }

    let processed = 0;
    const errors: any[] = [];

    for (const reviewData of reviews) {
      try {
        // Verificar se a Review já existe
        const azureIdInt = parseInt(reviewData.azureId);
        if (isNaN(azureIdInt)) {
          throw new Error(`Invalid azureId: ${reviewData.azureId}`);
        }
        
        const existingReview = await prisma.review.findFirst({
          where: {
            azureId: azureIdInt,
            pullRequestId: reviewData.pullRequestId
          }
        });

        if (existingReview) {
          // Atualizar Review existente
          await prisma.review.update({
            where: { id: existingReview.id },
            data: {
              status: reviewData.status,
              vote: reviewData.vote,
              createdAt: new Date(reviewData.createdAt),
              updatedAt: new Date(reviewData.updatedAt)
            }
          });
        } else {
          // Processar dados do reviewer
          let reviewerId = reviewData.reviewerId;
          
          // Se reviewerId é um objeto com dados do desenvolvedor, processar
          if (typeof reviewerId === 'object' && reviewerId !== null && 'displayName' in reviewerId) {
            try {
              const developer = await (azureSyncService as any).findOrCreateDeveloper(reviewerId);
              reviewerId = developer.id;
              logger.info({ 
                developerId: developer.id, 
                developerName: developer.name,
                reviewId: reviewData.azureId 
              }, 'Developer found/created for review');
            } catch (error) {
              logger.error({ 
                error: error instanceof Error ? error.message : 'Unknown error',
                developerData: reviewerId,
                reviewId: reviewData.azureId
              }, 'Failed to find/create developer for review, using Unknown Developer');
              reviewerId = 'unknown';
            }
          }
          
          // Se ainda é 'unknown' ou inválido, usar Unknown Developer
          if (!reviewerId || reviewerId === 'unknown') {
            const defaultReviewer = await prisma.developer.findFirst({
              where: { name: 'Unknown Developer' }
            });
            
            if (!defaultReviewer) {
              const newDefaultReviewer = await prisma.developer.create({
                data: {
                  name: 'Unknown Developer',
                  email: 'unknown@example.com',
                  login: 'unknown',
                  azureId: 'unknown'
                }
              });
              reviewerId = newDefaultReviewer.id;
            } else {
              reviewerId = defaultReviewer.id;
            }
          }

          // Criar nova Review
          await prisma.review.create({
            data: {
              azureId: azureIdInt,
              status: reviewData.status,
              vote: reviewData.vote,
              pullRequestId: reviewData.pullRequestId,
              reviewerId: reviewerId,
              createdAt: new Date(reviewData.createdAt),
              updatedAt: new Date(reviewData.updatedAt)
            }
          });
        }

        processed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to process review', {
          azureId: reviewData.azureId,
          pullRequestId: reviewData.pullRequestId,
          error: errorMessage
        });
        
        // Log detalhado para debug
        console.error('❌ Review Error Details:', {
          azureId: reviewData.azureId,
          pullRequestId: reviewData.pullRequestId,
          reviewerId: reviewData.reviewerId,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        });
        
        errors.push({ azureId: reviewData.azureId, error: errorMessage });
      }
    }

    logger.info('Reviews processed', { 
      total: reviews.length, 
      processed, 
      errors: errors.length 
    });

    res.json({
      success: true,
      data: {
        total: reviews.length,
        processed,
        errors: errors.length
      }
    });
  })
);

// Endpoint para receber Comments do sync-service
router.post('/comments', 
  requireApiKey,
  asyncHandler(async (req, res) => {
    const { repositoryId, comments } = req.body;

    if (!repositoryId || !Array.isArray(comments)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_DATA',
        message: 'repositoryId e comments são obrigatórios'
      });
    }

    let processed = 0;
    const errors: any[] = [];

    for (const commentData of comments) {
      try {
        // Verificar se o Comment já existe
        const azureIdInt = parseInt(commentData.azureId);
        if (isNaN(azureIdInt)) {
          throw new Error(`Invalid azureId: ${commentData.azureId}`);
        }
        
        const existingComment = await prisma.comment.findFirst({
          where: {
            azureId: azureIdInt,
            pullRequestId: commentData.pullRequestId
          }
        });

        if (existingComment) {
          // Atualizar Comment existente
          await prisma.comment.update({
            where: { id: existingComment.id },
            data: {
              content: commentData.content,
              createdAt: new Date(commentData.createdAt),
              updatedAt: new Date(commentData.updatedAt)
            }
          });
        } else {
          // Processar dados do autor do comentário
          let authorId = commentData.authorId;
          
          // Se authorId é um objeto com dados do desenvolvedor, processar
          if (typeof authorId === 'object' && authorId !== null && 'displayName' in authorId) {
            try {
              const developer = await (azureSyncService as any).findOrCreateDeveloper(authorId);
              authorId = developer.id;
              logger.info({ 
                developerId: developer.id, 
                developerName: developer.name,
                commentId: commentData.azureId 
              }, 'Developer found/created for comment');
            } catch (error) {
              logger.error({ 
                error: error instanceof Error ? error.message : 'Unknown error',
                developerData: authorId,
                commentId: commentData.azureId
              }, 'Failed to find/create developer for comment, using Unknown Developer');
              authorId = 'unknown';
            }
          }
          
          // Se ainda é 'unknown' ou inválido, usar Unknown Developer
          if (!authorId || authorId === 'unknown') {
            const defaultAuthor = await prisma.developer.findFirst({
              where: { name: 'Unknown Developer' }
            });
            
            if (!defaultAuthor) {
              const newDefaultAuthor = await prisma.developer.create({
                data: {
                  name: 'Unknown Developer',
                  email: 'unknown@example.com',
                  login: 'unknown',
                  azureId: 'unknown'
                }
              });
              authorId = newDefaultAuthor.id;
            } else {
              authorId = defaultAuthor.id;
            }
          }

          // Criar novo Comment
          await prisma.comment.create({
            data: {
              azureId: azureIdInt,
              content: commentData.content,
              pullRequestId: commentData.pullRequestId,
              authorId: authorId,
              createdAt: new Date(commentData.createdAt),
              updatedAt: new Date(commentData.updatedAt)
            }
          });
        }

        processed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to process comment', {
          azureId: commentData.azureId,
          pullRequestId: commentData.pullRequestId,
          error: errorMessage
        });
        
        // Log detalhado para debug
        console.error('❌ Comment Error Details:', {
          azureId: commentData.azureId,
          pullRequestId: commentData.pullRequestId,
          authorId: commentData.authorId,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        });
        
        errors.push({ azureId: commentData.azureId, error: errorMessage });
      }
    }

    logger.info('Comments processed', { 
      total: comments.length, 
      processed, 
      errors: errors.length 
    });

    res.json({
      success: true,
      data: {
        total: comments.length,
        processed,
        errors: errors.length
      }
    });
  })
);

// Endpoint para obter mapeamento de azureId para databaseId dos PRs
router.post('/pull-requests/ids', 
  requireApiKey,
  asyncHandler(async (req, res) => {
    const { repositoryId, azureIds } = req.body;

    if (!repositoryId || !Array.isArray(azureIds)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_DATA',
        message: 'repositoryId e azureIds são obrigatórios'
      });
    }

    try {
      const pullRequests = await prisma.pullRequest.findMany({
        where: {
          repositoryId: repositoryId,
          azureId: {
            in: azureIds
          }
        },
        select: {
          id: true,
          azureId: true
        }
      });

      logger.info('PR ID mapping requested', { 
        repositoryId, 
        requestedCount: azureIds.length,
        foundCount: pullRequests.length 
      });

      res.json({
        success: true,
        data: pullRequests
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get PR ID mapping', { 
        repositoryId, 
        azureIds: azureIds.slice(0, 5), // Log only first 5 for brevity
        error: errorMessage 
      });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: errorMessage
      });
    }
  })
);

export default router;