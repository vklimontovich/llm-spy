# Stage 1: Dependencies
FROM oven/bun:1-slim AS deps

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install all dependencies (including dev dependencies)
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# Stage 2: Builder
FROM oven/bun:1-slim AS builder

WORKDIR /app

# Install git for proto:fetch step and Node.js for proto:generate
# Node.js is needed because protobufjs-cli's pbts tool depends on jsdoc/requizzle
# which uses Node.js internal API Module.load() that Bun doesn't implement on Linux
# (works on macOS but fails on Linux). This only affects the build stage.
RUN apt-get update && apt-get install -y git nodejs npm && rm -rf /var/lib/apt/lists/*

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate OpenTelemetry proto files
RUN bun run proto:fetch

# Use Node.js (npx) instead of Bun for proto:generate to avoid Module.load() incompatibility
# This command runs pbjs and pbts which require Node.js internal APIs
RUN npx pbjs -t static-module -w commonjs -p src/generated -o src/generated/otel-proto.js 'src/generated/opentelemetry/proto/**/*.proto' && \
    npx pbts -o src/generated/otel-proto.d.ts src/generated/otel-proto.js

# Generate Prisma client and build the Next.js app (using Bun)
# No dummy env vars needed - server-env.ts detects NEXT_PHASE=phase-production-build
# and skips validation automatically during the build
RUN bun prisma generate

# Enable standalone output mode for Docker builds
# This creates a minimal bundle with only necessary runtime dependencies
ENV NEXT_BUILD_STANDALONE=1
RUN --mount=type=cache,target=/app/.next/cache \
    bun run build

# Stage 3: Production runtime
FROM oven/bun:1-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install OpenSSL 3.0 for Prisma Client compatibility
# Prisma requires OpenSSL to be available at runtime
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output (includes minimal node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static files
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy prisma schema for db-sync command
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Copy generated files needed at runtime
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated

# Log disk usage to identify what's taking up space
RUN echo "=== Disk usage breakdown ===" && \
    du -sh /app/* | sort -h && \
    echo "==========================="

USER nextjs
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Entrypoint script to support db-sync command
COPY --chown=nextjs:nodejs <<'EOF' /app/entrypoint.sh
#!/bin/sh
set -e

if [ "$1" = "db-sync" ]; then
  echo "Running database sync..."
  exec bunx prisma db push --accept-data-loss
else
  # Use standalone server.js from Next.js standalone output
  exec bun server.js
fi
EOF

RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
CMD []
