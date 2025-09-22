#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

async function initializeDatabase() {
  try {
    logger.info('🚀 Iniciando configuração completa da base de dados...');

    // 1. Criar roles padrão
    logger.info('📋 Criando roles padrão...');
    
    // Verificar se roles já existem
    const existingRoles = await prisma.userRole.findMany();
    
    if (existingRoles.length === 0) {
      // Role de Usuário (padrão)
      const userRole = await prisma.userRole.create({
        data: {
          name: 'user',
          description: 'Usuário padrão com acesso limitado',
          permissions: [
            // Dashboard
            'dashboard:read',
            // Desenvolvedores
            'developers:read',
            // Times
            'teams:read',
            // Cargos
            'job-roles:read',
            // Stacks
            'stacks:read',
            // Repositórios
            'repositories:read',
            // Sincronização
            'sync:read',
            'sync:status:read',
            'sync:history:read',
            // Azure DevOps
            'azure-devops:read'
          ],
          isSystem: true,
          isDefault: true
        }
      });

      // Role de Administrador
      const adminRole = await prisma.userRole.create({
        data: {
          name: 'admin',
          description: 'Administrador do sistema com acesso total',
          permissions: [
            // Usuários
            'users:read', 'users:write', 'users:delete',
            // Roles
            'roles:read', 'roles:write', 'roles:delete',
            // Dashboard
            'dashboard:read',
            // Desenvolvedores
            'developers:read', 'developers:write', 'developers:delete',
            // Times
            'teams:read', 'teams:write', 'teams:delete',
            // Cargos
            'job-roles:read', 'job-roles:write', 'job-roles:delete',
            // Stacks
            'stacks:read', 'stacks:write', 'stacks:delete',
            // Repositórios
            'repositories:read', 'repositories:write', 'repositories:delete',
            // Sincronização
            'sync:read', 'sync:write', 'sync:execute',
            'sync:status:read', 'sync:history:read',
            'sync:manual:execute', 'sync:config:read', 'sync:config:write',
            'sync:scheduler:control', 'sync:monitor:read',
            // Azure DevOps
            'azure-devops:read', 'azure-devops:write', 'azure-devops:configure'
          ],
          isSystem: true,
          isDefault: false
        }
      });

      logger.info('✅ Roles padrão criados com sucesso!');
      logger.info(`📋 User Role ID: ${userRole.id}`);
      logger.info(`📋 Admin Role ID: ${adminRole.id}`);
    } else {
      logger.info('⚠️  Roles já existem no sistema.');
      
      // Garantir que pelo menos um role seja padrão
      const defaultRole = await prisma.userRole.findFirst({
        where: { isDefault: true }
      });
      
      if (!defaultRole) {
        await prisma.userRole.updateMany({
          where: { name: 'user' },
          data: { isDefault: true }
        });
        logger.info('✅ Role "user" marcado como padrão.');
      }
    }

    // 2. Criar usuário administrador padrão
    logger.info('👤 Verificando usuário administrador...');
    
    const existingAdmin = await prisma.user.findFirst({
      where: { email: 'admin@indicadores.com' }
    });

    if (!existingAdmin) {
      // Buscar role de admin
      const adminRole = await prisma.userRole.findFirst({
        where: { name: 'admin' }
      });

      if (!adminRole) {
        throw new Error('Role de administrador não encontrado!');
      }

      // Hash da senha
      const hashedPassword = await bcrypt.hash('admin123', 12);

      // Criar usuário administrador
      const adminUser = await prisma.user.create({
        data: {
          name: 'Administrador do Sistema',
          email: 'admin@indicadores.com',
          login: 'admin',
          password: hashedPassword,
          roleId: adminRole.id,
          isActive: true,
          status: 'active'
        }
      });

      logger.info('✅ Usuário administrador criado com sucesso!');
      logger.info(`📧 Email: admin@indicadores.com`);
      logger.info(`🔑 Senha: admin123`);
      logger.info(`👤 Role: admin`);
      logger.info(`🆔 User ID: ${adminUser.id}`);
    } else {
      logger.info('⚠️  Usuário administrador já existe.');
    }

    // 3. Configurações do sync-service serão criadas pelo próprio sync-service
    logger.info('⚙️  Configurações do sync-service serão criadas pelo próprio serviço.');

    logger.info('🎉 Inicialização da base de dados concluída com sucesso!');
    logger.info('');
    logger.info('📋 RESUMO:');
    logger.info('   • Roles padrão: user (padrão), admin');
    logger.info('   • Usuário administrador: admin@indicadores.com / admin123');
    logger.info('   • Configuração do sync-service: criada');
    logger.info('');
    logger.info('⚠️  IMPORTANTE:');
    logger.info('   • Altere a senha do administrador após o primeiro login');
    logger.info('   • Configure as notificações conforme necessário');
    logger.info('   • Ajuste as configurações do sync-service se necessário');

  } catch (error) {
    logger.error('❌ Erro durante a inicialização da base de dados:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      logger.info('✅ Script de inicialização executado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Falha na inicialização:', error);
      process.exit(1);
    });
}

export { initializeDatabase };
