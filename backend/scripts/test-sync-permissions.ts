import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testSyncPermissions() {
  try {
    console.log('🔍 Testando permissões de sync...\n');

    // Buscar o usuário Luciano Fronza
    const user = await prisma.user.findFirst({
      where: { email: 'luciano.fronza@benner.com.br' },
      include: {
        role: true
      }
    });

    if (!user) {
      console.log('❌ Usuário não encontrado');
      return;
    }

    console.log(`👤 Usuário: ${user.name} (${user.email})`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Role: ${user.role?.name || 'Sem role'}`);
    console.log(`   Role ID: ${user.roleId || 'N/A'}`);

    if (user.role) {
      console.log(`\n📋 Permissões do role (${user.role.permissions.length}):`);
      user.role.permissions.forEach(permission => {
        console.log(`   - ${permission}`);
      });

      // Testar permissões específicas de sync
      const syncPermissions = [
        'sync:read',
        'sync:status:read',
        'sync:history:read',
        'sync:manual:execute'
      ];

      console.log(`\n🔐 Testando permissões de sync:`);
      syncPermissions.forEach(permission => {
        const hasPermission = user.role!.permissions.includes(permission);
        console.log(`   ${permission}: ${hasPermission ? '✅' : '❌'}`);
      });

      // Verificar se tem todas as permissões necessárias
      const hasAllSyncPermissions = syncPermissions.every(p => user.role!.permissions.includes(p));
      console.log(`\n🎯 Tem todas as permissões de sync: ${hasAllSyncPermissions ? '✅ SIM' : '❌ NÃO'}`);

    } else {
      console.log('❌ Usuário sem role');
    }

    // Verificar se existe o repositório específico
    const repositoryId = 'cmffu4c55001av1i80ol1cw29';
    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId }
    });

    console.log(`\n📁 Repositório ${repositoryId}: ${repository ? '✅ Existe' : '❌ Não existe'}`);
    if (repository) {
      console.log(`   Nome: ${repository.name}`);
      console.log(`   Organização: ${repository.organization}`);
      console.log(`   Projeto: ${repository.project}`);
    }

  } catch (error) {
    console.error('❌ Erro ao testar permissões:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  testSyncPermissions()
    .then(() => {
      console.log('\n🎉 Teste concluído!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erro no script:', error);
      process.exit(1);
    });
}

export { testSyncPermissions };
