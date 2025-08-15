import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

async function redistributeDevelopers() {
  try {
    logger.info('Starting developer redistribution...');

    // 1. Buscar todos os times existentes
    const teams = await prisma.team.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            developers: true
          }
        }
      }
    });

    if (teams.length === 0) {
      logger.warn('No teams found in the database');
      return;
    }

    logger.info(`Found ${teams.length} teams:`, teams.map(t => `${t.name} (${t._count.developers} devs)`));

    // 2. Buscar todos os desenvolvedores sem time
    const developersWithoutTeam = await prisma.developer.findMany({
      where: {
        teamId: null
      },
      select: {
        id: true,
        name: true,
        login: true,
        _count: {
          select: {
            pullRequests: true
          }
        }
      }
    });

    if (developersWithoutTeam.length === 0) {
      logger.info('No developers without team found');
      return;
    }

    logger.info(`Found ${developersWithoutTeam.length} developers without team:`, 
      developersWithoutTeam.map(d => `${d.name} (${d._count.pullRequests} PRs)`));

    // 3. Calcular estatísticas antes da redistribuição
    const totalPRsWithoutTeam = developersWithoutTeam.reduce((sum, dev) => sum + dev._count.pullRequests, 0);
    logger.info(`Total PRs from developers without team: ${totalPRsWithoutTeam}`);

    // 4. Distribuir desenvolvedores aleatoriamente entre os times
    const shuffledDevelopers = [...developersWithoutTeam].sort(() => Math.random() - 0.5);
    const teamIds = teams.map(t => t.id);

    let redistributionCount = 0;
    for (const developer of shuffledDevelopers) {
      // Escolher um time aleatório
      const randomTeamId = teamIds[Math.floor(Math.random() * teamIds.length)];
      
      // Atualizar o desenvolvedor
      await prisma.developer.update({
        where: { id: developer.id },
        data: { teamId: randomTeamId }
      });

      redistributionCount++;
      logger.info(`Redistributed ${developer.name} to team ${teams.find(t => t.id === randomTeamId)?.name}`);
    }

    // 5. Verificar resultado
    const teamsAfterRedistribution = await prisma.team.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            developers: true
          }
        }
      }
    });

    logger.info('Teams after redistribution:', 
      teamsAfterRedistribution.map(t => `${t.name} (${t._count.developers} devs)`));

    const remainingWithoutTeam = await prisma.developer.count({
      where: { teamId: null }
    });

    logger.info(`Redistribution completed!`);
    logger.info(`- Developers redistributed: ${redistributionCount}`);
    logger.info(`- Developers still without team: ${remainingWithoutTeam}`);

    // 6. Mostrar distribuição de PRs por time após redistribuição
    const prsByTeam = await prisma.pullRequest.groupBy({
      by: ['createdById'],
      _count: {
        id: true
      },
      where: {
        createdBy: {
          teamId: { not: null }
        }
      }
    });

    const teamPRStats = await prisma.team.findMany({
      select: {
        id: true,
        name: true,
        developers: {
          select: {
            _count: {
              select: {
                pullRequests: true
              }
            }
          }
        }
      }
    });

    logger.info('PRs distribution by team after redistribution:');
    teamPRStats.forEach(team => {
      const totalPRs = team.developers.reduce((sum, dev) => sum + dev._count.pullRequests, 0);
      logger.info(`- ${team.name}: ${totalPRs} PRs (${team.developers.length} devs)`);
    });

  } catch (error) {
    logger.error('Error during developer redistribution:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o script
redistributeDevelopers()
  .then(() => {
    logger.info('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Script failed:', error);
    process.exit(1);
  });
