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

# Setup database
echo "🗄️ Setting up database..."
cd backend

# Generate Prisma client
echo "   Generating Prisma client..."
npm run db:generate

# Run database migrations
echo "   Running database migrations..."
npm run db:migrate

# Ask user if they want to seed the database
echo ""
echo "🌱 Database setup completed!"
echo ""
read -p "Do you want to populate the database with sample data? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "   Populating database with sample data..."
  npm run db:seed:demo
  echo "✅ Database populated with sample data!"
else
  echo "ℹ️  Database is empty. You can populate it later with:"
  echo "   cd backend && npm run db:seed:demo"
fi

cd ..

echo ""
echo "🎯 Development Environment Ready!"
echo ""
echo "📊 Services:"
echo "   ✅ PostgreSQL: localhost:${POSTGRES_PORT:-5432}"
echo "   ✅ Redis: localhost:${REDIS_PORT:-6379}"
echo "   ✅ Database: Migrated and ready"
echo ""

# Ask user if they want to start the applications
echo ""
read -p "Do you want to start the backend and frontend applications? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🚀 Starting applications..."
  echo ""
  
  # Start backend in background
  echo "   Starting backend..."
  cd backend
  npm run dev &
  BACKEND_PID=$!
  cd ..
  
  # Wait a bit for backend to start
  sleep 5
  
  # Start frontend in background
  echo "   Starting frontend..."
  cd frontend
  npm run dev &
  FRONTEND_PID=$!
  cd ..
  
  echo ""
  echo "✅ Applications started!"
  echo ""
  echo "🌐 Application URLs:"
  echo "   Frontend: http://localhost:5173"
  echo "   Backend API: http://localhost:8080"
  echo "   Health Check: http://localhost:8080/healthz"
  echo ""
  echo "📊 Running processes:"
  echo "   Backend PID: $BACKEND_PID"
  echo "   Frontend PID: $FRONTEND_PID"
  echo ""
  echo "💡 To stop the applications:"
  echo "   kill $BACKEND_PID $FRONTEND_PID"
  echo ""
  echo "🔧 Useful commands:"
  echo "   Stop database: docker-compose --env-file .env.docker -f docker-compose.dev.yml down"
  echo "   View logs: docker-compose --env-file .env.docker -f docker-compose.dev.yml logs -f"
  echo "   Reset database: docker-compose --env-file .env.docker -f docker-compose.dev.yml down -v"
  echo "   Seed database: cd backend && npm run db:seed:demo"
  echo ""
  echo "💡 Tips:"
  echo "   • Backend and Frontend have hot-reload enabled"
  echo "   • Database data persists between restarts"
  echo "   • Backend automatically loads environment from .env.docker"
  echo "   • Use 'npm run db:seed' for basic data or 'npm run db:seed:demo' for full demo data"
  echo ""
  echo "🎉 Development environment is fully ready!"
  echo "   Press Ctrl+C to stop all services"
  
  # Wait for user to stop
  wait
else
  echo ""
  echo "🚀 Manual start instructions:"
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
  echo "   Seed database: cd backend && npm run db:seed:demo"
  echo ""
  echo "💡 Tips:"
  echo "   • Backend and Frontend have hot-reload enabled"
  echo "   • Database data persists between restarts"
  echo "   • Backend automatically loads environment from .env.docker"
  echo "   • Use 'npm run db:seed' for basic data or 'npm run db:seed:demo' for full demo data"
fi
