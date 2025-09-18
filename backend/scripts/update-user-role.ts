import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateUserRole() {
  try {
    console.log('🔧 Atualizando permissões do role "user"...\n');

    // Buscar o role 'user'
    const userRole = await prisma.userRole.findFirst({
      where: { name: 'user' }
    });

    if (!userRole) {
      console.log('❌ Role "user" não encontrado');
      return;
    }

    console.log(`📋 Role "user" encontrado (ID: ${userRole.id})`);
    console.log(`   Permissões atuais: ${userRole.permissions.length}`);
    userRole.permissions.forEach(permission => {
      console.log(`     - ${permission}`);
    });

    // Atualizar com as permissões corretas
    const correctPermissions = [
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
      'sync:manual:execute',
      // Azure DevOps
      'azure-devops:read'
    ];

    console.log('\n🔄 Atualizando permissões...');
    
    const updatedRole = await prisma.userRole.update({
      where: { id: userRole.id },
      data: {
        permissions: correctPermissions
      }
    });

    console.log('✅ Role "user" atualizado com sucesso!');
    console.log(`   Novas permissões (${updatedRole.permissions.length}):`);
    updatedRole.permissions.forEach(permission => {
      console.log(`     - ${permission}`);
    });

    // Verificar usuários afetados
    const usersWithUserRole = await prisma.user.findMany({
      where: { roleId: userRole.id },
      select: { id: true, name: true, email: true }
    });

    console.log(`\n👥 Usuários afetados: ${usersWithUserRole.length}`);
    usersWithUserRole.forEach(user => {
      console.log(`   - ${user.name} (${user.email})`);
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar role "user":', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  updateUserRole()
    .then(() => {
      console.log('\n🎉 Atualização concluída!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erro no script:', error);
      process.exit(1);
    });
}

export { updateUserRole };
