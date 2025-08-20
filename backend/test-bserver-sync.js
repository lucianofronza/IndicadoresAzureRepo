const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { decrypt } = require('./src/utils/encryption');

const prisma = new PrismaClient();

async function testBServerSync() {
  console.log('🔍 Testando sincronização do BServer...');
  
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
    
    // Verificar jobs de sincronização recentes
    const recentJobs = await prisma.syncJob.findMany({
      where: { repositoryId: repository.id },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    console.log('\n📊 Jobs de sincronização recentes:');
    recentJobs.forEach(job => {
      console.log(`  - ${job.status} (${job.syncType}) - ${job.createdAt}`);
      if (job.error) {
        console.log(`    Erro: ${job.error}`);
      }
    });
    
    // Testar conexão com Azure DevOps
    console.log('\n🔗 Testando conexão com Azure DevOps...');
    
    if (!repository.personalAccessToken) {
      console.log('❌ Token do Azure DevOps não configurado para este repositório');
      return;
    }
    
    const token = decrypt(repository.personalAccessToken);
    
    const baseUrl = `https://dev.azure.com/${repository.organization}/${repository.project}/_apis/git`;
    const testUrl = `${baseUrl}/pullrequests?api-version=7.0&$top=1&searchCriteria.status=all`;
    
    try {
      const response = await axios.get(testUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${token}`).toString('base64')}`,
          'Accept': 'application/json',
        },
        timeout: 10000,
      });
      
      console.log('✅ Conexão com Azure DevOps OK');
      console.log(`📊 Total de PRs disponíveis: ${response.data.count || 'N/A'}`);
      
      if (response.data.value && response.data.value.length > 0) {
        const samplePR = response.data.value[0];
        console.log(`📝 Exemplo de PR: ${samplePR.title} (ID: ${samplePR.pullRequestId})`);
      }
      
    } catch (error) {
      console.log('❌ Erro na conexão com Azure DevOps:');
      console.log(`   Status: ${error.response?.status}`);
      console.log(`   Mensagem: ${error.response?.data?.message || error.message}`);
    }
    
    // Verificar dados já sincronizados
    const pullRequestsCount = await prisma.pullRequest.count({
      where: { repositoryId: repository.id }
    });
    
    const commitsCount = await prisma.commit.count({
      where: { repositoryId: repository.id }
    });
    
    console.log('\n📈 Dados já sincronizados:');
    console.log(`  - Pull Requests: ${pullRequestsCount}`);
    console.log(`  - Commits: ${commitsCount}`);
    
    // Recomendações
    console.log('\n💡 Recomendações:');
    
    if (pullRequestsCount === 0) {
      console.log('  - Primeira sincronização: Use sincronização FULL');
      console.log('  - Pode demorar mais de 10 minutos');
    } else {
      console.log('  - Use sincronização INCREMENTAL para atualizações');
      console.log('  - Deve ser mais rápida');
    }
    
    if (recentJobs.some(job => job.status === 'failed' && job.error?.includes('timeout'))) {
      console.log('  - ⚠️  Timeouts detectados: Considere aumentar o timeout');
    }
    
    if (recentJobs.some(job => job.status === 'failed' && job.error?.includes('limit'))) {
      console.log('  - ⚠️  Limite de PRs atingido: Considere aumentar o limite');
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o teste
testBServerSync();
