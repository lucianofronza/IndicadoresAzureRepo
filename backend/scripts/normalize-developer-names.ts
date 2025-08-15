import { prisma } from '../src/config/database';

async function normalizeDeveloperNames() {
  try {
    console.log('🔄 Iniciando normalização dos nomes dos desenvolvedores...');
    
    // Buscar todos os desenvolvedores
    const developers = await prisma.developer.findMany({
      select: {
        id: true,
        name: true,
      }
    });
    
    console.log(`📋 Encontrados ${developers.length} desenvolvedores`);
    
    // Normalizar cada nome
    for (const developer of developers) {
      const normalizedName = developer.name
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      if (normalizedName !== developer.name) {
        console.log(`🔄 Atualizando: "${developer.name}" → "${normalizedName}"`);
        
        await prisma.developer.update({
          where: { id: developer.id },
          data: { name: normalizedName }
        });
      }
    }
    
    console.log('✅ Normalização concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro durante a normalização:', error);
  } finally {
    await prisma.$disconnect();
  }
}

normalizeDeveloperNames();
