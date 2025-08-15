// @ts-nocheck
import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';
import { Role, CreateRoleDto, UpdateRoleDto, PaginationParams, PaginatedResponse } from '@/types';
import { NotFoundError, ConflictError } from '@/middlewares/errorHandler';

export class RoleService {
  async getAll(params: PaginationParams): Promise<PaginatedResponse<Role>> {
    const { page = 1, pageSize = 10, sortBy = 'name', sortOrder = 'asc' } = params;
    const skip = (page - 1) * pageSize;

    const [roles, total] = await Promise.all([
      prisma.role.findMany({
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: { developers: true },
          },
        },
      }),
      prisma.role.count(),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: roles,
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

  async getById(id: string): Promise<Role> {
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        developers: {
          include: {
            team: true,
            stack: true,
          },
        },
        _count: {
          select: { developers: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundError('Role');
    }

    return role;
  }

  async create(data: CreateRoleDto): Promise<Role> {
    const existingRole = await prisma.role.findUnique({
      where: { name: data.name },
    });

    if (existingRole) {
      throw new ConflictError('Role with this name already exists');
    }

    const role = await prisma.role.create({
      data: { name: data.name },
      include: {
        _count: {
          select: { developers: true },
        },
      },
    });

    logger.info({
      roleId: role.id,
      roleName: role.name,
    }, 'Role created successfully');

    return role;
  }

  async update(id: string, data: UpdateRoleDto): Promise<Role> {
    const existingRole = await prisma.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      throw new NotFoundError('Role');
    }

    if (data.name && data.name !== existingRole.name) {
      const nameConflict = await prisma.role.findUnique({
        where: { name: data.name },
      });

      if (nameConflict) {
        throw new ConflictError('Role with this name already exists');
      }
    }

    const role = await prisma.role.update({
      where: { id },
      data: { name: data.name },
      include: {
        _count: {
          select: { developers: true },
        },
      },
    });

    logger.info({
      roleId: role.id,
      roleName: role.name,
    }, 'Role updated successfully');

    return role;
  }

  async delete(id: string): Promise<void> {
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: { developers: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundError('Role');
    }

    if (role._count.developers > 0) {
      throw new ConflictError('Cannot delete role with developers. Please reassign developers first.');
    }

    await prisma.role.delete({
      where: { id },
    });

    logger.info({
      roleId: id,
      roleName: role.name,
    }, 'Role deleted successfully');
  }
}
