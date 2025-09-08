import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import { UserTeam, UserTeamCreateInput, UserTeamUpdateInput } from '@/types/auth';
import { CustomError } from '@/middlewares/errorHandler';

const prisma = new PrismaClient();

export class UserTeamService {
  /**
   * Obter todas as equipes de um usuário
   */
  async getUserTeams(userId: string): Promise<UserTeam[]> {
    try {
      logger.info({ userId }, 'Getting user teams');

      const userTeams = await prisma.userTeam.findMany({
        where: { userId },
        include: {
          team: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return userTeams.map(ut => ({
        id: ut.id,
        userId: ut.userId,
        teamId: ut.teamId,
        role: ut.role as 'member' | 'coordinator' | 'manager',
        createdAt: ut.createdAt,
        updatedAt: ut.updatedAt,
        team: {
          id: ut.team.id,
          name: ut.team.name
        }
      }));
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error getting user teams');
      throw error;
    }
  }

  /**
   * Adicionar usuário a uma equipe
   */
  async addUserToTeam(userTeamData: UserTeamCreateInput): Promise<UserTeam> {
    try {
      logger.info({ userTeamData }, 'Adding user to team');

      // Verificar se a associação já existe
      const existingUserTeam = await prisma.userTeam.findUnique({
        where: {
          userId_teamId: {
            userId: userTeamData.userId,
            teamId: userTeamData.teamId
          }
        }
      });

      if (existingUserTeam) {
        throw new CustomError('Usuário já está associado a esta equipe', 400, 'USER_TEAM_EXISTS');
      }

      // Verificar se o usuário existe
      const user = await prisma.user.findUnique({
        where: { id: userTeamData.userId }
      });

      if (!user) {
        throw new CustomError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
      }

      // Verificar se a equipe existe
      const team = await prisma.team.findUnique({
        where: { id: userTeamData.teamId }
      });

      if (!team) {
        throw new CustomError('Equipe não encontrada', 404, 'TEAM_NOT_FOUND');
      }

      const userTeam = await prisma.userTeam.create({
        data: {
          userId: userTeamData.userId,
          teamId: userTeamData.teamId,
          role: userTeamData.role || 'member'
        },
        include: {
          team: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      logger.info({ userTeamId: userTeam.id }, 'User added to team successfully');

      return {
        id: userTeam.id,
        userId: userTeam.userId,
        teamId: userTeam.teamId,
        role: userTeam.role as 'member' | 'coordinator' | 'manager',
        createdAt: userTeam.createdAt,
        updatedAt: userTeam.updatedAt,
        team: {
          id: userTeam.team.id,
          name: userTeam.team.name
        }
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error adding user to team');
      throw error;
    }
  }

  /**
   * Atualizar role do usuário na equipe
   */
  async updateUserTeamRole(userTeamId: string, userTeamData: UserTeamUpdateInput): Promise<UserTeam> {
    try {
      logger.info({ userTeamId, userTeamData }, 'Updating user team role');

      const userTeam = await prisma.userTeam.update({
        where: { id: userTeamId },
        data: {
          role: userTeamData.role
        },
        include: {
          team: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      logger.info({ userTeamId }, 'User team role updated successfully');

      return {
        id: userTeam.id,
        userId: userTeam.userId,
        teamId: userTeam.teamId,
        role: userTeam.role as 'member' | 'coordinator' | 'manager',
        createdAt: userTeam.createdAt,
        updatedAt: userTeam.updatedAt,
        team: {
          id: userTeam.team.id,
          name: userTeam.team.name
        }
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error updating user team role');
      throw error;
    }
  }

  /**
   * Remover usuário de uma equipe
   */
  async removeUserFromTeam(userTeamId: string): Promise<void> {
    try {
      logger.info({ userTeamId }, 'Removing user from team');

      await prisma.userTeam.delete({
        where: { id: userTeamId }
      });

      logger.info({ userTeamId }, 'User removed from team successfully');
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error removing user from team');
      throw error;
    }
  }

  /**
   * Obter todas as equipes disponíveis (para seleção)
   */
  async getAvailableTeams(): Promise<Array<{ id: string; name: string }>> {
    try {
      const teams = await prisma.team.findMany({
        select: {
          id: true,
          name: true
        },
        orderBy: { name: 'asc' }
      });

      return teams;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error getting available teams');
      throw error;
    }
  }
}
