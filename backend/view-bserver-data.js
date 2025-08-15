const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function viewBServerData() {
  console.log('🔍 Visualizando dados sincronizados do BServer...\n');
  
  try {
    // Buscar o repositório BServer
    const repository = await prisma.repository.findFirst({
      where: { name: 'BServer' }
    });
    
    if (!repository) {
      console.log('❌ Repositório BServer não encontrado');
      return;
    }
    
    console.log(`📋 Repositório: ${repository.name}`);
    console.log(`🔗 URL: ${repository.url}`);
    console.log(`📅 Última sincronização: ${repository.lastSyncAt || 'Nunca'}\n`);
    
    // ===== ESTATÍSTICAS GERAIS =====
    console.log('📊 ESTATÍSTICAS GERAIS');
    console.log('='.repeat(50));
    
    const stats = await prisma.repository.findUnique({
      where: { id: repository.id },
      include: {
        team: true,
        _count: {
          select: {
            pullRequests: true,
            commits: true,
            syncJobs: true
          }
        }
      }
    });
    
    console.log(`📈 Total de PRs: ${stats._count.pullRequests}`);
    console.log(`📝 Total de Commits: ${stats._count.commits}`);
    console.log(`🔄 Jobs de Sincronização: ${stats._count.syncJobs}`);
    console.log(`👥 Time: ${stats.team?.name || 'Não atribuído'}\n`);
    
    // ===== PULL REQUESTS =====
    console.log('📋 PULL REQUESTS (Últimos 10)');
    console.log('='.repeat(50));
    
    const pullRequests = await prisma.pullRequest.findMany({
      where: { repositoryId: repository.id },
      include: {
        createdBy: { select: { name: true, login: true } },
        _count: {
          select: {
            reviews: true,
            comments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    pullRequests.forEach((pr, index) => {
      console.log(`${index + 1}. ${pr.title}`);
      console.log(`   👤 Autor: ${pr.createdBy.name} (${pr.createdBy.login})`);
      console.log(`   📅 Criado: ${pr.createdAt.toLocaleDateString('pt-BR')}`);
      console.log(`   📊 Status: ${pr.status}`);
      console.log(`   🔍 Reviews: ${pr._count.reviews}`);
      console.log(`   💬 Comments: ${pr._count.comments}`);
      if (pr.cycleTimeDays) {
        console.log(`   ⏱️  Cycle Time: ${pr.cycleTimeDays.toFixed(1)} dias`);
      }
      console.log('');
    });
    
    // ===== COMMITS =====
    console.log('📝 COMMITS (Últimos 10)');
    console.log('='.repeat(50));
    
    const commits = await prisma.commit.findMany({
      where: { repositoryId: repository.id },
      include: {
        author: { select: { name: true, login: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    commits.forEach((commit, index) => {
      console.log(`${index + 1}. ${commit.message.substring(0, 60)}${commit.message.length > 60 ? '...' : ''}`);
      console.log(`   👤 Autor: ${commit.author.name} (${commit.author.login})`);
      console.log(`   📅 Data: ${commit.createdAt.toLocaleDateString('pt-BR')}`);
      console.log(`   🔗 Hash: ${commit.hash.substring(0, 8)}`);
      console.log('');
    });
    
    // ===== REVIEWS =====
    console.log('🔍 REVIEWS (Últimos 10)');
    console.log('='.repeat(50));
    
    const reviews = await prisma.review.findMany({
      where: {
        pullRequest: { repositoryId: repository.id }
      },
      include: {
        reviewer: { select: { name: true, login: true } },
        pullRequest: { select: { title: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    reviews.forEach((review, index) => {
      console.log(`${index + 1}. PR: ${review.pullRequest.title.substring(0, 50)}${review.pullRequest.title.length > 50 ? '...' : ''}`);
      console.log(`   👤 Reviewer: ${review.reviewer.name} (${review.reviewer.login})`);
      console.log(`   📊 Status: ${review.status}`);
      console.log(`   🗳️  Vote: ${review.vote}`);
      console.log(`   📅 Data: ${review.createdAt.toLocaleDateString('pt-BR')}`);
      console.log('');
    });
    
    // ===== COMMENTS =====
    console.log('💬 COMMENTS (Últimos 10)');
    console.log('='.repeat(50));
    
    const comments = await prisma.comment.findMany({
      where: {
        pullRequest: { repositoryId: repository.id }
      },
      include: {
        author: { select: { name: true, login: true } },
        pullRequest: { select: { title: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    comments.forEach((comment, index) => {
      console.log(`${index + 1}. PR: ${comment.pullRequest.title.substring(0, 50)}${comment.pullRequest.title.length > 50 ? '...' : ''}`);
      console.log(`   👤 Autor: ${comment.author.name} (${comment.author.login})`);
      console.log(`   💬 Comentário: ${comment.content.substring(0, 80)}${comment.content.length > 80 ? '...' : ''}`);
      console.log(`   📅 Data: ${comment.createdAt.toLocaleDateString('pt-BR')}`);
      console.log('');
    });
    
    // ===== DESENVOLVEDORES MAIS ATIVOS =====
    console.log('👥 DESENVOLVEDORES MAIS ATIVOS');
    console.log('='.repeat(50));
    
    const activeDevelopers = await prisma.developer.findMany({
      where: {
        OR: [
          { pullRequests: { some: { repositoryId: repository.id } } },
          { commits: { some: { repositoryId: repository.id } } },
          { reviews: { some: { pullRequest: { repositoryId: repository.id } } } },
          { comments: { some: { pullRequest: { repositoryId: repository.id } } } }
        ]
      },
      include: {
        team: true,
        _count: {
          select: {
            pullRequests: {
              where: { repositoryId: repository.id }
            },
            commits: {
              where: { repositoryId: repository.id }
            },
            reviews: {
              where: {
                pullRequest: { repositoryId: repository.id }
              }
            },
            comments: {
              where: {
                pullRequest: { repositoryId: repository.id }
              }
            }
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
    
    activeDevelopers.forEach((dev, index) => {
      const totalActivity = dev._count.pullRequests + dev._count.commits + dev._count.reviews + dev._count.comments;
      console.log(`${index + 1}. ${dev.name} (${dev.login})`);
      console.log(`   👥 Time: ${dev.team?.name || 'Não atribuído'}`);
      console.log(`   📊 Atividade: ${totalActivity} ações`);
      console.log(`   📋 PRs: ${dev._count.pullRequests}`);
      console.log(`   📝 Commits: ${dev._count.commits}`);
      console.log(`   🔍 Reviews: ${dev._count.reviews}`);
      console.log(`   💬 Comments: ${dev._count.comments}`);
      console.log('');
    });
    
    // ===== JOBS DE SINCRONIZAÇÃO =====
    console.log('🔄 JOBS DE SINCRONIZAÇÃO');
    console.log('='.repeat(50));
    
    const syncJobs = await prisma.syncJob.findMany({
      where: { repositoryId: repository.id },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    syncJobs.forEach((job, index) => {
      console.log(`${index + 1}. ${job.syncType.toUpperCase()} - ${job.status}`);
      console.log(`   📅 Criado: ${job.createdAt.toLocaleDateString('pt-BR')} ${job.createdAt.toLocaleTimeString('pt-BR')}`);
      if (job.startedAt) {
        console.log(`   🚀 Iniciado: ${job.startedAt.toLocaleDateString('pt-BR')} ${job.startedAt.toLocaleTimeString('pt-BR')}`);
      }
      if (job.completedAt) {
        console.log(`   ✅ Concluído: ${job.completedAt.toLocaleDateString('pt-BR')} ${job.completedAt.toLocaleTimeString('pt-BR')}`);
      }
      if (job.error) {
        console.log(`   ❌ Erro: ${job.error}`);
      }
      console.log('');
    });
    
    // ===== RESUMO FINAL =====
    console.log('📈 RESUMO FINAL');
    console.log('='.repeat(50));
    
    const totalPRs = await prisma.pullRequest.count({ where: { repositoryId: repository.id } });
    const totalCommits = await prisma.commit.count({ where: { repositoryId: repository.id } });
    const totalReviews = await prisma.review.count({ 
      where: { pullRequest: { repositoryId: repository.id } } 
    });
    const totalComments = await prisma.comment.count({ 
      where: { pullRequest: { repositoryId: repository.id } } 
    });
    const totalDevelopers = await prisma.developer.count({
      where: {
        OR: [
          { pullRequests: { some: { repositoryId: repository.id } } },
          { commits: { some: { repositoryId: repository.id } } },
          { reviews: { some: { pullRequest: { repositoryId: repository.id } } } },
          { comments: { some: { pullRequest: { repositoryId: repository.id } } } }
        ]
      }
    });
    
    console.log(`📋 Total de PRs: ${totalPRs}`);
    console.log(`📝 Total de Commits: ${totalCommits}`);
    console.log(`🔍 Total de Reviews: ${totalReviews}`);
    console.log(`💬 Total de Comments: ${totalComments}`);
    console.log(`👥 Desenvolvedores ativos: ${totalDevelopers}`);
    console.log(`🔄 Jobs de sincronização: ${stats._count.syncJobs}`);
    
    if (repository.lastSyncAt) {
      const lastSync = new Date(repository.lastSyncAt);
      const now = new Date();
      const diffHours = Math.round((now - lastSync) / (1000 * 60 * 60));
      console.log(`⏰ Última sincronização: ${diffHours} horas atrás`);
    }
    
    console.log('\n✅ Visualização concluída!');
    
  } catch (error) {
    console.error('❌ Erro ao visualizar dados:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o script
viewBServerData();
