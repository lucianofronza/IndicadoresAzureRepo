import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    console.log('🔐 Criando usuário administrador...');

    // Verificar se já existe um usuário admin
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'admin' }
    });

    if (existingAdmin) {
      console.log('✅ Usuário administrador já existe:', existingAdmin.email);
      return;
    }

    // Dados do usuário admin
    const adminData = {
      name: 'Administrador',
      email: 'admin@indicadores.com',
      login: 'admin',
      password: 'admin123',
      role: 'admin' as const
    };

    // Criptografar senha
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(adminData.password, saltRounds);

    // Criar usuário admin
    const adminUser = await prisma.user.create({
      data: {
        name: adminData.name,
        email: adminData.email,
        login: adminData.login,
        password: hashedPassword,
        role: adminData.role,
        isActive: true
      }
    });

    console.log('✅ Usuário administrador criado com sucesso!');
    console.log('📧 Email:', adminData.email);
    console.log('🔑 Senha:', adminData.password);
    console.log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!');

    logger.info({ 
      userId: adminUser.id, 
      email: adminUser.email 
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
