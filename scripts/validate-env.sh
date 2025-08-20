#!/bin/bash

# ========================================
# ENVIRONMENT VARIABLES VALIDATION SCRIPT
# ========================================
# This script validates that all required environment variables are set

set -e

echo "🔍 Validating environment variables..."

# Required variables for Docker
required_vars=(
  "POSTGRES_PASSWORD"
  "JWT_SECRET"
  "ENCRYPTION_KEY"
)

# Optional variables with defaults
optional_vars=(
  "POSTGRES_DB=indicadores_azure"
  "POSTGRES_USER=postgres"
  "POSTGRES_PORT=5432"
  "REDIS_PORT=6379"
  "REDIS_DB=0"
  "NODE_ENV=development"
  "PORT=8080"
  "LOG_LEVEL=debug"
  "FRONTEND_URL=http://localhost:5173"
  "BACKEND_PORT=8080"
  "FRONTEND_PORT=5173"
  "HEALTH_CHECK_INTERVAL=30s"
  "HEALTH_CHECK_TIMEOUT=10s"
  "HEALTH_CHECK_RETRIES=3"
)

# Check required variables
missing_vars=()
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    missing_vars+=("$var")
  fi
done

# Report missing variables
if [ ${#missing_vars[@]} -ne 0 ]; then
  echo "❌ Error: The following required environment variables are not set:"
  for var in "${missing_vars[@]}"; do
    echo "   - $var"
  done
  echo ""
  echo "💡 Please set these variables in your .env.docker file"
  echo "📋 Copy env.docker.example to .env.docker and customize the values"
  exit 1
fi

# Validate JWT_SECRET security
if [ "${#JWT_SECRET}" -lt 32 ]; then
  echo "⚠️  Warning: JWT_SECRET should be at least 32 characters long for security"
fi

# Validate ENCRYPTION_KEY format
if [ "${#ENCRYPTION_KEY}" -ne 32 ]; then
  echo "❌ Error: ENCRYPTION_KEY must be exactly 32 characters long"
  echo "   Current length: ${#ENCRYPTION_KEY} characters"
  exit 1
fi

# Validate POSTGRES_PASSWORD security
if [ "${#POSTGRES_PASSWORD}" -lt 8 ]; then
  echo "⚠️  Warning: POSTGRES_PASSWORD should be at least 8 characters long"
fi

# Show current configuration
echo "✅ All required environment variables are set!"
echo ""
echo "📊 Current configuration:"
echo "   Database: ${POSTGRES_DB:-indicadores_azure}@${POSTGRES_HOST:-localhost}:${POSTGRES_PORT:-5432}"
echo "   Redis: ${REDIS_HOST:-localhost}:${REDIS_PORT:-6379}"
echo "   Backend: ${BACKEND_PORT:-8080}"
echo "   Frontend: ${FRONTEND_PORT:-5173}"
echo "   Environment: ${NODE_ENV:-development}"
echo ""



echo "🚀 Environment validation completed successfully!"
