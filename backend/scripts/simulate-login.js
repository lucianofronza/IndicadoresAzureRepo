const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function simulateLogin() {
  try {
    console.log('🔍 Simulando login do Azure AD...');

    const azureAdData = {
      email: 'luciano.fronza@benner.com.br',
      azureAdId: 'Cbh4OPnSd7xRNLJSb4CvPhb7pgbvfJSW4j6TK6Y5W20',
      name: 'Luciano Fronza'
    };

    console.log('📧 Dados do Azure AD:');
    console.log(`  Email: ${azureAdData.email}`);
    console.log(`  Azure ID: ${azureAdData.azureAdId}`);
    console.log(`  Nome: ${azureAdData.name}`);

    // Passo 1: Buscar usuário
    console.log('\n🔍 Passo 1: Buscando usuário...');
    let user = await prisma.user.findFirst({
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

    if (user) {
      console.log('✅ Usuário encontrado:');
      console.log(`  ID: ${user.id}`);
      console.log(`  Nome: ${user.name}`);
      console.log(`  Status: ${user.status}`);
      console.log(`  Ativo: ${user.isActive}`);
    } else {
      console.log('❌ Usuário não encontrado - seria criado um novo');
      return;
    }

    // Passo 2: Verificar se usuário está ativo
    console.log('\n🔍 Passo 2: Verificando se usuário está ativo...');
    if (!user.isActive || user.status !== 'active') {
      console.log('⚠️  Usuário não está ativo - retornaria requiresApproval: true');
      console.log('🚫 Login seria bloqueado aqui - não deveria chegar ao erro 409');
      return;
    }

    // Passo 3: Atualizar dados do Azure AD se necessário
    console.log('\n🔍 Passo 3: Verificando atualização do Azure AD...');
    const needsUpdate = user.azureAdId !== azureAdData.azureAdId || 
                       user.azureAdEmail !== (azureAdData.azureAdEmail || azureAdData.email);

    if (needsUpdate) {
      console.log('⚠️  Precisa atualizar dados do Azure AD');
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            azureAdId: azureAdData.azureAdId,
            azureAdEmail: azureAdData.azureAdEmail || azureAdData.email,
            name: azureAdData.name
          }
        });
        console.log('✅ Atualização realizada com sucesso');
      } catch (error) {
        console.log('❌ Erro na atualização:', error.message);
        console.log('🚫 ESTE É O ERRO 409!');
        return;
      }
    } else {
      console.log('✅ Não precisa atualizar dados do Azure AD');
    }

    // Passo 4: Vincular com desenvolvedor
    console.log('\n🔍 Passo 4: Verificando vínculo com desenvolvedor...');
    if (!user.developerId) {
      console.log('⚠️  Usuário não tem developerId - tentaria vincular');
      // Simular busca por desenvolvedor
      const developer = await prisma.developer.findFirst({
        where: {
          OR: [
            { email: azureAdData.email },
            { azureId: azureAdData.azureAdId }
          ]
        }
      });

      if (developer) {
        console.log(`✅ Desenvolvedor encontrado: ${developer.name}`);
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { developerId: developer.id }
          });
          console.log('✅ Vínculo com desenvolvedor realizado com sucesso');
        } catch (error) {
          console.log('❌ Erro no vínculo com desenvolvedor:', error.message);
          console.log('🚫 ESTE É O ERRO 409!');
          return;
        }
      } else {
        console.log('ℹ️  Nenhum desenvolvedor encontrado para vincular');
      }
    } else {
      console.log('✅ Usuário já tem developerId');
    }

    // Passo 5: Deletar tokens existentes
    console.log('\n🔍 Passo 5: Deletando tokens existentes...');
    try {
      const deletedTokens = await prisma.userToken.deleteMany({
        where: { userId: user.id }
      });
      console.log(`✅ ${deletedTokens.count} tokens deletados`);
    } catch (error) {
      console.log('❌ Erro ao deletar tokens:', error.message);
    }

    // Passo 6: Criar novo token
    console.log('\n🔍 Passo 6: Criando novo token...');
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await prisma.userToken.create({
        data: {
          userId: user.id,
          accessToken: 'test-token',
          refreshToken: 'test-refresh-token',
          expiresAt
        }
      });
      console.log('✅ Token criado com sucesso');
    } catch (error) {
      console.log('❌ Erro ao criar token:', error.message);
      console.log('🚫 ESTE É O ERRO 409!');
      return;
    }

    // Passo 7: Atualizar último login
    console.log('\n🔍 Passo 7: Atualizando último login...');
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });
      console.log('✅ Último login atualizado com sucesso');
    } catch (error) {
      console.log('❌ Erro ao atualizar último login:', error.message);
      console.log('🚫 ESTE É O ERRO 409!');
      return;
    }

    console.log('\n✅ Simulação concluída - nenhum erro encontrado');

  } catch (error) {
    console.error('❌ Erro durante a simulação:', error);
  } finally {
    await prisma.$disconnect();
  }
}

simulateLogin();
