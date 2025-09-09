const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testNotificationCreation() {
  try {
    console.log('🔍 Testando criação de notificações...');

    // Primeiro, buscar um role válido
    const defaultRole = await prisma.userRole.findFirst({
      where: { isDefault: true }
    });

    if (!defaultRole) {
      console.log('❌ Nenhum role padrão encontrado');
      return;
    }

    // Criar um usuário de teste
    const testUser = await prisma.user.create({
      data: {
        name: 'Luciano Fronza',
        email: 'luciano.fronza@benner.com.br',
        login: 'luciano.fronza',
        azureAdId: 'Cbh4OPnSd7xRNLJSb4CvPhb7pgbvfJSW4j6TK6Y5W20',
        azureAdEmail: 'luciano.fronza@benner.com.br',
        roleId: defaultRole.id,
        isActive: false,
        status: 'pending',
        viewScope: 'own'
      }
    });

    // Simular dados de notificação
    const notificationData = {
      type: 'user_approval',
      title: 'Novo usuário aguardando aprovação',
      message: 'Luciano Fronza (luciano.fronza@benner.com.br)',
      targetUserId: testUser.id,
      metadata: {
        userId: testUser.id,
        userName: 'Luciano Fronza',
        userEmail: 'luciano.fronza@benner.com.br',
        userLogin: 'luciano.fronza',
        createdAt: new Date()
      }
    };

    console.log('📧 Dados da notificação:');
    console.log(`  Tipo: ${notificationData.type}`);
    console.log(`  Título: ${notificationData.title}`);
    console.log(`  Mensagem: ${notificationData.message}`);
    console.log(`  Target User ID: ${notificationData.targetUserId}`);

    // Passo 1: Buscar admins
    console.log('\n🔍 Passo 1: Buscando administradores...');
    const admins = await prisma.user.findMany({
      where: {
        role: {
          permissions: {
            has: 'users:write'
          }
        },
        isActive: true
      },
      select: { id: true, name: true, email: true }
    });

    console.log(`✅ Encontrados ${admins.length} administradores:`);
    admins.forEach(admin => {
      console.log(`  - ${admin.name} (${admin.email})`);
    });

    if (admins.length === 0) {
      console.log('⚠️  Nenhum admin encontrado - notificação não seria criada');
      return;
    }

    // Passo 2: Verificar se já existem notificações para este usuário
    console.log('\n🔍 Passo 2: Verificando notificações existentes...');
    const existingNotifications = await prisma.notification.findMany({
      where: {
        targetUserId: notificationData.targetUserId,
        type: notificationData.type
      }
    });

    console.log(`ℹ️  Existem ${existingNotifications.length} notificações para este usuário`);
    if (existingNotifications.length > 0) {
      console.log('⚠️  Notificações já existem - pode causar duplicação');
      existingNotifications.forEach(notif => {
        console.log(`  - ID: ${notif.id}, Status: ${notif.status}, Criada: ${notif.createdAt}`);
      });
    }

    // Passo 3: Tentar criar notificações
    console.log('\n🔍 Passo 3: Tentando criar notificações...');
    try {
      const notifications = admins.map(admin => ({
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        targetUserId: notificationData.targetUserId,
        metadata: notificationData.metadata
      }));

      const result = await prisma.notification.createMany({
        data: notifications
      });

      console.log(`✅ ${result.count} notificações criadas com sucesso`);
    } catch (error) {
      console.log('❌ Erro ao criar notificações:', error.message);
      console.log('🚫 ESTE É O ERRO 409!');
      
      if (error.code === 'P2002') {
        console.log('⚠️  Erro de constraint única - notificação já existe');
      }
    }

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
    
    // Tentar limpar usuário de teste em caso de erro
    try {
      if (testUser) {
        await prisma.user.delete({
          where: { id: testUser.id }
        });
        console.log('🧹 Usuário de teste removido após erro');
      }
    } catch (cleanupError) {
      console.log('⚠️  Erro ao limpar usuário de teste:', cleanupError.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testNotificationCreation();
