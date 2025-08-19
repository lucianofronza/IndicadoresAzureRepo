FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership and set proper permissions
RUN chown -R nodejs:nodejs /app
RUN chmod -R 755 /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5173

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5173/ || exit 1

# Start application in development mode with Docker config
CMD ["npm", "run", "dev", "--", "--config", "vite.config.docker.ts", "--host", "0.0.0.0"]
