const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testLogin() {
  try {
    console.log('🔍 Testando busca de usuário...');

    // Simular dados do Azure AD
    const azureAdData = {
      email: 'luciano.fronza@benner.com.br',
      azureAdId: 'Cbh4OPnSd7xRNLJSb4CvPhb7pgbvfJSW4j6TK6Y5W20',
      name: 'Luciano Fronza'
    };

    console.log('📧 Dados do Azure AD:');
    console.log(`  Email: ${azureAdData.email}`);
    console.log(`  Azure ID: ${azureAdData.azureAdId}`);
    console.log(`  Nome: ${azureAdData.name}`);

    // Buscar usuário pelo email ou azureAdId (mesma lógica do AuthService)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: azureAdData.email },
          { azureAdId: azureAdData.azureAdId }
        ]
      },
      include: {
        role: true
      }
    });

    console.log('\n🔍 Resultado da busca:');
    if (user) {
      console.log('✅ Usuário encontrado:');
      console.log(`  ID: ${user.id}`);
      console.log(`  Nome: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Login: ${user.login}`);
      console.log(`  Azure ID: ${user.azureAdId}`);
      console.log(`  Status: ${user.status}`);
      console.log(`  Ativo: ${user.isActive}`);
      console.log(`  Role: ${user.role?.name}`);
    } else {
      console.log('❌ Usuário NÃO encontrado - seria criado um novo');
    }

    // Verificar se há conflitos de constraint
    console.log('\n🔍 Verificando possíveis conflitos:');
    
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

    if (emailExists && emailExists.id !== user?.id) {
      console.log('⚠️  CONFLITO: Email já existe para outro usuário');
    }
    
    if (azureIdExists && azureIdExists.id !== user?.id) {
      console.log('⚠️  CONFLITO: Azure ID já existe para outro usuário');
    }
    
    if (loginExists && loginExists.id !== user?.id) {
      console.log('⚠️  CONFLITO: Login já existe para outro usuário');
    }

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();
