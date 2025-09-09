const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupOrphanedUsers() {
  try {
    console.log('🔍 Verificando problemas no banco de dados...');

    // Listar todos os usuários
    const allUsers = await prisma.user.findMany({
      include: {
        role: true,
        tokens: true,
        userTeams: true,
        notifications: true
      }
    });

    console.log(`📊 Total de usuários: ${allUsers.length}`);
    
    // Mostrar todos os usuários
    console.log('\n👥 Usuários no banco:');
    allUsers.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) - ID: ${user.id}`);
      console.log(`    Login: ${user.login}, Azure ID: ${user.azureAdId}`);
      console.log(`    Status: ${user.status}, Ativo: ${user.isActive}`);
      console.log(`    Role: ${user.role?.name || 'SEM ROLE'}`);
      console.log(`    Tokens: ${user.tokens.length}, Teams: ${user.userTeams.length}, Notifications: ${user.notifications.length}`);
      console.log('');
    });

    // Verificar constraints únicas
    console.log('\n🔍 Verificando constraints únicas...');
    
    const duplicateEmails = await prisma.$queryRaw`
      SELECT email, COUNT(*) as count 
      FROM users 
      GROUP BY email 
      HAVING COUNT(*) > 1
    `;
    
    const duplicateLogins = await prisma.$queryRaw`
      SELECT login, COUNT(*) as count 
      FROM users 
      GROUP BY login 
      HAVING COUNT(*) > 1
    `;
    
    const duplicateAzureIds = await prisma.$queryRaw`
      SELECT "azureAdId", COUNT(*) as count 
      FROM users 
      WHERE "azureAdId" IS NOT NULL
      GROUP BY "azureAdId" 
      HAVING COUNT(*) > 1
    `;

    console.log(`📧 Emails duplicados: ${duplicateEmails.length}`);
    console.log(`👤 Logins duplicados: ${duplicateLogins.length}`);
    console.log(`🔐 Azure IDs duplicados: ${duplicateAzureIds.length}`);

    if (duplicateEmails.length > 0) {
      console.log('⚠️  Emails duplicados encontrados:');
      duplicateEmails.forEach(dup => console.log(`  - ${dup.email}: ${dup.count} ocorrências`));
    }

    if (duplicateLogins.length > 0) {
      console.log('⚠️  Logins duplicados encontrados:');
      duplicateLogins.forEach(dup => console.log(`  - ${dup.login}: ${dup.count} ocorrências`));
    }

    if (duplicateAzureIds.length > 0) {
      console.log('⚠️  Azure IDs duplicados encontrados:');
      duplicateAzureIds.forEach(dup => console.log(`  - ${dup.azureAdId}: ${dup.count} ocorrências`));
    }

    console.log('\n✅ Limpeza concluída!');

  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupOrphanedUsers();
