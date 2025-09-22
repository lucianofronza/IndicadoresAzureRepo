import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    console.log('🔐 Criando usuário administrador...');

    // Primeiro, buscar o role de admin
    const adminRole = await (prisma as any).userRole.findFirst({
      where: { name: 'admin' }
    });

    if (!adminRole) {
      console.log('❌ Role de admin não encontrado. Execute primeiro: npm run db:create-roles');
      return;
    }

    // Verificar se já existe um usuário admin
    const existingAdmin = await (prisma as any).user.findFirst({
      where: { 
        email: 'admin@indicadores.com'
      },
      include: {
        role: true
      }
    });

    if (existingAdmin) {
      // Se o usuário já tem role de admin, apenas informar
      if (existingAdmin.roleId === adminRole.id) {
        console.log('✅ Usuário administrador já existe com role correto:', existingAdmin.email);
        console.log('👤 Role atual:', existingAdmin.role?.name);
        return;
      }
      
      // Se o usuário existe mas não tem role de admin, atualizar
      console.log('🔄 Atualizando usuário existente para role de admin...');
      
      const updatedAdmin = await (prisma as any).user.update({
        where: { id: existingAdmin.id },
        data: {
          roleId: adminRole.id,
          viewScope: 'all' // Admin pode ver todos os dados
        },
        include: {
          role: true
        }
      });

      console.log('✅ Usuário atualizado para administrador!');
      console.log('📧 Email:', updatedAdmin.email);
      console.log('👤 Role:', updatedAdmin.role?.name);
      return;
    }

    // Dados do usuário admin
    const adminData = {
      name: 'Administrador',
      email: 'admin@indicadores.com',
      login: 'admin',
      password: 'admin123'
    };

    // Criptografar senha
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(adminData.password, saltRounds);

    // Criar usuário admin
    const adminUser = await (prisma as any).user.create({
      data: {
        name: adminData.name,
        email: adminData.email,
        login: adminData.login,
        password: hashedPassword,
        roleId: adminRole.id, // Usar o ID do role de admin
        viewScope: 'all', // Admin pode ver todos os dados
        isActive: true
      },
      include: {
        role: true
      }
    });

    console.log('✅ Usuário administrador criado com sucesso!');
    console.log('📧 Email:', adminData.email);
    console.log('🔑 Senha:', adminData.password);
    console.log('👤 Role:', adminUser.role?.name);
    console.log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!');

    logger.info({ 
      userId: adminUser.id, 
      email: adminUser.email,
      roleId: adminUser.roleId
    }, 'Admin user created successfully');

  } catch (error) {
    console.error('❌ Erro ao criar usuário administrador:', error);
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Error creating admin user');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o script
if (require.main === module) {
  createAdminUser()
    .then(() => {
      console.log('🎉 Script executado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erro na execução do script:', error);
      process.exit(1);
    });
}
