import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUserPermissions() {
  try {
    console.log('🔍 Verificando permissões do role "user"...');

    // Buscar o role de user
    const userRole = await (prisma as any).userRole.findFirst({
      where: { name: 'user' }
    });

    if (!userRole) {
      console.log('❌ Role "user" não encontrado!');
      return;
    }

    console.log('✅ Role "user" encontrado:');
    console.log('📋 ID:', userRole.id);
    console.log('📋 Nome:', userRole.name);
    console.log('📋 Descrição:', userRole.description);
    console.log('📋 Permissões:', userRole.permissions);

    // Verificar se tem dashboard:read
    const hasDashboardRead = userRole.permissions.includes('dashboard:read');
    console.log('🔍 Tem dashboard:read?', hasDashboardRead ? '✅ SIM' : '❌ NÃO');

    // Listar todas as permissões
    console.log('\n📋 Todas as permissões do role "user":');
    userRole.permissions.forEach((permission: string, index: number) => {
      console.log(`  ${index + 1}. ${permission}`);
    });

  } catch (error) {
    console.error('❌ Erro ao verificar permissões:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o script
if (require.main === module) {
  checkUserPermissions()
    .then(() => {
      console.log('🎉 Script concluído!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erro no script:', error);
      process.exit(1);
    });
}
