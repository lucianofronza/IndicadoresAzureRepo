const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugAzureUpdate() {
  try {
    console.log('🔍 Debugando atualização do Azure AD...');

    const userId = 'cmfcln6690005tzqbqn4mq0u7'; // ID do Luciano Fronza
    const azureAdData = {
      email: 'luciano.fronza@benner.com.br',
      azureAdId: 'Cbh4OPnSd7xRNLJSb4CvPhb7pgbvfJSW4j6TK6Y5W20',
      name: 'Luciano Fronza'
    };

    // Buscar usuário atual
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    console.log('👤 Usuário atual:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Nome: ${user.name}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Azure ID: ${user.azureAdId}`);
    console.log(`  Azure Email: ${user.azureAdEmail}`);

    console.log('\n📧 Dados do Azure AD:');
    console.log(`  Email: ${azureAdData.email}`);
    console.log(`  Azure ID: ${azureAdData.azureAdId}`);
    console.log(`  Nome: ${azureAdData.name}`);

    // Verificar se precisa atualizar
    const needsUpdate = user.azureAdId !== azureAdData.azureAdId || 
                       user.azureAdEmail !== (azureAdData.azureAdEmail || azureAdData.email);

    console.log(`\n🔄 Precisa atualizar: ${needsUpdate ? 'SIM' : 'NÃO'}`);

    if (needsUpdate) {
      console.log('\n⚠️  Tentando atualizar...');
      
      // Verificar se o novo azureAdId já existe em outro usuário
      const existingUser = await prisma.user.findFirst({
        where: {
          azureAdId: azureAdData.azureAdId,
          id: { not: userId }
        }
      });

      if (existingUser) {
        console.log('❌ ERRO: Azure ID já existe para outro usuário:');
        console.log(`  ID: ${existingUser.id}`);
        console.log(`  Nome: ${existingUser.name}`);
        console.log(`  Email: ${existingUser.email}`);
        console.log('🚫 Esta é a causa do erro 409!');
      } else {
        console.log('✅ Azure ID não existe em outro usuário, atualização seria possível');
        
        // Tentar a atualização
        try {
          const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
              azureAdId: azureAdData.azureAdId,
              azureAdEmail: azureAdData.azureAdEmail || azureAdData.email,
              name: azureAdData.name
            }
          });
          console.log('✅ Atualização realizada com sucesso!');
        } catch (updateError) {
          console.log('❌ Erro na atualização:', updateError.message);
        }
      }
    }

  } catch (error) {
    console.error('❌ Erro durante o debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAzureUpdate();
