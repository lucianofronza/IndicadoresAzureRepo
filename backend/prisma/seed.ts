import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database seed...')

  // Create teams
  const team1 = await prisma.team.upsert({
    where: { name: 'Backend Team' },
    update: {},
    create: {
      name: 'Backend Team',
      management: 'John Manager',
    },
  })

  const team2 = await prisma.team.upsert({
    where: { name: 'Frontend Team' },
    update: {},
    create: {
      name: 'Frontend Team',
      management: 'Jane Manager',
    },
  })

  const team3 = await prisma.team.upsert({
    where: { name: 'DevOps Team' },
    update: {},
    create: {
      name: 'DevOps Team',
      management: 'Bob Manager',
    },
  })

  // Create roles
  const seniorDev = await prisma.role.upsert({
    where: { name: 'Senior Developer' },
    update: {},
    create: { name: 'Senior Developer' },
  })

  const techLead = await prisma.role.upsert({
    where: { name: 'Tech Lead' },
    update: {},
    create: { name: 'Tech Lead' },
  })

  const midDev = await prisma.role.upsert({
    where: { name: 'Mid Developer' },
    update: {},
    create: { name: 'Mid Developer' },
  })

  const juniorDev = await prisma.role.upsert({
    where: { name: 'Junior Developer' },
    update: {},
    create: { name: 'Junior Developer' },
  })

  // Create stacks
  const nodeStack = await prisma.stack.upsert({
    where: { name: 'Node.js' },
    update: {},
    create: { name: 'Node.js' },
  })

  const reactStack = await prisma.stack.upsert({
    where: { name: 'React' },
    update: {},
    create: { name: 'React' },
  })

  const pythonStack = await prisma.stack.upsert({
    where: { name: 'Python' },
    update: {},
    create: { name: 'Python' },
  })

  const javaStack = await prisma.stack.upsert({
    where: { name: 'Java' },
    update: {},
    create: { name: 'Java' },
  })

  // Create developers
  const dev1 = await prisma.developer.upsert({
    where: { login: 'john.doe' },
    update: {},
    create: {
      name: 'John Doe',
      email: 'john.doe@company.com',
      login: 'john.doe',
      teamId: team1.id,
      roleId: seniorDev.id,
      stacks: {
        connect: [{ id: nodeStack.id }]
      }
    },
  })

  const dev2 = await prisma.developer.upsert({
    where: { login: 'jane.smith' },
    update: {},
    create: {
      name: 'Jane Smith',
      email: 'jane.smith@company.com',
      login: 'jane.smith',
      teamId: team2.id,
      roleId: techLead.id,
      stacks: {
        connect: [{ id: reactStack.id }]
      }
    },
  })

  const dev3 = await prisma.developer.upsert({
    where: { login: 'bob.wilson' },
    update: {},
    create: {
      name: 'Bob Wilson',
      email: 'bob.wilson@company.com',
      login: 'bob.wilson',
      teamId: team3.id,
      roleId: midDev.id,
      stacks: {
        connect: [{ id: pythonStack.id }]
      }
    },
  })

  // Create repositories
  await prisma.repository.upsert({
    where: { url: 'https://dev.azure.com/mycompany/indicadores/_git/backend-api' },
    update: {},
    create: {
      name: 'backend-api',
      organization: 'mycompany',
      project: 'indicadores',
      url: 'https://dev.azure.com/mycompany/indicadores/_git/backend-api',
      teamId: team1.id,
    },
  })

  await prisma.repository.upsert({
    where: { url: 'https://dev.azure.com/mycompany/indicadores/_git/frontend-app' },
    update: {},
    create: {
      name: 'frontend-app',
      organization: 'mycompany',
      project: 'indicadores',
      url: 'https://dev.azure.com/mycompany/indicadores/_git/frontend-app',
      teamId: team2.id,
    },
  })

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('Error during seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
