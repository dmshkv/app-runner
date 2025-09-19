# ---- build stage ----
FROM node:20-slim AS builder
WORKDIR /app-runner-workspace

# Copy package files first for better layer caching
COPY package*.json ./
COPY nx.json tsconfig*.json ./

# Install dependencies
ENV CI=1
RUN npm ci --omit=optional --no-audit --no-fund

# Copy source code
COPY apps apps

# Build the root app
RUN npx nx build root

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app

# Install a tiny static server
RUN npm i -g serve

# Copy built assets from correct output path
COPY --from=builder /app-runner-workspace/dist/apps/web/root ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

ENV PORT=3000
EXPOSE 3000

# Serve static build (single-page app)
CMD ["serve", "-s", "dist", "-l", "3000"]
    