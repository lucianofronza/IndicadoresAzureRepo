#!/bin/bash

# Setup script for sync-service integration
# This script sets up the complete sync-service environment

set -e

echo "🚀 Setting up Sync Service Integration"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env.docker exists
if [ ! -f ".env.docker" ]; then
    print_error ".env.docker file not found!"
    print_status "Please copy env.docker.example to .env.docker and configure it"
    exit 1
fi

print_status "Setting up backend dependencies..."
cd backend

# Install dependencies
print_status "Installing backend dependencies..."
npm install

# Generate Prisma client
print_status "Generating Prisma client..."
npm run db:generate

# Run migrations
print_status "Running database migrations..."
npm run db:migrate

# Create default roles
print_status "Creating default roles..."
npm run db:create-roles

# Setup service API keys
print_status "Setting up service API keys..."
npm run db:setup-service-keys

cd ..

print_status "Setting up sync-service dependencies..."
cd sync-service

# Install dependencies
print_status "Installing sync-service dependencies..."
npm install

# Generate Prisma client
print_status "Generating Prisma client..."
npx prisma generate

# Run migrations (if needed)
print_status "Running database migrations..."
npx prisma migrate dev --name init

# Setup service API keys
print_status "Setting up service API keys..."
npm run db:setup-service-keys

cd ..

print_success "✅ Setup completed successfully!"
echo ""
print_status "📋 Next steps:"
echo "1. Update your .env.docker file with the generated API keys"
echo "2. Start the services:"
echo "   - Backend: cd backend && npm run dev"
echo "   - Sync Service: cd sync-service && npm run dev"
echo "   - Or use Docker: docker-compose up -d"
echo ""
print_status "🔗 Service URLs:"
echo "   - Backend API: http://localhost:8080"
echo "   - Sync Service: http://localhost:8081"
echo "   - Frontend: http://localhost:5173"
echo ""
print_warning "⚠️  Remember to keep your API keys secure!"
echo ""
print_success "🎉 Sync Service Integration is ready!"
