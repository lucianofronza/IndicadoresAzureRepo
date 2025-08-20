#!/bin/bash

# ========================================
# DOCKER STARTUP SCRIPT
# ========================================
# This script validates environment variables and starts Docker services

set -e

echo "🐳 Starting Indicadores Azure Repos with Docker..."

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

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
  echo "❌ Error: Docker Compose is not installed!"
  echo "   Please install Docker Compose and try again"
  exit 1
fi

echo "🚀 Starting Docker services..."
echo "   Database: ${POSTGRES_DB:-indicadores_azure}@localhost:${POSTGRES_PORT:-5432}"
echo "   Redis: localhost:${REDIS_PORT:-6379}"
echo "   Backend: localhost:${BACKEND_PORT:-8080}"
echo "   Frontend: localhost:${FRONTEND_PORT:-5173}"
echo ""

# Start services
docker-compose up -d

echo "⏳ Waiting for services to be ready..."

# Wait for PostgreSQL
echo "   Waiting for PostgreSQL..."
until docker-compose exec -T postgres pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-indicadores_azure} > /dev/null 2>&1; do
  sleep 2
done

# Wait for Redis
echo "   Waiting for Redis..."
until docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; do
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
echo "🎉 All services are ready!"
echo ""
echo "📊 Application URLs:"
echo "   Frontend: http://localhost:${FRONTEND_PORT:-5173}"
echo "   Backend API: http://localhost:${BACKEND_PORT:-8080}"
echo "   Health Check: http://localhost:${BACKEND_PORT:-8080}/healthz"
echo ""
echo "🔧 Useful commands:"
echo "   View logs: docker-compose logs -f"
echo "   Stop services: docker-compose down"
echo "   Restart services: docker-compose restart"
echo "   View status: docker-compose ps"
