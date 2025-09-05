#!/bin/bash

# Script para configurar ambiente Azure AD

echo "🚀 Configurando ambiente Azure AD..."

# Verificar se o arquivo .env.docker já existe
if [ -f ".env.docker" ]; then
    echo "⚠️  Arquivo .env.docker já existe!"
    read -p "Deseja sobrescrever? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Configuração cancelada."
        exit 1
    fi
fi

# Copiar arquivo de exemplo
echo "📋 Copiando arquivo de exemplo..."
cp env.docker.example .env.docker

echo "✅ Arquivo .env.docker criado!"
echo ""
echo "📝 Próximos passos:"
echo "1. Edite o arquivo .env.docker com suas credenciais Azure AD"
echo "2. Configure o App Registration no Azure Portal"
echo "3. Execute: npm run dev (backend e frontend)"
echo ""
echo "📖 Para mais detalhes, consulte: AZURE_AD_SETUP.md"
