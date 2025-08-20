#!/bin/bash

# Script de setup inicial para Indicadores Azure Repos
set -e

echo "🚀 Iniciando setup do Indicadores Azure Repos..."

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não está instalado. Por favor, instale o Docker primeiro."
    exit 1
fi

# Verificar se Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose não está instalado. Por favor, instale o Docker Compose primeiro."
    exit 1
fi

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não está instalado. Por favor, instale o Node.js primeiro."
    exit 1
fi

echo "✅ Pré-requisitos verificados"

# Copiar arquivo de exemplo de variáveis de ambiente
if [ ! -f .env ]; then
    echo "📝 Copiando arquivo de variáveis de ambiente..."
    cp env.docker.example .env
    echo "⚠️  Configure as variáveis no arquivo .env antes de continuar"
    echo "   Especialmente POSTGRES_PASSWORD e ENCRYPTION_KEY"
fi

# Instalar dependências do backend
echo "📦 Instalando dependências do backend..."
cd backend
npm install

# Gerar cliente Prisma
echo "🔧 Gerando cliente Prisma..."
npx prisma generate

# Voltar para a raiz
cd ..

echo "✅ Setup inicial concluído!"
echo ""
echo "📋 Próximos passos:"
echo "1. Configure as variáveis no arquivo .env"
echo "2. Execute: docker-compose up -d"
echo "3. Execute as migrações: cd backend && npm run db:migrate"
echo "4. Execute o seed: cd backend && npm run db:seed"
echo "5. Acesse: http://localhost:\${BACKEND_PORT:-8080}/healthz"
echo ""
echo "📚 Para mais informações, consulte o README.md"
