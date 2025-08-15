const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Configurações
const REPOSITORY_ID = 'cmea46o3l020esq3zk7ylfcbl'; // BennerLicense
const NUM_PULL_REQUESTS = 8000; // Aumentado significativamente para ter 150-400 por dev
const DATE_RANGE_DAYS = 90; // Últimos 90 dias

// Função para gerar data aleatória
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Função para gerar número aleatório entre min e max
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Função para escolher item aleatório de um array
function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Função para distribuir desenvolvedores de forma mais equilibrada
function getBalancedDeveloper(developers, developerUsage, targetMin = 150, targetMax = 400) {
  // Verificar se há desenvolvedores disponíveis
  if (!developers || developers.length === 0) {
    throw new Error('Nenhum desenvolvedor disponível');
  }

  // Filtrar desenvolvedores que ainda não atingiram o mínimo
  const developersBelowMin = developers.filter(d => developerUsage[d.id] < targetMin);
  
  if (developersBelowMin.length > 0) {
    // Se há desenvolvedores abaixo do mínimo, priorizar eles
    const selectedDeveloper = randomChoice(developersBelowMin);
    developerUsage[selectedDeveloper.id]++;
    return selectedDeveloper;
  }

  // Se todos já atingiram o mínimo, distribuir entre os que não atingiram o máximo
  const developersBelowMax = developers.filter(d => developerUsage[d.id] < targetMax);
  
  if (developersBelowMax.length > 0) {
    // Escolher aleatoriamente entre os que não atingiram o máximo
    const selectedDeveloper = randomChoice(developersBelowMax);
    developerUsage[selectedDeveloper.id]++;
    return selectedDeveloper;
  }

  // Se todos atingiram o máximo, distribuir aleatoriamente
  const selectedDeveloper = randomChoice(developers);
  developerUsage[selectedDeveloper.id]++;
  return selectedDeveloper;
}

// Títulos de PRs para gerar dados realistas
const PR_TITLES = [
  'feat: adicionar nova funcionalidade de licenciamento',
  'fix: corrigir bug na validação de licença',
  'refactor: melhorar performance do sistema',
  'docs: atualizar documentação da API',
  'test: adicionar testes unitários',
  'chore: atualizar dependências',
  'style: ajustar formatação do código',
  'perf: otimizar consultas ao banco',
  'ci: configurar pipeline de CI/CD',
  'build: ajustar configuração de build',
  'feat: implementar cache de licenças',
  'fix: resolver problema de concorrência',
  'refactor: simplificar lógica de validação',
  'docs: adicionar exemplos de uso',
  'test: aumentar cobertura de testes',
  'chore: limpar código não utilizado',
  'style: aplicar padrões de código',
  'perf: reduzir tempo de resposta',
  'ci: adicionar testes automatizados',
  'build: otimizar tamanho do bundle',
  'feat: adicionar validação de entrada',
  'fix: corrigir erro de timeout',
  'refactor: extrair componentes',
  'docs: atualizar README',
  'test: corrigir testes quebrados',
  'chore: atualizar versões',
  'style: aplicar linting',
  'perf: otimizar algoritmos',
  'ci: configurar deploy automático',
  'build: ajustar webpack',
  'feat: implementar autenticação',
  'fix: resolver bug de cache',
  'refactor: reorganizar estrutura',
  'docs: adicionar diagramas',
  'test: implementar testes E2E',
  'chore: configurar ambiente',
  'style: padronizar código',
  'perf: melhorar queries',
  'ci: adicionar validações',
  'build: otimizar assets'
];

// Conteúdos de comentários
const COMMENT_CONTENTS = [
  'Ótimo trabalho! 👍',
  'Precisa de alguns ajustes menores',
  'LGTM! Pode fazer merge',
  'Sugestão: considere adicionar mais testes',
  'Código muito limpo, parabéns!',
  'Há um pequeno problema aqui',
  'Funcionalidade implementada corretamente',
  'Boa refatoração!',
  'Precisamos revisar esta abordagem',
  'Excelente documentação!',
  'Algumas melhorias sugeridas',
  'Código aprovado!',
  'Muito bem estruturado',
  'Faltam alguns detalhes',
  'Implementação sólida',
  'Boa ideia!',
  'Precisa de mais contexto',
  'Funciona perfeitamente',
  'Aprovação condicional',
  'Muito bem documentado',
  'Sugestão de melhoria',
  'Código limpo e eficiente',
  'Boa prática aplicada',
  'Precisa de ajustes',
  'Excelente solução!',
  'Bem estruturado',
  'Aprovado com sugestões',
  'Muito bom trabalho',
  'Precisa de revisão',
  'Implementação correta'
];

async function generateTestData() {
  console.log('🚀 Iniciando geração de dados de teste...');

  try {
    // Buscar desenvolvedores existentes
    const developers = await prisma.developer.findMany({
      include: {
        team: true,
        role: true,
        stacks: true
      }
    });

    if (developers.length === 0) {
      throw new Error('Nenhum desenvolvedor encontrado no banco');
    }

    console.log(`📊 Encontrados ${developers.length} desenvolvedores`);

    // Definir período de datas
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (DATE_RANGE_DAYS * 24 * 60 * 60 * 1000));

    console.log(`📅 Gerando dados entre ${startDate.toISOString().split('T')[0]} e ${endDate.toISOString().split('T')[0]}`);

    // Controle de uso dos desenvolvedores para distribuição equilibrada
    const developerUsage = {};
    developers.forEach(d => developerUsage[d.id] = 0);

    // Gerar Pull Requests com distribuição equilibrada
    const pullRequests = [];
    for (let i = 0; i < NUM_PULL_REQUESTS; i++) {
      const createdDate = randomDate(startDate, endDate);
      const status = randomChoice(['active', 'completed', 'closed']);
      
      let closedDate = null;
      let mergedDate = null;
      let cycleTimeDays = null;
      let reviewTimeDays = null;

      if (status === 'completed') {
        mergedDate = randomDate(createdDate, endDate);
        cycleTimeDays = (mergedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
        reviewTimeDays = randomInt(1, 7); // 1-7 dias para review
      } else if (status === 'closed') {
        closedDate = randomDate(createdDate, endDate);
        cycleTimeDays = (closedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      }

      // Usar distribuição equilibrada de desenvolvedores (150-400 por dev)
      const developer = getBalancedDeveloper(developers, developerUsage, 150, 400);
      
      const pr = {
        azureId: 1000000 + i,
        title: randomChoice(PR_TITLES),
        description: `Descrição do PR ${i + 1}`,
        status,
        sourceBranch: `feature/PR-${i + 1}`,
        targetBranch: 'main',
        createdAt: createdDate,
        updatedAt: new Date(),
        closedAt: closedDate,
        mergedAt: mergedDate,
        cycleTimeDays,
        reviewTimeDays,
        filesChanged: randomInt(1, 15),
        linesAdded: randomInt(10, 200),
        linesDeleted: randomInt(0, 50),
        isDraft: Math.random() < 0.1, // 10% chance de ser draft
        repositoryId: REPOSITORY_ID,
        createdById: developer.id
      };

      pullRequests.push(pr);
    }

    console.log(`📝 Criando ${pullRequests.length} Pull Requests...`);
    
    // Inserir Pull Requests
    const createdPRs = await prisma.pullRequest.createMany({
      data: pullRequests,
      skipDuplicates: true
    });

    console.log(`✅ ${createdPRs.count} Pull Requests criados`);

    // Mostrar distribuição de PRs por desenvolvedor
    console.log('\n📊 Distribuição de PRs por desenvolvedor:');
    Object.entries(developerUsage).forEach(([devId, count]) => {
      const dev = developers.find(d => d.id === devId);
      console.log(`   • ${dev?.name || devId}: ${count} PRs`);
    });

    // Buscar PRs criados para gerar reviews e comments
    const createdPRsData = await prisma.pullRequest.findMany({
      where: {
        repositoryId: REPOSITORY_ID,
        azureId: {
          gte: 1000000
        }
      }
    });

    console.log(`\n🔍 Encontrados ${createdPRsData.length} PRs para adicionar reviews e comments`);

    // Gerar Reviews com distribuição equilibrada
    const reviews = [];
    const reviewUsage = {};
    developers.forEach(d => reviewUsage[d.id] = 0);

    for (const pr of createdPRsData) {
      const numReviews = randomInt(1, 4); // 1-4 reviews por PR
      
      for (let j = 0; j < numReviews; j++) {
        // Escolher reviewer diferente do autor e com distribuição equilibrada
        const availableReviewers = developers.filter(d => d.id !== pr.createdById);
        const reviewer = getBalancedDeveloper(availableReviewers, reviewUsage, 150, 400);
        const reviewDate = randomDate(pr.createdAt, new Date());
        
        const review = {
          azureId: 2000000 + reviews.length,
          status: randomChoice(['approved', 'rejected', 'waitForAuthor']),
          vote: randomChoice([10, -10, 0]),
          createdAt: reviewDate,
          updatedAt: reviewDate,
          pullRequestId: pr.id,
          reviewerId: reviewer.id
        };
        
        reviews.push(review);
      }
    }

    console.log(`👀 Criando ${reviews.length} Reviews...`);
    
    const createdReviews = await prisma.review.createMany({
      data: reviews,
      skipDuplicates: true
    });

    console.log(`✅ ${createdReviews.count} Reviews criados`);

    // Gerar Comments com distribuição equilibrada
    const comments = [];
    const commentUsage = {};
    developers.forEach(d => commentUsage[d.id] = 0);

    for (const pr of createdPRsData) {
      const numComments = randomInt(0, 6); // 0-6 comments por PR
      
      for (let j = 0; j < numComments; j++) {
        const author = getBalancedDeveloper(developers, commentUsage, 150, 400);
        const commentDate = randomDate(pr.createdAt, new Date());
        
        const comment = {
          azureId: 3000000 + comments.length,
          content: randomChoice(COMMENT_CONTENTS),
          createdAt: commentDate,
          updatedAt: commentDate,
          pullRequestId: pr.id,
          authorId: author.id
        };
        
        comments.push(comment);
      }
    }

    console.log(`💬 Criando ${comments.length} Comments...`);
    
    const createdComments = await prisma.comment.createMany({
      data: comments,
      skipDuplicates: true
    });

    console.log(`✅ ${createdComments.count} Comments criados`);

    // Gerar Commits com distribuição equilibrada
    const commits = [];
    const commitUsage = {};
    developers.forEach(d => commitUsage[d.id] = 0);

    for (const pr of createdPRsData) {
      const numCommits = randomInt(1, 8); // 1-8 commits por PR
      
      for (let j = 0; j < numCommits; j++) {
        const commitDate = randomDate(pr.createdAt, pr.mergedAt || new Date());
        
        const commit = {
          azureId: `commit-${4000000 + commits.length}`,
          message: `feat: implementação ${j + 1} do PR ${pr.azureId}`,
          hash: `abc123def456${commits.length.toString().padStart(6, '0')}`,
          createdAt: commitDate,
          repositoryId: REPOSITORY_ID,
          authorId: pr.createdById
        };
        
        commits.push(commit);
        commitUsage[pr.createdById]++;
      }
    }

    console.log(`🔧 Criando ${commits.length} Commits...`);
    
    const createdCommits = await prisma.commit.createMany({
      data: commits,
      skipDuplicates: true
    });

    console.log(`✅ ${createdCommits.count} Commits criados`);

    // Atualizar lastSyncAt do repositório
    await prisma.repository.update({
      where: { id: REPOSITORY_ID },
      data: { lastSyncAt: new Date() }
    });

    console.log('🎉 Geração de dados de teste concluída com sucesso!');
    
    // Resumo final
    const summary = await prisma.pullRequest.aggregate({
      where: { repositoryId: REPOSITORY_ID },
      _count: { id: true },
      _avg: { cycleTimeDays: true }
    });

    console.log('\n📊 Resumo dos dados gerados:');
    console.log(`   • Pull Requests: ${summary._count.id}`);
    console.log(`   • Reviews: ${reviews.length}`);
    console.log(`   • Comments: ${comments.length}`);
    console.log(`   • Commits: ${commits.length}`);
    console.log(`   • Cycle Time Médio: ${summary._avg.cycleTimeDays?.toFixed(2) || 0} dias`);

    // Mostrar distribuição final
    console.log('\n📈 Distribuição final por desenvolvedor:');
    console.log('   PRs | Reviews | Comments | Commits | Desenvolvedor');
    console.log('   ----|---------|----------|---------|-------------');
    developers.forEach(dev => {
      const prCount = developerUsage[dev.id] || 0;
      const reviewCount = reviewUsage[dev.id] || 0;
      const commentCount = commentUsage[dev.id] || 0;
      const commitCount = commitUsage[dev.id] || 0;
      console.log(`   ${prCount.toString().padStart(3)} | ${reviewCount.toString().padStart(7)} | ${commentCount.toString().padStart(8)} | ${commitCount.toString().padStart(7)} | ${dev.name}`);
    });

  } catch (error) {
    console.error('❌ Erro ao gerar dados de teste:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o script
if (require.main === module) {
  generateTestData()
    .then(() => {
      console.log('✅ Script executado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro na execução do script:', error);
      process.exit(1);
    });
}

module.exports = { generateTestData };
