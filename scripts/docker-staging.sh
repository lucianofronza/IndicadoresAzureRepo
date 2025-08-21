#!/bin/bash

# ========================================
# DOCKER STAGING ENVIRONMENT SCRIPT
# ========================================
# This script starts the staging environment for testing

set -e

echo "🐳 Starting Indicadores Azure Repos Staging Environment..."

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

echo "🚀 Starting Staging services..."
echo "   Database: ${POSTGRES_DB:-indicadores_azure_staging}@localhost:${POSTGRES_PORT:-5432}"
echo "   Redis: localhost:${REDIS_PORT:-6379}"
echo "   Backend: localhost:${BACKEND_PORT:-8080}"
echo "   Frontend: localhost:${FRONTEND_PORT:-5173}"
echo ""

# Start staging services
docker-compose --env-file .env.docker -f docker-compose.staging.yml up -d

echo "⏳ Waiting for services to be ready..."

# Wait for PostgreSQL
echo "   Waiting for PostgreSQL..."
until docker-compose --env-file .env.docker -f docker-compose.staging.yml exec -T postgres pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-indicadores_azure_staging} > /dev/null 2>&1; do
  sleep 2
done

# Wait for Redis
echo "   Waiting for Redis..."
until docker-compose --env-file .env.docker -f docker-compose.staging.yml exec -T redis redis-cli ping > /dev/null 2>&1; do
  sleep 2
done

# Wait for Backend
echo "   Waiting for Backend..."
until curl -f http://localhost:${BACKEND_PORT:-8080}/healthz > /dev/null 2>&1; do
  sleep 5
done

# Wait for Frontend
echo "   Waiting for Frontend..."
until curl -f http://localhost:${FRONTEND_PORT:-5173}/ > /dev/null 2>&1; do
  sleep 5
done

echo ""
echo "🎉 Staging environment is ready!"
echo ""
echo "📊 Application URLs:"
echo "   Frontend: http://localhost:${FRONTEND_PORT:-5173}"
echo "   Backend API: http://localhost:${BACKEND_PORT:-8080}"
echo "   Health Check: http://localhost:${BACKEND_PORT:-8080}/healthz"
echo ""
echo "🔧 Staging Features:"
echo "   ✅ Production-like environment"
echo "   ✅ Isolated data from development"
echo "   ✅ Testing environment ready"
echo "   ✅ Staging containers isolated"
echo ""
echo "🔧 Useful commands:"
echo "   View logs: docker-compose --env-file .env.docker -f docker-compose.staging.yml logs -f"
echo "   Stop services: docker-compose --env-file .env.docker -f docker-compose.staging.yml down"
echo "   Restart services: docker-compose --env-file .env.docker -f docker-compose.staging.yml restart"
echo "   View status: docker-compose --env-file .env.docker -f docker-compose.staging.yml ps"
