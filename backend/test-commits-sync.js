const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testCommitsSync() {
  console.log('🔍 Testando sincronização de commits do BServer...\n');
  
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
    
    // Verificar commits atuais
    const commitsCount = await prisma.commit.count({
      where: { repositoryId: repository.id }
    });
    
    console.log(`📊 Commits atualmente no banco: ${commitsCount}`);
    
    // Iniciar uma sincronização FULL para incluir commits
    console.log('\n🔄 Iniciando sincronização FULL (inclui commits)...');
    
    const response = await axios.post(`http://localhost:8080/api/sync/${repository.id}`, {
      syncType: 'full'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 600000 // 10 minutos para sincronização completa
    });
    
    console.log('✅ Sincronização iniciada com sucesso');
    console.log(`📋 Job ID: ${response.data.data?.id || 'N/A'}`);
    
    // Aguardar processamento
    console.log('\n⏳ Aguardando processamento (pode demorar alguns minutos)...');
    await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minuto
    
    // Verificar commits após sincronização
    const newCommitsCount = await prisma.commit.count({
      where: { repositoryId: repository.id }
    });
    
    console.log(`\n📊 Commits após sincronização: ${newCommitsCount}`);
    console.log(`📈 Diferença: ${newCommitsCount - commitsCount}`);
    
    // Verificar alguns commits recentes
    if (newCommitsCount > 0) {
      console.log('\n📝 Últimos 5 commits:');
      const recentCommits = await prisma.commit.findMany({
        where: { repositoryId: repository.id },
        include: {
          author: { select: { name: true, login: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      });
      
      recentCommits.forEach((commit, index) => {
        console.log(`${index + 1}. ${commit.message.substring(0, 60)}${commit.message.length > 60 ? '...' : ''}`);
        console.log(`   👤 Autor: ${commit.author.name} (${commit.author.login})`);
        console.log(`   📅 Data: ${commit.createdAt.toLocaleDateString('pt-BR')}`);
        console.log(`   🔗 Hash: ${commit.hash.substring(0, 8)}`);
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
testCommitsSync();
