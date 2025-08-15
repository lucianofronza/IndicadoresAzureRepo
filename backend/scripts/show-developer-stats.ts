import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

async function showDeveloperStats() {
  try {
    logger.info('=== DEVELOPER STATISTICS ===');

    // 1. Estatísticas gerais
    const totalDevelopers = await prisma.developer.count();
    const developersWithTeam = await prisma.developer.count({
      where: { teamId: { not: null } }
    });
    const developersWithoutTeam = await prisma.developer.count({
      where: { teamId: null }
    });

    logger.info(`Total developers: ${totalDevelopers}`);
    logger.info(`Developers with team: ${developersWithTeam}`);
    logger.info(`Developers without team: ${developersWithoutTeam}`);
    logger.info(`Percentage without team: ${((developersWithoutTeam / totalDevelopers) * 100).toFixed(1)}%`);

    // 2. Estatísticas de PRs
    const totalPRs = await prisma.pullRequest.count();
    const prsWithTeam = await prisma.pullRequest.count({
      where: {
        createdBy: {
          teamId: { not: null }
        }
      }
    });
    const prsWithoutTeam = await prisma.pullRequest.count({
      where: {
        createdBy: {
          teamId: null
        }
      }
    });

    logger.info('\n=== PULL REQUEST STATISTICS ===');
    logger.info(`Total PRs: ${totalPRs}`);
    logger.info(`PRs from developers with team: ${prsWithTeam}`);
    logger.info(`PRs from developers without team: ${prsWithoutTeam}`);
    logger.info(`Percentage PRs without team: ${((prsWithoutTeam / totalPRs) * 100).toFixed(1)}%`);

    // 3. Estatísticas por time
    logger.info('\n=== TEAM STATISTICS ===');
    const teams = await prisma.team.findMany({
      select: {
        id: true,
        name: true,
        developers: {
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                pullRequests: true
              }
            }
          }
        }
      }
    });

    teams.forEach(team => {
      const totalPRs = team.developers.reduce((sum, dev) => sum + dev._count.pullRequests, 0);
      logger.info(`${team.name}: ${team.developers.length} devs, ${totalPRs} PRs`);
    });

    // 4. Top desenvolvedores sem time
    logger.info('\n=== TOP DEVELOPERS WITHOUT TEAM ===');
    const topDevelopersWithoutTeam = await prisma.developer.findMany({
      where: { teamId: null },
      select: {
        id: true,
        name: true,
        login: true,
        _count: {
          select: {
            pullRequests: true
          }
        }
      },
      orderBy: {
        pullRequests: {
          _count: 'desc'
        }
      },
      take: 10
    });

    topDevelopersWithoutTeam.forEach((dev, index) => {
      logger.info(`${index + 1}. ${dev.name} (${dev.login}): ${dev._count.pullRequests} PRs`);
    });

    // 5. Estatísticas de arquivos alterados
    logger.info('\n=== FILES CHANGED STATISTICS ===');
    const filesChangedStats = await prisma.pullRequest.groupBy({
      by: ['createdById'],
      where: {
        filesChanged: { not: null }
      },
      _sum: {
        filesChanged: true
      },
      _count: {
        id: true
      }
    });

    const totalFilesChanged = filesChangedStats.reduce((sum, item) => sum + (item._sum.filesChanged || 0), 0);
    const totalPRsWithFiles = filesChangedStats.reduce((sum, item) => sum + item._count.id, 0);
    const averageFilesPerPR = totalPRsWithFiles > 0 ? totalFilesChanged / totalPRsWithFiles : 0;

    logger.info(`Total files changed: ${totalFilesChanged}`);
    logger.info(`Total PRs with files data: ${totalPRsWithFiles}`);
    logger.info(`Average files per PR: ${averageFilesPerPR.toFixed(1)}`);

    // 6. Arquivos alterados por time
    logger.info('\n=== FILES CHANGED BY TEAM ===');
    const filesByTeam = await prisma.pullRequest.groupBy({
      by: ['createdById'],
      where: {
        filesChanged: { not: null }
      },
      _sum: {
        filesChanged: true
      },
      _count: {
        id: true
      }
    });

    const developerIds = filesByTeam.map(item => item.createdById);
    const developers = await prisma.developer.findMany({
      where: { id: { in: developerIds } },
      select: {
        id: true,
        name: true,
        team: {
          select: {
            name: true
          }
        }
      }
    });

    const teamFilesMap = new Map();
    filesByTeam.forEach(item => {
      const developer = developers.find(d => d.id === item.createdById);
      const teamName = developer?.team?.name || 'Sem time informado';
      
      if (!teamFilesMap.has(teamName)) {
        teamFilesMap.set(teamName, { totalFiles: 0, totalPRs: 0 });
      }
      
      const teamData = teamFilesMap.get(teamName);
      teamData.totalFiles += item._sum.filesChanged || 0;
      teamData.totalPRs += item._count.id;
    });

    teamFilesMap.forEach((data, teamName) => {
      const average = data.totalPRs > 0 ? data.totalFiles / data.totalPRs : 0;
      logger.info(`${teamName}: ${data.totalFiles} files, ${data.totalPRs} PRs, avg: ${average.toFixed(1)} files/PR`);
    });

  } catch (error) {
    logger.error('Error showing developer statistics:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o script
showDeveloperStats()
  .then(() => {
    logger.info('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Script failed:', error);
    process.exit(1);
  });
