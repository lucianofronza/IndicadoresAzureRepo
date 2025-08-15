import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

async function revertDeveloperRedistribution() {
  try {
    logger.info('Starting developer redistribution revert...');

    // 1. Contar desenvolvedores com time antes da reversão
    const developersWithTeam = await prisma.developer.count({
      where: {
        teamId: { not: null }
      }
    });

    logger.info(`Found ${developersWithTeam} developers with team`);

    // 2. Remover time de todos os desenvolvedores
    const result = await prisma.developer.updateMany({
      where: {
        teamId: { not: null }
      },
      data: {
        teamId: null
      }
    });

    logger.info(`Removed team from ${result.count} developers`);

    // 3. Verificar resultado
    const developersWithoutTeam = await prisma.developer.count({
      where: { teamId: null }
    });

    const developersWithTeamAfter = await prisma.developer.count({
      where: { teamId: { not: null } }
    });

    logger.info('Revert completed!');
    logger.info(`- Developers without team: ${developersWithoutTeam}`);
    logger.info(`- Developers with team: ${developersWithTeamAfter}`);

    // 4. Mostrar estatísticas de PRs
    const totalPRs = await prisma.pullRequest.count();
    const prsWithoutTeam = await prisma.pullRequest.count({
      where: {
        createdBy: {
          teamId: null
        }
      }
    });

    logger.info(`Total PRs: ${totalPRs}`);
    logger.info(`PRs from developers without team: ${prsWithoutTeam}`);
    logger.info(`PRs from developers with team: ${totalPRs - prsWithoutTeam}`);

  } catch (error) {
    logger.error('Error during developer redistribution revert:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o script
revertDeveloperRedistribution()
  .then(() => {
    logger.info('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Script failed:', error);
    process.exit(1);
  });
