#!/bin/bash

# ========================================
# DOCKER DEVELOPMENT ENVIRONMENT SCRIPT
# ========================================
# This script starts only the database services for development
# Backend and Frontend should be run locally for better performance

set -e

# Set Docker Compose timeout to avoid build timeouts
export COMPOSE_HTTP_TIMEOUT=300

echo "🐳 Starting Indicadores Azure Repos Development Environment..."

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

echo "🚀 Starting Development services (Database only)..."
echo "   Database: ${POSTGRES_DB:-indicadores_azure}@localhost:${POSTGRES_PORT:-5432}"
echo "   Redis: localhost:${REDIS_PORT:-6379}"
echo ""

# Start only database services
docker-compose --env-file .env.docker -f docker-compose.dev.yml up -d

echo "⏳ Waiting for services to be ready..."

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
echo "🎉 Database services are ready!"
echo ""
echo "📊 Database URLs:"
echo "   PostgreSQL: localhost:${POSTGRES_PORT:-5432}"
echo "   Redis: localhost:${REDIS_PORT:-6379}"
echo ""
echo "🚀 Next steps - Start Backend and Frontend locally:"
echo ""
echo "   Backend:"
echo "   cd backend"
echo "   npm install"
echo "   npm run dev"
echo ""
echo "   Frontend:"
echo "   cd frontend"
echo "   npm install"
echo "   npm run dev"
echo ""
echo "🔧 Development Features:"
echo "   ✅ Hot-reload enabled for backend and frontend"
echo "   ✅ Fast development cycle"
echo "   ✅ Database services isolated in containers"
echo "   ✅ Easy debugging and logging"
echo ""
echo "🔧 Useful commands:"
echo "   View logs: docker-compose --env-file .env.docker -f docker-compose.dev.yml logs -f"
echo "   Stop services: docker-compose --env-file .env.docker -f docker-compose.dev.yml down"
echo "   Restart services: docker-compose --env-file .env.docker -f docker-compose.dev.yml restart"
echo "   View status: docker-compose --env-file .env.docker -f docker-compose.dev.yml ps"
