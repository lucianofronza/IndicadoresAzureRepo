const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

// Função de criptografia simples para o seed
function encrypt(text) {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-key-32-chars-long', 'utf8');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

const prisma = new PrismaClient();

// Configurações
const NUM_PULL_REQUESTS = 200; // Reduzido para dados mais realistas
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
  'build: otimizar tamanho do bundle'
];

// Status de PRs
const PR_STATUSES = ['active', 'completed', 'abandoned'];

// Status de reviews
const REVIEW_STATUSES = ['approved', 'rejected', 'waiting_for_author'];

// Comentários de reviews
const REVIEW_COMMENTS = [
  'LGTM! 👍',
  'Precisa de alguns ajustes',
  'Excelente trabalho!',
  'Por favor, adicione testes',
  'Código muito limpo',
  'Boa implementação',
  'Sugestão de melhoria',
  'Aprovado com sugestões',
  'Perfeito!',
  'Muito bem estruturado'
];

// Comentários de PRs
const PR_COMMENTS = [
  'Iniciando implementação da funcionalidade',
  'Adicionei testes unitários',
  'Corrigindo feedback do review',
  'Ajustando formatação do código',
  'Implementando sugestões do time',
  'Resolvendo conflitos de merge',
  'Adicionando documentação',
  'Otimizando performance',
  'Corrigindo bugs identificados',
  'Finalizando implementação',
  'Adicionando logs para debug',
  'Melhorando tratamento de erros',
  'Refatorando código legado',
  'Implementando validações',
  'Adicionando configurações'
];

// Tipos de arquivos comuns
const FILE_EXTENSIONS = [
  '.ts', '.js', '.tsx', '.jsx', '.vue', '.svelte',
  '.css', '.scss', '.sass', '.less',
  '.json', '.yaml', '.yml',
  '.md', '.txt',
  '.sql', '.prisma',
  '.dockerfile', '.dockerignore',
  '.gitignore', '.env.example'
];

// Nomes de arquivos comuns
const FILE_NAMES = [
  'index', 'app', 'main', 'config', 'utils', 'helpers',
  'types', 'interfaces', 'models', 'services', 'controllers',
  'middleware', 'routes', 'components', 'pages', 'hooks',
  'store', 'reducers', 'actions', 'selectors',
  'database', 'migration', 'seed', 'test', 'spec'
];

// Função para gerar nome de arquivo realista
function generateFileName() {
  const name = randomChoice(FILE_NAMES);
  const ext = randomChoice(FILE_EXTENSIONS);
  const prefix = randomChoice(['src/', 'lib/', 'utils/', 'components/', 'pages/', 'api/', 'config/', 'tests/']);
  return `${prefix}${name}${ext}`;
}

async function seedDatabase() {
  try {
    console.log('🌱 Iniciando população do banco de dados...');

    // 1. Criar Times
    console.log('\n👥 Criando times...');
    const teams = await Promise.all([
      prisma.team.upsert({
        where: { name: 'Backend' },
        update: {},
        create: { name: 'Backend', management: 'Tech Lead' }
      }),
      prisma.team.upsert({
        where: { name: 'Frontend' },
        update: {},
        create: { name: 'Frontend', management: 'Tech Lead' }
      }),
      prisma.team.upsert({
        where: { name: 'DevOps' },
        update: {},
        create: { name: 'DevOps', management: 'Tech Lead' }
      }),
      prisma.team.upsert({
        where: { name: 'QA' },
        update: {},
        create: { name: 'QA', management: 'QA Lead' }
      })
    ]);
    console.log(`✅ ${teams.length} times criados`);

    // 2. Criar Cargos
    console.log('\n💼 Criando cargos...');
    const roles = await Promise.all([
      prisma.role.upsert({
        where: { name: 'Desenvolvedor' },
        update: {},
        create: { name: 'Desenvolvedor' }
      }),
      prisma.role.upsert({
        where: { name: 'Tech Lead' },
        update: {},
        create: { name: 'Tech Lead' }
      }),
      prisma.role.upsert({
        where: { name: 'QA Engineer' },
        update: {},
        create: { name: 'QA Engineer' }
      }),
      prisma.role.upsert({
        where: { name: 'DevOps Engineer' },
        update: {},
        create: { name: 'DevOps Engineer' }
      })
    ]);
    console.log(`✅ ${roles.length} cargos criados`);

    // 3. Criar Stacks
    console.log('\n🛠️ Criando stacks...');
    const stacks = await Promise.all([
      prisma.stack.upsert({
        where: { name: 'Node.js' },
        update: {},
        create: { name: 'Node.js', color: '#68a063' }
      }),
      prisma.stack.upsert({
        where: { name: 'React' },
        update: {},
        create: { name: 'React', color: '#61dafb' }
      }),
      prisma.stack.upsert({
        where: { name: 'TypeScript' },
        update: {},
        create: { name: 'TypeScript', color: '#3178c6' }
      }),
      prisma.stack.upsert({
        where: { name: 'PostgreSQL' },
        update: {},
        create: { name: 'PostgreSQL', color: '#336791' }
      }),
      prisma.stack.upsert({
        where: { name: 'Docker' },
        update: {},
        create: { name: 'Docker', color: '#2496ed' }
      }),
      prisma.stack.upsert({
        where: { name: 'Azure DevOps' },
        update: {},
        create: { name: 'Azure DevOps', color: '#0078d4' }
      })
    ]);
    console.log(`✅ ${stacks.length} stacks criadas`);

    // 4. Criar Desenvolvedores
    console.log('\n👨‍💻 Criando desenvolvedores...');
    const developers = await Promise.all([
      prisma.developer.upsert({
        where: { email: 'joao.silva@company.com' },
        update: {},
        create: {
          name: 'João Silva',
          email: 'joao.silva@company.com',
          login: 'joao.silva',
          teamId: teams[0].id, // Backend
          roleId: roles[0].id, // Desenvolvedor
          stacks: { connect: [{ id: stacks[0].id }, { id: stacks[2].id }, { id: stacks[3].id }] } // Node.js, TypeScript, PostgreSQL
        }
      }),
      prisma.developer.upsert({
        where: { email: 'maria.santos@company.com' },
        update: {},
        create: {
          name: 'Maria Santos',
          email: 'maria.santos@company.com',
          login: 'maria.santos',
          teamId: teams[1].id, // Frontend
          roleId: roles[0].id, // Desenvolvedor
          stacks: { connect: [{ id: stacks[1].id }, { id: stacks[2].id }] } // React, TypeScript
        }
      }),
      prisma.developer.upsert({
        where: { email: 'pedro.oliveira@company.com' },
        update: {},
        create: {
          name: 'Pedro Oliveira',
          email: 'pedro.oliveira@company.com',
          login: 'pedro.oliveira',
          teamId: teams[2].id, // DevOps
          roleId: roles[3].id, // DevOps Engineer
          stacks: { connect: [{ id: stacks[4].id }, { id: stacks[5].id }] } // Docker, Azure DevOps
        }
      }),
      prisma.developer.upsert({
        where: { email: 'ana.costa@company.com' },
        update: {},
        create: {
          name: 'Ana Costa',
          email: 'ana.costa@company.com',
          login: 'ana.costa',
          teamId: teams[3].id, // QA
          roleId: roles[2].id, // QA Engineer
          stacks: { connect: [{ id: stacks[1].id }, { id: stacks[2].id }] } // React, TypeScript
        }
      }),
      prisma.developer.upsert({
        where: { email: 'carlos.rodrigues@company.com' },
        update: {},
        create: {
          name: 'Carlos Rodrigues',
          email: 'carlos.rodrigues@company.com',
          login: 'carlos.rodrigues',
          teamId: teams[0].id, // Backend
          roleId: roles[1].id, // Tech Lead
          stacks: { connect: [{ id: stacks[0].id }, { id: stacks[2].id }, { id: stacks[3].id }] } // Node.js, TypeScript, PostgreSQL
        }
      })
    ]);
    console.log(`✅ ${developers.length} desenvolvedores criados`);

    // 5. Criar Repositórios
    console.log('\n📦 Criando repositórios...');
    const repositories = await Promise.all([
      prisma.repository.upsert({
        where: { url: 'https://dev.azure.com/bennertec/BServer/_git/BServer' },
        update: {},
        create: {
          name: 'BServer',
          url: 'https://dev.azure.com/bennertec/BServer/_git/BServer',
          organization: 'bennertec',
          project: 'BServer',
          azureId: 'bserver-repo-id',
          personalAccessToken: encrypt('sample-token-for-demo') // Token de exemplo criptografado
        }
      }),
      prisma.repository.upsert({
        where: { url: 'https://dev.azure.com/bennertec/BServer/_git/BennerLicense' },
        update: {},
        create: {
          name: 'BennerLicense',
          url: 'https://dev.azure.com/bennertec/BServer/_git/BennerLicense',
          organization: 'bennertec',
          project: 'BServer',
          azureId: 'bennerlicense-repo-id',
          personalAccessToken: encrypt('sample-token-for-demo') // Token de exemplo criptografado
        }
      }),
      prisma.repository.upsert({
        where: { url: 'https://dev.azure.com/bennertec/Frontend/_git/Frontend-App' },
        update: {},
        create: {
          name: 'Frontend-App',
          url: 'https://dev.azure.com/bennertec/Frontend/_git/Frontend-App',
          organization: 'bennertec',
          project: 'Frontend',
          azureId: 'frontend-app-repo-id',
          personalAccessToken: encrypt('sample-token-for-demo') // Token de exemplo criptografado
        }
      })
    ]);
    console.log(`✅ ${repositories.length} repositórios criados`);

    // 6. Gerar Pull Requests para cada repositório
    for (const repository of repositories) {
      console.log(`\n📝 Gerando Pull Requests para ${repository.name}...`);
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - DATE_RANGE_DAYS);
      const endDate = new Date();

      const pullRequests = [];
      const developerUsage = {};
      developers.forEach(d => developerUsage[d.id] = 0);

      for (let i = 0; i < NUM_PULL_REQUESTS; i++) {
        const createdAt = randomDate(startDate, endDate);
        const isCompleted = Math.random() > 0.3; // 70% completados
        const mergedAt = isCompleted ? randomDate(createdAt, endDate) : null;
        const status = isCompleted ? 'completed' : randomChoice(PR_STATUSES);
        
        const cycleTimeDays = mergedAt ? 
          Math.ceil((mergedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 
          null;

        const createdBy = randomChoice(developers);
        developerUsage[createdBy.id]++;

        // Gerar dados de arquivos alterados
        const filesChanged = randomInt(1, 15);
        const linesAdded = randomInt(10, 500);
        const linesDeleted = randomInt(0, Math.floor(linesAdded * 0.3)); // Geralmente menos linhas deletadas

        const pr = {
          azureId: 10000 + (repositories.indexOf(repository) * NUM_PULL_REQUESTS) + i + 1,
          title: randomChoice(PR_TITLES),
          description: `Descrição do PR ${i + 1} para ${repository.name}`,
          status: status,
          sourceBranch: `feature/pr-${i + 1}`,
          targetBranch: 'main',
          createdAt: createdAt,
          updatedAt: randomDate(createdAt, endDate),
          mergedAt: mergedAt,
          cycleTimeDays: cycleTimeDays,
          filesChanged: filesChanged,
          linesAdded: linesAdded,
          linesDeleted: linesDeleted,
          isDraft: Math.random() > 0.8, // 20% são drafts
          repositoryId: repository.id,
          createdById: createdBy.id
        };

        pullRequests.push(pr);
      }

      const createdPRs = await prisma.pullRequest.createMany({
        data: pullRequests,
        skipDuplicates: true
      });

      console.log(`✅ ${createdPRs.count} Pull Requests criados para ${repository.name}`);

      // 7. Gerar Reviews para os PRs
      const createdPRsData = await prisma.pullRequest.findMany({
        where: { repositoryId: repository.id },
        select: { id: true, azureId: true, createdById: true, createdAt: true, mergedAt: true }
      });

      const reviews = [];
      const reviewUsage = {};
      developers.forEach(d => reviewUsage[d.id] = 0);

      for (const pr of createdPRsData) {
        const numReviews = randomInt(1, 3); // 1-3 reviews por PR
        
        for (let j = 0; j < numReviews; j++) {
          const reviewer = randomChoice(developers.filter(d => d.id !== pr.createdById));
          const reviewDate = randomDate(pr.createdAt, pr.mergedAt || new Date());
          
          const review = {
            azureId: pr.azureId * 10 + j + 1,
            status: randomChoice(REVIEW_STATUSES),
            vote: randomChoice([1, 5, 10]), // Azure DevOps vote values
            createdAt: reviewDate,
            updatedAt: reviewDate,
            pullRequestId: pr.id,
            reviewerId: reviewer.id
          };
          
          reviews.push(review);
          reviewUsage[reviewer.id]++;
        }
      }

      const createdReviews = await prisma.review.createMany({
        data: reviews,
        skipDuplicates: true
      });

      console.log(`✅ ${createdReviews.count} Reviews criados para ${repository.name}`);

      // 8. Gerar Comentários para os PRs
      const comments = [];
      const commentUsage = {};
      developers.forEach(d => commentUsage[d.id] = 0);

      for (const pr of createdPRsData) {
        const numComments = randomInt(0, 8); // 0-8 comentários por PR
        
        for (let j = 0; j < numComments; j++) {
          const author = randomChoice(developers);
          const commentDate = randomDate(pr.createdAt, pr.mergedAt || new Date());
          
          const comment = {
            azureId: pr.azureId * 100 + j + 1,
            content: randomChoice(PR_COMMENTS),
            createdAt: commentDate,
            updatedAt: commentDate,
            pullRequestId: pr.id,
            authorId: author.id
          };
          
          comments.push(comment);
          commentUsage[author.id]++;
        }
      }

      const createdComments = await prisma.comment.createMany({
        data: comments,
        skipDuplicates: true
      });

      console.log(`✅ ${createdComments.count} Comentários criados para ${repository.name}`);

      // 9. Gerar Commits para os PRs
      const commits = [];
      const commitUsage = {};
      developers.forEach(d => commitUsage[d.id] = 0);

      for (const pr of createdPRsData) {
        const numCommits = randomInt(1, 5); // 1-5 commits por PR
        
        for (let j = 0; j < numCommits; j++) {
          const commitDate = randomDate(pr.createdAt, pr.mergedAt || new Date());
          
          const commit = {
            azureId: `commit-${pr.azureId}-${j + 1}`,
            message: `feat: implementação ${j + 1} do PR ${pr.azureId}`,
            hash: `abc123def456${commits.length.toString().padStart(6, '0')}`,
            createdAt: commitDate,
            repositoryId: repository.id,
            authorId: pr.createdById
          };
          
          commits.push(commit);
          commitUsage[pr.createdById]++;
        }
      }

      const createdCommits = await prisma.commit.createMany({
        data: commits,
        skipDuplicates: true
      });

      console.log(`✅ ${createdCommits.count} Commits criados para ${repository.name}`);

      // Atualizar lastSyncAt do repositório
      await prisma.repository.update({
        where: { id: repository.id },
        data: { lastSyncAt: new Date() }
      });
    }

    console.log('\n🎉 População do banco de dados concluída com sucesso!');
    
    // Resumo final
    const summary = await prisma.pullRequest.aggregate({
      _count: { id: true },
      _avg: { cycleTimeDays: true }
    });

    const totalReviews = await prisma.review.count();
    const totalComments = await prisma.comment.count();
    const totalCommits = await prisma.commit.count();

    console.log('\n📊 Resumo dos dados criados:');
    console.log(`   • Times: ${teams.length}`);
    console.log(`   • Cargos: ${roles.length}`);
    console.log(`   • Stacks: ${stacks.length}`);
    console.log(`   • Desenvolvedores: ${developers.length}`);
    console.log(`   • Repositórios: ${repositories.length}`);
    console.log(`   • Pull Requests: ${summary._count.id}`);
    console.log(`   • Reviews: ${totalReviews}`);
    console.log(`   • Comentários: ${totalComments}`);
    console.log(`   • Commits: ${totalCommits}`);
    console.log(`   • Cycle Time Médio: ${summary._avg.cycleTimeDays?.toFixed(2) || 0} dias`);

    console.log('\n🔗 URLs da aplicação:');
    console.log('   • Frontend: http://localhost:5173');
    console.log('   • Backend API: http://localhost:8080');
    console.log('   • Health Check: http://localhost:8080/healthz');

  } catch (error) {
    console.error('❌ Erro ao popular banco de dados:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o script
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('✅ Script executado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro na execução do script:', error);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
