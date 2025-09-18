import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUserPermissions() {
  try {
    console.log('🔍 Verificando permissões dos usuários...\n');

    // Buscar todos os usuários com seus roles
    const users = await prisma.user.findMany({
      include: {
        role: true
      }
    });

    if (users.length === 0) {
      console.log('❌ Nenhum usuário encontrado no banco de dados');
      return;
    }

    console.log(`📊 Encontrados ${users.length} usuário(s):\n`);

    for (const user of users) {
      console.log(`👤 Usuário: ${user.name} (${user.email})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Role: ${user.role?.name || 'Sem role'}`);
      console.log(`   Role ID: ${user.roleId || 'N/A'}`);
      
      if (user.role) {
        console.log(`   Permissões (${user.role.permissions.length}):`);
        user.role.permissions.forEach(permission => {
          console.log(`     - ${permission}`);
        });
      } else {
        console.log('   ⚠️  Usuário sem role atribuído');
      }
      console.log('');
    }

    // Verificar roles disponíveis
    console.log('📋 Roles disponíveis no sistema:');
    const roles = await prisma.userRole.findMany();
    
    for (const role of roles) {
      console.log(`\n🔐 Role: ${role.name}`);
      console.log(`   ID: ${role.id}`);
      console.log(`   Descrição: ${role.description}`);
      console.log(`   É padrão: ${role.isDefault ? 'Sim' : 'Não'}`);
      console.log(`   É sistema: ${role.isSystem ? 'Sim' : 'Não'}`);
      console.log(`   Permissões (${role.permissions.length}):`);
      role.permissions.forEach(permission => {
        console.log(`     - ${permission}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro ao verificar permissões:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  checkUserPermissions()
    .then(() => {
      console.log('\n🎉 Verificação concluída!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erro no script:', error);
      process.exit(1);
    });
}

export { checkUserPermissions };