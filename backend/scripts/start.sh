#!/bin/sh

set -e

echo "🚀 Starting Indicadores Azure Backend..."

# Function to wait for database
wait_for_database() {
    echo "⏳ Waiting for database to be ready..."
    
    # Extract database connection details from DATABASE_URL
    # Format: postgresql://user:password@host:port/database
    DB_URL=${DATABASE_URL}
    
    # Wait for database to be ready
    until npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; do
        echo "   Database not ready yet, waiting 5 seconds..."
        sleep 5
    done
    
    echo "✅ Database is ready!"
}

# Function to run migrations
run_migrations() {
    echo "🔄 Running database migrations..."
    
    # Check if migrations need to be applied
    if npx prisma migrate status --json | grep -q '"applied": 0'; then
        echo "   Applying pending migrations..."
        npx prisma migrate deploy
        echo "✅ Migrations applied successfully!"
    else
        echo "✅ No pending migrations to apply."
    fi
}

# Function to generate Prisma client
generate_prisma_client() {
    echo "🔧 Generating Prisma client..."
    npx prisma generate
    echo "✅ Prisma client generated!"
}



# Main execution
main() {
    echo "📋 Environment: $NODE_ENV"
    echo "📊 Database URL: $DATABASE_URL"
    
    # Wait for database
    wait_for_database
    
    # Generate Prisma client
    generate_prisma_client
    
    # Run migrations
    run_migrations
    
    echo "🎉 Database setup completed!"
    echo "🚀 Starting application..."
    
    # Start the application
    exec npm run dev
}

# Run main function
main "$@"
