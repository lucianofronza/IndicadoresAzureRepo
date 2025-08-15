// @ts-nocheck
import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';
import { Stack, CreateStackDto, UpdateStackDto, PaginationParams, PaginatedResponse } from '@/types';
import { NotFoundError, ConflictError } from '@/middlewares/errorHandler';

export class StackService {
  async getAll(params: PaginationParams): Promise<PaginatedResponse<Stack>> {
    const { page = 1, pageSize = 10, sortBy = 'name', sortOrder = 'asc' } = params;
    const skip = (page - 1) * pageSize;

    const [stacks, total] = await Promise.all([
      prisma.stack.findMany({
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: { select: { developers: true } },
        },
      }),
      prisma.stack.count(),
    ]);

    return {
      data: stacks,
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

  async getById(id: string): Promise<Stack> {
    const stack = await prisma.stack.findUnique({
      where: { id },
      include: {
        developers: {
          include: { team: true, role: true },
        },
        _count: { select: { developers: true } },
      },
    });

    if (!stack) throw new NotFoundError('Stack');
    return stack;
  }

  async create(data: CreateStackDto): Promise<Stack> {
    const existing = await prisma.stack.findUnique({ where: { name: data.name } });
    if (existing) throw new ConflictError('Stack with this name already exists');

    const stack = await prisma.stack.create({
      data: { 
        name: data.name,
        color: data.color || '#3b82f6'
      },
      include: { _count: { select: { developers: true } } },
    });

    logger.info({ stackId: stack.id, stackName: stack.name }, 'Stack created successfully');
    return stack;
  }

  async update(id: string, data: UpdateStackDto): Promise<Stack> {
    const existing = await prisma.stack.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Stack');

    if (data.name && data.name !== existing.name) {
      const conflict = await prisma.stack.findUnique({ where: { name: data.name } });
      if (conflict) throw new ConflictError('Stack with this name already exists');
    }

    const stack = await prisma.stack.update({
      where: { id },
      data: { 
        name: data.name,
        color: data.color
      },
      include: { _count: { select: { developers: true } } },
    });

    logger.info({ stackId: stack.id, stackName: stack.name }, 'Stack updated successfully');
    return stack;
  }

  async delete(id: string): Promise<void> {
    const stack = await prisma.stack.findUnique({
      where: { id },
      include: { _count: { select: { developers: true } } },
    });

    if (!stack) throw new NotFoundError('Stack');
    if (stack._count.developers > 0) {
      throw new ConflictError('Cannot delete stack with developers. Please reassign developers first.');
    }

    await prisma.stack.delete({ where: { id } });
    logger.info({ stackId: id, stackName: stack.name }, 'Stack deleted successfully');
  }
}
