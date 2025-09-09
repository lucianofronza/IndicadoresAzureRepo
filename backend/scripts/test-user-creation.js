const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testUserCreation() {
  try {
    console.log('🔍 Testando criação de usuário...');

    const azureAdData = {
      email: 'luciano.fronza@benner.com.br',
      azureAdId: 'Cbh4OPnSd7xRNLJSb4CvPhb7pgbvfJSW4j6TK6Y5W20',
      name: 'Luciano Fronza'
    };

    console.log('📧 Dados do Azure AD:');
    console.log(`  Email: ${azureAdData.email}`);
    console.log(`  Azure ID: ${azureAdData.azureAdId}`);
    console.log(`  Nome: ${azureAdData.name}`);

    // Passo 1: Verificar se usuário já existe
    console.log('\n🔍 Passo 1: Verificando se usuário já existe...');
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: azureAdData.email },
          { azureAdId: azureAdData.azureAdId }
        ]
      }
    });

    if (existingUser) {
      console.log('⚠️  Usuário já existe:');
      console.log(`  ID: ${existingUser.id}`);
      console.log(`  Nome: ${existingUser.name}`);
      console.log(`  Email: ${existingUser.email}`);
      console.log(`  Login: ${existingUser.login}`);
      console.log(`  Azure ID: ${existingUser.azureAdId}`);
      console.log(`  Status: ${existingUser.status}`);
      console.log('🚫 Não deveria tentar criar um novo usuário');
      return;
    }

    // Passo 2: Buscar role padrão
    console.log('\n🔍 Passo 2: Buscando role padrão...');
    const defaultRole = await prisma.userRole.findFirst({
      where: { isDefault: true }
    });

    if (!defaultRole) {
      console.log('❌ Nenhum role padrão encontrado');
      return;
    }

    console.log(`✅ Role padrão encontrado: ${defaultRole.name}`);

    // Passo 3: Verificar constraints únicas
    console.log('\n🔍 Passo 3: Verificando constraints únicas...');
    
    const emailExists = await prisma.user.findFirst({
      where: { email: azureAdData.email }
    });
    
    const azureIdExists = await prisma.user.findFirst({
      where: { azureAdId: azureAdData.azureAdId }
    });
    
    const loginExists = await prisma.user.findFirst({
      where: { login: azureAdData.email.split('@')[0] }
    });

    console.log(`  Email existe: ${emailExists ? 'SIM' : 'NÃO'}`);
    console.log(`  Azure ID existe: ${azureIdExists ? 'SIM' : 'NÃO'}`);
    console.log(`  Login existe: ${loginExists ? 'SIM' : 'NÃO'}`);

    if (emailExists || azureIdExists || loginExists) {
      console.log('🚫 CONFLITO: Dados já existem - criação falharia com erro 409');
      return;
    }

    // Passo 4: Tentar criar usuário
    console.log('\n🔍 Passo 4: Tentando criar usuário...');
    try {
      const newUser = await prisma.user.create({
        data: {
          name: azureAdData.name,
          email: azureAdData.email,
          login: azureAdData.email.split('@')[0],
          azureAdId: azureAdData.azureAdId,
          azureAdEmail: azureAdData.azureAdEmail || azureAdData.email,
          roleId: defaultRole.id,
          isActive: false,
          status: 'pending',
          viewScope: 'own'
        },
        include: {
          role: true
        }
      });

      console.log('✅ Usuário criado com sucesso:');
      console.log(`  ID: ${newUser.id}`);
      console.log(`  Nome: ${newUser.name}`);
      console.log(`  Email: ${newUser.email}`);
      console.log(`  Login: ${newUser.login}`);
      console.log(`  Status: ${newUser.status}`);

      // Limpar usuário criado para teste
      await prisma.user.delete({
        where: { id: newUser.id }
      });
      console.log('🧹 Usuário de teste removido');

    } catch (error) {
      console.log('❌ Erro ao criar usuário:', error.message);
      console.log('🚫 ESTE É O ERRO 409!');
      
      if (error.code === 'P2002') {
        console.log('⚠️  Erro de constraint única');
        console.log('  Campo:', error.meta?.target);
      }
    }

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testUserCreation();
