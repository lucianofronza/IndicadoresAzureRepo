const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testReviewsCommentsSync() {
  console.log('🔍 Testando sincronização de reviews e comments...\n');
  
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
    
    // Verificar dados atuais
    const currentPRs = await prisma.pullRequest.count({
      where: { repositoryId: repository.id }
    });
    
    const currentCommits = await prisma.commit.count({
      where: { repositoryId: repository.id }
    });
    
    const currentReviews = await prisma.review.count({
      where: {
        pullRequest: { repositoryId: repository.id }
      }
    });
    
    const currentComments = await prisma.comment.count({
      where: {
        pullRequest: { repositoryId: repository.id }
      }
    });
    
    console.log(`📊 Dados atuais:`);
    console.log(`  - Pull Requests: ${currentPRs}`);
    console.log(`  - Commits: ${currentCommits}`);
    console.log(`  - Reviews: ${currentReviews}`);
    console.log(`  - Comments: ${currentComments}`);
    
    // Iniciar uma sincronização incremental
    console.log('\n🔄 Iniciando sincronização INCREMENTAL (inclui reviews e comments)...');
    
    const response = await axios.post(`http://localhost:8080/api/sync/${repository.id}`, {
      syncType: 'incremental'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 300000 // 5 minutos
    });
    
    console.log('✅ Sincronização incremental iniciada com sucesso');
    console.log(`📋 Job ID: ${response.data.data?.id || 'N/A'}`);
    
    // Aguardar processamento
    console.log('\n⏳ Aguardando processamento...');
    await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minuto
    
    // Verificar dados após sincronização
    const newPRs = await prisma.pullRequest.count({
      where: { repositoryId: repository.id }
    });
    
    const newCommits = await prisma.commit.count({
      where: { repositoryId: repository.id }
    });
    
    const newReviews = await prisma.review.count({
      where: {
        pullRequest: { repositoryId: repository.id }
      }
    });
    
    const newComments = await prisma.comment.count({
      where: {
        pullRequest: { repositoryId: repository.id }
      }
    });
    
    console.log(`\n📊 Dados após sincronização incremental:`);
    console.log(`  - Pull Requests: ${newPRs} (diferença: ${newPRs - currentPRs})`);
    console.log(`  - Commits: ${newCommits} (diferença: ${newCommits - currentCommits})`);
    console.log(`  - Reviews: ${newReviews} (diferença: ${newReviews - currentReviews})`);
    console.log(`  - Comments: ${newComments} (diferença: ${newComments - currentComments})`);
    
    // Verificar se houve mudanças
    if (newPRs > currentPRs) {
      console.log('\n📈 Novos PRs detectados!');
    }
    
    if (newCommits > currentCommits) {
      console.log('📈 Novos commits detectados!');
    }
    
    if (newReviews > currentReviews) {
      console.log('📈 Novos reviews detectados!');
    }
    
    if (newComments > currentComments) {
      console.log('📈 Novos comments detectados!');
    }
    
    if (newPRs === currentPRs && newCommits === currentCommits && 
        newReviews === currentReviews && newComments === currentComments) {
      console.log('\n✅ Nenhum novo dado detectado (esperado se não houver atividade recente)');
    }
    
    // Verificar alguns reviews recentes
    if (newReviews > 0) {
      console.log('\n🔍 Últimos 3 reviews:');
      const recentReviews = await prisma.review.findMany({
        where: {
          pullRequest: { repositoryId: repository.id }
        },
        include: {
          reviewer: { select: { name: true, login: true } },
          pullRequest: { select: { title: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 3
      });
      
      recentReviews.forEach((review, index) => {
        console.log(`${index + 1}. PR: ${review.pullRequest.title.substring(0, 50)}${review.pullRequest.title.length > 50 ? '...' : ''}`);
        console.log(`   👤 Reviewer: ${review.reviewer.name} (${review.reviewer.login})`);
        console.log(`   📊 Status: ${review.status}, Vote: ${review.vote}`);
        console.log(`   📅 Data: ${review.createdAt.toLocaleDateString('pt-BR')}`);
        console.log('');
      });
    }
    
    // Verificar alguns comments recentes
    if (newComments > 0) {
      console.log('\n💬 Últimos 3 comments:');
      const recentComments = await prisma.comment.findMany({
        where: {
          pullRequest: { repositoryId: repository.id }
        },
        include: {
          author: { select: { name: true, login: true } },
          pullRequest: { select: { title: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 3
      });
      
      recentComments.forEach((comment, index) => {
        console.log(`${index + 1}. PR: ${comment.pullRequest.title.substring(0, 50)}${comment.pullRequest.title.length > 50 ? '...' : ''}`);
        console.log(`   👤 Autor: ${comment.author.name} (${comment.author.login})`);
        console.log(`   💬 Comentário: ${comment.content.substring(0, 80)}${comment.content.length > 80 ? '...' : ''}`);
        console.log(`   📅 Data: ${comment.createdAt.toLocaleDateString('pt-BR')}`);
        console.log('');
      });
    }
    
    // Verificar jobs recentes
    const recentJobs = await prisma.syncJob.findMany({
      where: { repositoryId: repository.id },
      orderBy: { createdAt: 'desc' },
      take: 3
    });
    
    console.log('📋 Jobs recentes:');
    recentJobs.forEach(job => {
      console.log(`  - ${job.status} (${job.syncType}) - ${job.createdAt}`);
      if (job.error) {
        console.log(`    Erro: ${job.error}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o teste
testReviewsCommentsSync();
