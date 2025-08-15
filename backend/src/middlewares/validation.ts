import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '@/utils/logger';

// Base schemas
const paginationSchema = z.object({
  page: z.string().optional().transform(val => parseInt(val || '1')),
  pageSize: z.string().optional().transform(val => parseInt(val || '10')),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// KPI filters schema
export const kpiFiltersSchema = z.object({
  ...dateRangeSchema.shape,
  teamId: z.string().optional(),
  roleId: z.string().optional(),
  stackId: z.string().optional(),
  developerId: z.string().optional(),
  repositoryId: z.string().optional(),
  status: z.string().optional(),
});

// Team schemas
export const createTeamSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  management: z.string().optional(),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo').optional(),
  management: z.string().optional(),
});

// Role schemas
export const createRoleSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo').optional(),
});

// Stack schemas
export const createStackSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser um código hexadecimal válido').optional(),
});

export const updateStackSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo').optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser um código hexadecimal válido').optional(),
});

// Developer schemas
export const createDeveloperSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  email: z.string().email('Email inválido').optional(),
  login: z.string().min(1, 'Login é obrigatório').max(50, 'Login muito longo'),
  teamId: z.string().min(1, 'Time é obrigatório'),
  roleId: z.string().min(1, 'Cargo é obrigatório'),
  stackIds: z.array(z.string()).optional(),
});

export const updateDeveloperSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo').optional(),
  email: z.string().email('Email inválido').optional(),
  login: z.string().min(1, 'Login é obrigatório').max(50, 'Login muito longo').optional(),
  teamId: z.string().min(1, 'Time é obrigatório').optional(),
  roleId: z.string().min(1, 'Cargo é obrigatório').optional(),
  stackIds: z.array(z.string()).optional(),
});

// Repository schemas
export const createRepositorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  organization: z.string().min(1, 'Organização é obrigatória').max(100, 'Organização muito longa'),
  project: z.string().min(1, 'Projeto é obrigatório').max(100, 'Projeto muito longo'),
  url: z.string().url('URL inválida'),
  azureId: z.string().optional(),
  teamId: z.string().optional(),
});

export const updateRepositorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo').optional(),
  organization: z.string().min(1, 'Organização é obrigatória').max(100, 'Organização muito longa').optional(),
  project: z.string().min(1, 'Projeto é obrigatório').max(100, 'Projeto muito longo').optional(),
  url: z.string().url('URL inválida').optional(),
  azureId: z.string().optional(),
  teamId: z.string().optional(),
});

// Sync schemas
export const syncRepositorySchema = z.object({
  repositoryId: z.string().min(1, 'ID do repositório é obrigatório'),
});

// Auth schemas
export const azureAuthCallbackSchema = z.object({
  code: z.string().min(1, 'Código de autorização é obrigatório'),
  state: z.string().optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token é obrigatório'),
  userId: z.string().min(1, 'ID do usuário é obrigatório'),
});

export const revokeTokenSchema = z.object({
  accessToken: z.string().min(1, 'Access token é obrigatório'),
  userId: z.string().min(1, 'ID do usuário é obrigatório'),
});

export const validateTokenSchema = z.object({
  accessToken: z.string().min(1, 'Access token é obrigatório'),
});

// Combined schemas
export const teamListSchema = paginationSchema.extend({
  search: z.string().optional(),
});

export const developerListSchema = paginationSchema.extend({
  search: z.string().optional(),
  teamId: z.string().optional(),
  roleId: z.string().optional(),
  stackId: z.string().optional(),
});

export const repositoryListSchema = paginationSchema.extend({
  search: z.string().optional(),
  teamId: z.string().optional(),
  organization: z.string().optional(),
});

// Validation middleware
export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse({
        ...req.body,
        ...req.query,
        ...req.params,
      });

      // Replace request data with validated data
      req.body = validatedData;
      req.query = validatedData;
      // Don't replace req.params to preserve route parameters like :id

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        logger.warn({
          validationErrors: errors,
          requestId: (req as any).requestId,
        }, 'Validation failed');

        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: errors,
        });
      }

      next(error);
    }
  };
};

// Sanitization helpers
export const sanitizeString = (value: string): string => {
  return value
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
};

export const sanitizeHtml = (value: string): string => {
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '') // Remove object tags
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, ''); // Remove embed tags
};

// Export all schemas
export {
  paginationSchema,
  dateRangeSchema,
};
