import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

async function main() {
  logger.info('Starting UserRoles seed...');

  // Criar roles de usuário
  const adminRole = await prisma.userRole.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Administrador do sistema com acesso total',
      permissions: [
        'users:read',
        'users:write',
        'users:delete',
        'user-roles:read',
        'user-roles:write',
        'user-roles:delete',
        'teams:read',
        'teams:write',
        'teams:delete',
        'repositories:read',
        'repositories:write',
        'repositories:delete',
        'developers:read',
        'developers:write',
        'developers:delete',
        'pull-requests:read',
        'pull-requests:write',
        'pull-requests:delete',
        'reports:read',
        'reports:write',
        'reports:delete'
      ],
      isSystem: true,
      isDefault: false
    },
  });

  const userRole = await prisma.userRole.upsert({
    where: { name: 'user' },
    update: {},
    create: {
      name: 'user',
      description: 'Usuário padrão do sistema',
      permissions: [
        'users:read',
        'teams:read',
        'repositories:read',
        'developers:read',
        'pull-requests:read',
        'reports:read'
      ],
      isSystem: true,
      isDefault: true // Este será o role padrão
    },
  });

  const managerRole = await prisma.userRole.upsert({
    where: { name: 'manager' },
    update: {},
    create: {
      name: 'manager',
      description: 'Gerente com acesso a relatórios e gestão de equipes',
      permissions: [
        'users:read',
        'users:write',
        'teams:read',
        'teams:write',
        'repositories:read',
        'repositories:write',
        'developers:read',
        'developers:write',
        'pull-requests:read',
        'pull-requests:write',
        'reports:read',
        'reports:write'
      ],
      isSystem: false,
      isDefault: false
    },
  });

  logger.info('UserRoles seed completed successfully');
  logger.info(`Created roles: ${adminRole.name}, ${userRole.name}, ${managerRole.name}`);
  logger.info(`Default role: ${userRole.name}`);
}

main()
  .catch((e) => {
    logger.error('Error during UserRoles seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
