import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function setupServiceKeys() {
  try {
    console.log('🔐 Setting up service API keys for sync-service...');

    // Generate API keys
    const syncServiceKey = uuidv4();
    const backendKey = uuidv4();

    console.log('Generated API keys:');
    console.log(`Sync Service: ${syncServiceKey}`);
    console.log(`Backend: ${backendKey}`);

    // Create or update sync-service API key
    await prisma.serviceApiKey.upsert({
      where: { apiKey: syncServiceKey },
      update: {
        serviceName: 'sync-service',
        permissions: ['sync:admin'],
        isActive: true,
      },
      create: {
        serviceName: 'sync-service',
        apiKey: syncServiceKey,
        permissions: ['sync:admin'],
        isActive: true,
      },
    });

    // Create or update backend API key
    await prisma.serviceApiKey.upsert({
      where: { apiKey: backendKey },
      update: {
        serviceName: 'backend',
        permissions: [
          'sync:config:read',
          'sync:config:write',
          'sync:status:read',
          'sync:scheduler:control',
          'sync:monitor:read'
        ],
        isActive: true,
      },
      create: {
        serviceName: 'backend',
        apiKey: backendKey,
        permissions: [
          'sync:config:read',
          'sync:config:write',
          'sync:status:read',
          'sync:scheduler:control',
          'sync:monitor:read'
        ],
        isActive: true,
      },
    });

    console.log('✅ Service API keys created successfully!');
    console.log('\n📋 Add these to your environment variables:');
    console.log(`SERVICE_API_KEY=${syncServiceKey}`);
    console.log(`BACKEND_API_KEY=${backendKey}`);
    console.log('\n⚠️  Keep these keys secure and do not commit them to version control!');

  } catch (error) {
    console.error('❌ Error setting up service keys:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
setupServiceKeys()
  .then(() => {
    console.log('🎉 Setup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Setup failed:', error);
    process.exit(1);
  });
