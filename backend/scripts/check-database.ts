import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('🔍 Verificando dados no banco...\n');

    // Verificar Pull Requests
    const pullRequestsCount = await prisma.pullRequest.count();
    console.log(`📊 Pull Requests: ${pullRequestsCount}`);

    if (pullRequestsCount > 0) {
      const samplePRs = await prisma.pullRequest.findMany({
        take: 3,
        include: {
          repository: true,
          createdBy: true
        }
      });
      console.log('📋 Exemplos de Pull Requests:');
      samplePRs.forEach((pr, index) => {
        console.log(`  ${index + 1}. ${pr.title} (ID: ${pr.azureId}, Status: ${pr.status})`);
        console.log(`     Repository: ${pr.repository.name}`);
        console.log(`     Created By: ${pr.createdBy.name}`);
      });
    }

    // Verificar Commits
    const commitsCount = await prisma.commit.count();
    console.log(`\n📊 Commits: ${commitsCount}`);

    if (commitsCount > 0) {
      const sampleCommits = await prisma.commit.findMany({
        take: 3,
        include: {
          repository: true,
          author: true
        }
      });
      console.log('📋 Exemplos de Commits:');
      sampleCommits.forEach((commit, index) => {
        console.log(`  ${index + 1}. ${commit.message.substring(0, 50)}... (ID: ${commit.azureId})`);
        console.log(`     Repository: ${commit.repository.name}`);
        console.log(`     Author: ${commit.author.name}`);
      });
    }

    // Verificar Developers
    const developersCount = await prisma.developer.count();
    console.log(`\n📊 Developers: ${developersCount}`);

    if (developersCount > 0) {
      const sampleDevelopers = await prisma.developer.findMany({
        take: 5
      });
      console.log('📋 Exemplos de Developers:');
      sampleDevelopers.forEach((dev, index) => {
        console.log(`  ${index + 1}. ${dev.name} (${dev.email}) - Azure ID: ${dev.azureId || 'N/A'}`);
      });
    }

    // Verificar Repositories
    const repositoriesCount = await prisma.repository.count();
    console.log(`\n📊 Repositories: ${repositoriesCount}`);

    if (repositoriesCount > 0) {
      const sampleRepos = await prisma.repository.findMany({
        take: 3
      });
      console.log('📋 Exemplos de Repositories:');
      sampleRepos.forEach((repo, index) => {
        console.log(`  ${index + 1}. ${repo.name} (Azure ID: ${repo.azureId || 'N/A'})`);
        console.log(`     Organization: ${repo.organization}, Project: ${repo.project}`);
        console.log(`     Last Sync: ${repo.lastSyncAt || 'Never'}`);
      });
    }

    // Verificar Sync Jobs
    const syncJobsCount = await prisma.syncJob.count();
    console.log(`\n📊 Sync Jobs: ${syncJobsCount}`);

    if (syncJobsCount > 0) {
      const recentSyncJobs = await prisma.syncJob.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          repository: true
        }
      });
      console.log('📋 Jobs de Sincronização Recentes:');
      recentSyncJobs.forEach((job, index) => {
        console.log(`  ${index + 1}. ${job.repository.name} - ${job.status} (${job.syncType})`);
        console.log(`     Started: ${job.startedAt || 'N/A'}, Completed: ${job.completedAt || 'N/A'}`);
        if (job.error) {
          console.log(`     Error: ${job.error}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Erro ao verificar banco de dados:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
