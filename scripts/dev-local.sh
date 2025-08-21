#!/bin/bash

# ========================================
# LOCAL DEVELOPMENT SCRIPT
# ========================================
# This script sets up the development environment with database services only
# Backend and Frontend run locally for maximum performance

set -e

echo "🚀 Setting up Local Development Environment..."

# Check if .env.docker exists
if [ ! -f ".env.docker" ]; then
  echo "❌ Error: .env.docker file not found!"
  echo ""
  echo "💡 Please create the .env.docker file:"
  echo "   cp env.docker.example .env.docker"
  echo "   # Then edit .env.docker with your values"
  exit 1
fi

# Load environment variables
echo "📋 Loading environment variables from .env.docker..."
export $(cat .env.docker | grep -v '^#' | xargs)

# Validate environment variables
echo "🔍 Validating environment variables..."
./scripts/validate-env.sh

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Error: Docker is not running!"
  echo "   Please start Docker and try again"
  exit 1
fi

echo "🐳 Starting database services..."
echo "   PostgreSQL: localhost:${POSTGRES_PORT:-5432}"
echo "   Redis: localhost:${REDIS_PORT:-6379}"
echo ""

# Start database services
docker-compose --env-file .env.docker -f docker-compose.dev.yml up -d

echo "⏳ Waiting for database services..."

# Wait for PostgreSQL
echo "   Waiting for PostgreSQL..."
until docker-compose --env-file .env.docker -f docker-compose.dev.yml exec -T postgres pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-indicadores_azure} > /dev/null 2>&1; do
  sleep 2
done

# Wait for Redis
echo "   Waiting for Redis..."
until docker-compose --env-file .env.docker -f docker-compose.dev.yml exec -T redis redis-cli ping > /dev/null 2>&1; do
  sleep 2
done

echo ""
echo "✅ Database services are ready!"
echo ""

# Check if backend dependencies are installed
if [ ! -d "backend/node_modules" ]; then
  echo "📦 Installing backend dependencies..."
  cd backend
  npm install
  cd ..
fi

# Check if frontend dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
  echo "📦 Installing frontend dependencies..."
  cd frontend
  npm install
  cd ..
fi

echo ""
echo "🎯 Development Environment Ready!"
echo ""
echo "📊 Services:"
echo "   ✅ PostgreSQL: localhost:${POSTGRES_PORT:-5432}"
echo "   ✅ Redis: localhost:${REDIS_PORT:-6379}"
echo ""
echo "🚀 Start your applications:"
echo ""
echo "   Terminal 1 - Backend:"
echo "   cd backend && npm run dev"
echo ""
echo "   Terminal 2 - Frontend:"
echo "   cd frontend && npm run dev"
echo ""
echo "🌐 Application URLs:"
echo "   Frontend: http://localhost:5173"
echo "   Backend API: http://localhost:8080"
echo "   Health Check: http://localhost:8080/healthz"
echo ""
echo "🔧 Useful commands:"
echo "   Stop database: docker-compose --env-file .env.docker -f docker-compose.dev.yml down"
echo "   View logs: docker-compose --env-file .env.docker -f docker-compose.dev.yml logs -f"
echo "   Reset database: docker-compose --env-file .env.docker -f docker-compose.dev.yml down -v"
echo ""
echo "💡 Tips:"
echo "   • Backend and Frontend have hot-reload enabled"
echo "   • Database data persists between restarts"
echo "   • Use 'npm run db:seed' to populate test data"
echo "   • Use 'npm run db:seed:demo' for full demo data"
