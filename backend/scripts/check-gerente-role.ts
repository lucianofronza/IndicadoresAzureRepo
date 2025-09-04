import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkGerenteRole() {
  try {
    console.log('🔍 Verificando role "gerente"...');

    // Buscar todas as roles
    const allRoles = await (prisma as any).userRole.findMany({
      orderBy: { name: 'asc' }
    });

    console.log('📋 Todas as roles encontradas:');
    allRoles.forEach((role: any, index: number) => {
      console.log(`  ${index + 1}. ${role.name} (${role.id})`);
    });

    // Buscar especificamente a role gerente
    const gerenteRole = await (prisma as any).userRole.findFirst({
      where: { name: 'gerente' }
    });

    if (gerenteRole) {
      console.log('\n✅ Role "gerente" encontrada:');
      console.log('📋 ID:', gerenteRole.id);
      console.log('📋 Nome:', gerenteRole.name);
      console.log('📋 Descrição:', gerenteRole.description);
      console.log('📋 Permissões:', gerenteRole.permissions);
      console.log('📋 É sistema:', gerenteRole.isSystem);
    } else {
      console.log('\n❌ Role "gerente" NÃO encontrada!');
    }

  } catch (error) {
    console.error('❌ Erro ao verificar role gerente:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o script
if (require.main === module) {
  checkGerenteRole()
    .then(() => {
      console.log('🎉 Script concluído!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erro no script:', error);
      process.exit(1);
    });
}
