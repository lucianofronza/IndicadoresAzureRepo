import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireApiKey } from '@/middlewares/apiKey';
import { asyncHandler } from '@/middlewares/errorHandler';
import { logger } from '@/utils/logger';

const router = Router();
const prisma = new PrismaClient();

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
          // Buscar ou criar um desenvolvedor padrão para PRs sem criador conhecido
          let createdById = prData.createdById;
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
          // Buscar ou criar um desenvolvedor padrão para commits sem autor conhecido
          let authorId = commitData.authorId;
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

export default router;