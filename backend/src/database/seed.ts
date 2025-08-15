import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

async function main() {
  logger.info('Starting database seed...');

  // Create teams
  const team1 = await prisma.team.upsert({
    where: { name: 'Backend Team' },
    update: {},
    create: {
      name: 'Backend Team',
      management: 'Engineering',
    },
  });

  const team2 = await prisma.team.upsert({
    where: { name: 'Frontend Team' },
    update: {},
    create: {
      name: 'Frontend Team',
      management: 'Engineering',
    },
  });

  const team3 = await prisma.team.upsert({
    where: { name: 'DevOps Team' },
    update: {},
    create: {
      name: 'DevOps Team',
      management: 'Engineering',
    },
  });

  // Create roles
  const seniorDev = await prisma.role.upsert({
    where: { name: 'Senior Developer' },
    update: {},
    create: { name: 'Senior Developer' },
  });

  const midDev = await prisma.role.upsert({
    where: { name: 'Mid-level Developer' },
    update: {},
    create: { name: 'Mid-level Developer' },
  });

  const juniorDev = await prisma.role.upsert({
    where: { name: 'Junior Developer' },
    update: {},
    create: { name: 'Junior Developer' },
  });

  const techLead = await prisma.role.upsert({
    where: { name: 'Tech Lead' },
    update: {},
    create: { name: 'Tech Lead' },
  });

  // Create stacks
  const nodeStack = await prisma.stack.upsert({
    where: { name: 'Node.js' },
    update: {},
    create: { name: 'Node.js', color: '#10b981' },
  });

  const reactStack = await prisma.stack.upsert({
    where: { name: 'React' },
    update: {},
    create: { name: 'React', color: '#3b82f6' },
  });

  const pythonStack = await prisma.stack.upsert({
    where: { name: 'Python' },
    update: {},
    create: { name: 'Python', color: '#f59e0b' },
  });

  const javaStack = await prisma.stack.upsert({
    where: { name: 'Java' },
    update: {},
    create: { name: 'Java', color: '#ef4444' },
  });

  // Create developers
  const dev1 = await prisma.developer.upsert({
    where: { login: 'john.doe' },
    update: {},
    create: {
      name: 'John Doe',
      email: 'john.doe@company.com',
      login: 'john.doe',
      team: {
        connect: { id: team1.id }
      },
      role: {
        connect: { id: seniorDev.id }
      },
      stacks: {
        connect: [{ id: nodeStack.id }]
      }
    },
  });

  const dev2 = await prisma.developer.upsert({
    where: { login: 'jane.smith' },
    update: {},
    create: {
      name: 'Jane Smith',
      email: 'jane.smith@company.com',
      login: 'jane.smith',
      team: {
        connect: { id: team2.id }
      },
      role: {
        connect: { id: techLead.id }
      },
      stacks: {
        connect: [{ id: reactStack.id }]
      }
    },
  });

  const dev3 = await prisma.developer.upsert({
    where: { login: 'bob.wilson' },
    update: {},
    create: {
      name: 'Bob Wilson',
      email: 'bob.wilson@company.com',
      login: 'bob.wilson',
      team: {
        connect: { id: team3.id }
      },
      role: {
        connect: { id: midDev.id }
      },
      stacks: {
        connect: [{ id: pythonStack.id }]
      }
    },
  });

  // Update developers with additional stacks
  await prisma.developer.update({
    where: { id: dev1.id },
    data: {
      stacks: {
        connect: [{ id: reactStack.id }]
      }
    },
  });

  await prisma.developer.update({
    where: { id: dev3.id },
    data: {
      stacks: {
        connect: [{ id: javaStack.id }]
      }
    },
  });

  // Create repositories
  const repo1 = await prisma.repository.create({
    data: {
      name: 'backend-api',
      organization: 'mycompany',
      project: 'indicadores',
      url: 'https://dev.azure.com/mycompany/indicadores/_git/backend-api',
      team: {
        connect: { id: team1.id }
      }
    },
  });

  const repo2 = await prisma.repository.create({
    data: {
      name: 'frontend-app',
      organization: 'mycompany',
      project: 'indicadores',
      url: 'https://dev.azure.com/mycompany/indicadores/_git/frontend-app',
      team: {
        connect: { id: team2.id }
      }
    },
  });

  logger.info('Database seed completed successfully');
}

main()
  .catch((e) => {
    logger.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
