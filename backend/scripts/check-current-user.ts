import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCurrentUser() {
  try {
    console.log('🔍 Verificando usuários e seus roles...\n');

    // Buscar todos os usuários com seus roles
    const users = await prisma.user.findMany({
      include: {
        role: true
      }
    });

    console.log('👥 Usuários no sistema:');
    users.forEach(user => {
      console.log(`\n👤 ${user.name} (${user.email})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Role: ${user.role?.name || 'Sem role'}`);
      console.log(`   Role ID: ${user.roleId || 'N/A'}`);
      console.log(`   Ativo: ${user.isActive ? 'Sim' : 'Não'}`);
      console.log(`   Último login: ${user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('pt-BR') : 'Nunca'}`);
      
      if (user.role) {
        const syncPermissions = user.role.permissions.filter(p => p.startsWith('sync:'));
        console.log(`   Permissões de sync (${syncPermissions.length}):`);
        syncPermissions.forEach(permission => {
          console.log(`     - ${permission}`);
        });
      }
    });

    // Verificar se há usuários com role 'user' que podem estar logados
    const userRoleUsers = users.filter(u => u.role?.name === 'user');
    if (userRoleUsers.length > 0) {
      console.log(`\n⚠️  Usuários com role 'user' encontrados: ${userRoleUsers.length}`);
      userRoleUsers.forEach(user => {
        console.log(`   - ${user.name} (${user.email})`);
      });
    }

  } catch (error) {
    console.error('❌ Erro ao verificar usuários:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  checkCurrentUser()
    .then(() => {
      console.log('\n🎉 Verificação concluída!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erro no script:', error);
      process.exit(1);
    });
}

export { checkCurrentUser };
