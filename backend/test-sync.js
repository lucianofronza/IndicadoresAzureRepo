const { PrismaClient } = require('@prisma/client');
const { SyncService } = require('./backend/src/services/syncService');

async function testSync() {
  const prisma = new PrismaClient();
  const syncService = new SyncService();
  
  try {
    // Buscar o repositório Reservas
    const repository = await prisma.repository.findFirst({
      where: { name: 'Reservas' }
    });
    
    if (!repository) {
      console.log('Repositório Reservas não encontrado');
      return;
    }
    
    console.log('Repositório encontrado:', repository.name);
    console.log('ID:', repository.id);
    
    // Tentar iniciar sincronização
    console.log('Iniciando sincronização...');
    const result = await syncService.startSync(repository.id, 'incremental');
    console.log('Job de sincronização criado:', result);
    
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testSync();
