const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testBServerSyncFixed() {
  console.log('🔍 Testando sincronização do BServer com correções...');
  
  try {
    // Buscar o repositório BServer
    const repository = await prisma.repository.findFirst({
      where: { name: 'BServer' }
    });
    
    if (!repository) {
      console.log('❌ Repositório BServer não encontrado');
      return;
    }
    
    console.log(`📋 Repositório encontrado: ${repository.name}`);
    console.log(`🔗 URL: ${repository.url}`);
    console.log(`📅 Última sincronização: ${repository.lastSyncAt || 'Nunca'}`);
    
    // Verificar dados atuais
    const pullRequestsCount = await prisma.pullRequest.count({
      where: { repositoryId: repository.id }
    });
    
    console.log(`\n📊 PRs atualmente no banco: ${pullRequestsCount}`);
    
    // Iniciar uma nova sincronização
    console.log('\n🔄 Iniciando nova sincronização...');
    
    const response = await axios.post(`http://localhost:8080/api/sync/${repository.id}`, {
      syncType: 'full'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 300000 // 5 minutos
    });
    
    console.log('✅ Sincronização iniciada com sucesso');
    console.log(`📋 Job ID: ${response.data.jobId}`);
    
    // Aguardar um pouco e verificar o progresso
    console.log('\n⏳ Aguardando processamento...');
    await new Promise(resolve => setTimeout(resolve, 30000)); // 30 segundos
    
    // Verificar dados após sincronização
    const newPullRequestsCount = await prisma.pullRequest.count({
      where: { repositoryId: repository.id }
    });
    
    console.log(`\n📊 PRs após sincronização: ${newPullRequestsCount}`);
    console.log(`📈 Diferença: ${newPullRequestsCount - pullRequestsCount}`);
    
    // Verificar jobs recentes
    const recentJobs = await prisma.syncJob.findMany({
      where: { repositoryId: repository.id },
      orderBy: { createdAt: 'desc' },
      take: 3
    });
    
    console.log('\n📋 Jobs recentes:');
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
testBServerSyncFixed();
