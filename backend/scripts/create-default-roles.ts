import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

async function createDefaultRoles() {
  console.log('🔐 Criando roles padrão do sistema...');

  try {
    // Verificar se já existem roles
    const existingRoles = await prisma.userRole.findMany();
    
    if (existingRoles.length > 0) {
      console.log('⚠️  Roles já existem no sistema. Pulando criação...');
      return;
    }

    // Role de Usuário (padrão)
    const userRole = await prisma.userRole.create({
      data: {
        name: 'user',
        description: 'Usuário padrão com acesso limitado',
        permissions: [
          // Dashboard
          'dashboard:read',
          // Desenvolvedores
          'developers:read',
          // Times
          'teams:read',
          // Cargos
          'job-roles:read',
          // Stacks
          'stacks:read',
          // Repositórios
          'repositories:read',
          // Sincronização
          'sync:read',
          'sync:status:read',
          'sync:history:read',
          // Azure DevOps
          'azure-devops:read'
        ],
        isSystem: true
      }
    });

    // Role de Administrador
    const adminRole = await prisma.userRole.create({
      data: {
        name: 'admin',
        description: 'Administrador do sistema com acesso total',
        permissions: [
          // Usuários
          'users:read', 'users:write', 'users:delete',
          // Roles
          'roles:read', 'roles:write', 'roles:delete',
          // Dashboard
          'dashboard:read',
          // Desenvolvedores
          'developers:read', 'developers:write', 'developers:delete',
          // Times
          'teams:read', 'teams:write', 'teams:delete',
          // Cargos
          'job-roles:read', 'job-roles:write', 'job-roles:delete',
          // Stacks
          'stacks:read', 'stacks:write', 'stacks:delete',
          // Repositórios
          'repositories:read', 'repositories:write', 'repositories:delete',
          // Sincronização
          'sync:read', 'sync:write', 'sync:execute',
          'sync:status:read', 'sync:history:read',
          'sync:manual:execute', 'sync:config:read', 'sync:config:write',
          'sync:scheduler:control', 'sync:monitor:read',
          // Azure DevOps
          'azure-devops:read', 'azure-devops:write', 'azure-devops:configure'
        ],
        isSystem: true
      }
    });

    console.log('✅ Roles padrão criados com sucesso!');
    console.log('📋 User Role ID (padrão):', userRole.id);
    console.log('📋 Admin Role ID:', adminRole.id);

    // Atualizar usuários existentes para usar o role de user por padrão
    await prisma.user.updateMany({
      where: {
        roleId: null
      },
      data: {
        roleId: userRole.id
      }
    });

    console.log('✅ Usuários existentes atualizados com role padrão');

  } catch (error) {
    console.error('❌ Erro ao criar roles padrão:', error);
    throw error;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  createDefaultRoles()
    .then(() => {
      console.log('🎉 Script concluído com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erro no script:', error);
      process.exit(1);
    });
}

export { createDefaultRoles };
