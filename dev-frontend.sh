#!/bin/bash

echo "🚀 Iniciando Frontend em modo desenvolvimento..."

# Verificar se o backend está rodando
echo "🔍 Verificando se o backend está rodando..."
if ! curl -s http://localhost:8080/healthz > /dev/null; then
    echo "⚠️  Backend não está rodando na porta 8080"
    echo "💡 Execute primeiro: ./dev-backend.sh"
    exit 1
fi

# Iniciar frontend em modo desenvolvimento
echo "🔥 Iniciando Frontend na porta 5173..."
cd frontend
npm run dev
