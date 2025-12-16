# Dillanci Frontend - React + Vite
# Multi-stage build for optimized production image

# =============================================================================
# Stage 1: Dependencies - Install npm packages
# =============================================================================
FROM node:22-alpine as dependencies

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# =============================================================================
# Stage 2: Builder - Build the application
# =============================================================================
FROM node:22-alpine as builder

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# Build arguments for environment variables
ARG VITE_API_URL=/api/v1
ARG VITE_MOCK_API=false

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MOCK_API=$VITE_MOCK_API

# Build the application
RUN npm run build

# =============================================================================
# Stage 3: Production - Serve with nginx
# =============================================================================
FROM nginx:alpine as production

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user
RUN addgroup -g 1001 -S dillanci && \
    adduser -S -D -H -u 1001 -h /var/cache/nginx -s /sbin/nologin -G dillanci -g dillanci dillanci && \
    chown -R dillanci:dillanci /var/cache/nginx /var/run /var/log/nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Switch to non-root user
USER dillanci

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# =============================================================================
# Stage 4: Development - For local development with hot reload
# =============================================================================
FROM node:22-alpine as development

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies including dev
RUN npm ci --legacy-peer-deps

# Copy source code (will be overridden by volume mount in docker-compose)
COPY . .

# Environment variables
ENV VITE_API_URL=/api/v1
ENV VITE_MOCK_API=false

# Expose Vite dev server port
EXPOSE 3000

# Start development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
