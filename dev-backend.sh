#!/bin/bash

echo "🚀 Iniciando Backend em modo desenvolvimento..."

# Verificar se o PostgreSQL está rodando
if ! docker compose ps postgres | grep -q "Up"; then
    echo "📦 Iniciando PostgreSQL via Docker..."
    docker compose up postgres redis -d
    sleep 5
fi

# Verificar se o Redis está rodando
if ! docker compose ps redis | grep -q "Up"; then
    echo "📦 Iniciando Redis via Docker..."
    docker compose up redis -d
    sleep 3
fi

# Gerar Prisma Client
echo "🔧 Gerando Prisma Client..."
cd backend
npx prisma generate

# Iniciar backend em modo desenvolvimento
echo "🔥 Iniciando Backend na porta 8080..."
npm run dev
