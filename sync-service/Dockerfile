# Use Node.js 20 Alpine as base image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Build the application
FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Production image (running with tsx instead of building)
FROM base AS runner
WORKDIR /app

# Install production dependencies + tsx
COPY package*.json ./
RUN npm ci && npm install -g tsx

# Copy source code and config
COPY --from=builder /app/src ./src
COPY --from=builder /app/config ./config
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 syncservice

# Set ownership
RUN chown -R syncservice:nodejs /app
USER syncservice

# Expose port
EXPOSE 8080

# Health check (using Node.js)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/healthz', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application with tsx (TypeScript executor)
# The .env file is not needed as environment variables are passed by docker-compose
CMD ["tsx", "src/index.ts"]
