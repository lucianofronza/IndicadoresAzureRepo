import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAdminUser() {
  try {
    console.log('🔍 Verificando usuário admin...');

    // Buscar o usuário admin
    const adminUser = await (prisma as any).user.findFirst({
      where: { email: 'admin@indicadores.com' },
      include: {
        role: true
      }
    });

    if (!adminUser) {
      console.log('❌ Usuário admin não encontrado!');
      return;
    }

    console.log('✅ Usuário admin encontrado:');
    console.log('📋 ID:', adminUser.id);
    console.log('📋 Nome:', adminUser.name);
    console.log('📋 Email:', adminUser.email);
    console.log('📋 Role ID:', adminUser.roleId);
    console.log('📋 Role:', adminUser.role);

    // Buscar o role admin
    const adminRole = await (prisma as any).userRole.findFirst({
      where: { name: 'admin' }
    });

    if (!adminRole) {
      console.log('❌ Role admin não encontrado!');
      return;
    }

    console.log('\n📋 Role admin encontrado:');
    console.log('📋 ID:', adminRole.id);
    console.log('📋 Nome:', adminRole.name);
    console.log('📋 Permissões:', adminRole.permissions);

    // Verificar se o admin tem a role correta
    if (adminUser.roleId === adminRole.id) {
      console.log('\n✅ Admin tem a role correta!');
    } else {
      console.log('\n❌ Admin NÃO tem a role correta!');
      console.log('📋 Role atual:', adminUser.roleId);
      console.log('📋 Role esperada:', adminRole.id);
    }

  } catch (error) {
    console.error('❌ Erro ao verificar admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o script
if (require.main === module) {
  checkAdminUser()
    .then(() => {
      console.log('🎉 Script concluído!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erro no script:', error);
      process.exit(1);
    });
}
