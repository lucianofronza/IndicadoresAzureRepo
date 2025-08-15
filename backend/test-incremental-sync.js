const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testIncrementalSync() {
  console.log('🔍 Testando sincronização incremental do BServer...\n');
  
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
    
    console.log(`📊 Dados atuais:`);
    console.log(`  - Pull Requests: ${currentPRs}`);
    console.log(`  - Commits: ${currentCommits}`);
    
    // Iniciar uma sincronização incremental
    console.log('\n🔄 Iniciando sincronização INCREMENTAL...');
    
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
    await new Promise(resolve => setTimeout(resolve, 30000)); // 30 segundos
    
    // Verificar dados após sincronização
    const newPRs = await prisma.pullRequest.count({
      where: { repositoryId: repository.id }
    });
    
    const newCommits = await prisma.commit.count({
      where: { repositoryId: repository.id }
    });
    
    console.log(`\n📊 Dados após sincronização incremental:`);
    console.log(`  - Pull Requests: ${newPRs} (diferença: ${newPRs - currentPRs})`);
    console.log(`  - Commits: ${newCommits} (diferença: ${newCommits - currentCommits})`);
    
    // Verificar se houve mudanças
    if (newPRs > currentPRs) {
      console.log('\n📈 Novos PRs detectados na sincronização incremental!');
    } else {
      console.log('\n✅ Nenhum novo PR detectado (esperado para incremental)');
    }
    
    if (newCommits > currentCommits) {
      console.log('📈 Novos commits detectados na sincronização incremental!');
    } else {
      console.log('✅ Nenhum novo commit detectado (esperado se não houver novos commits)');
    }
    
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
    
    // Verificar se a lógica incremental está funcionando
    console.log('\n🔍 Análise da lógica incremental:');
    if (repository.lastSyncAt) {
      console.log(`✅ Repositório tem última sincronização: ${repository.lastSyncAt.toISOString()}`);
      console.log(`✅ Sincronização incremental deve buscar dados após: ${repository.lastSyncAt.toISOString()}`);
    } else {
      console.log(`⚠️  Repositório não tem última sincronização - deve fazer sincronização completa`);
    }
    
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
testIncrementalSync();
