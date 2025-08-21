#!/bin/sh

set -e

echo "🚀 Starting Indicadores Azure Backend (Robust Mode)..."

# Function to wait for database
wait_for_database() {
    echo "⏳ Waiting for database to be ready..."
    
    # Wait for database to be ready (max 30 seconds)
    local max_attempts=6
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if echo "SELECT 1;" | npx prisma db execute --stdin > /dev/null 2>&1; then
            echo "✅ Database is ready!"
            return 0
        fi
        
        echo "   Database not ready yet, waiting 5 seconds... (attempt $((attempt + 1))/$max_attempts)"
        sleep 5
        attempt=$((attempt + 1))
    done
    
    echo "⚠️ Database not ready after 30 seconds, proceeding anyway..."
    return 1
}

# Function to run migrations
run_migrations() {
    echo "🔄 Running database migrations..."
    
    # Generate Prisma client first
    echo "   Generating Prisma client..."
    npx prisma generate
    
    # Check if migrations need to be applied
    echo "   Checking migration status..."
    if npx prisma migrate status --json | grep -q '"applied": 0'; then
        echo "   Applying pending migrations..."
        npx prisma migrate deploy
        echo "✅ Migrations applied successfully!"
    else
        echo "✅ No pending migrations to apply."
    fi
}



# Main execution
main() {
    echo "📋 Environment: $NODE_ENV"
    echo "📊 Database URL: $DATABASE_URL"
    
    # Wait for database
    wait_for_database
    
    # Run migrations
    run_migrations
    
    echo "🎉 Database setup completed!"
    echo "🚀 Starting application..."
    
    # Start the application
    exec npm run dev
}

# Run main function
main "$@"
