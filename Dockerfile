FROM artifactory-jfrog.apps.ocp4.svc.prod.pl2cloud.de/plain-images/node:22-alpine AS base

# Stage 1: Build the frontend
FROM artifactory-jfrog.apps.ocp4.svc.prod.pl2cloud.de/plain-images/node:22-alpine AS frontend-builder
RUN apk add --no-cache libc6-compat
WORKDIR /app/frontend
COPY services/frontend/package.json services/frontend/pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm --version
RUN pnpm install
COPY services/frontend/ ./

ENV NEXT_TELEMETRY_DISABLED=1
# Increase memory limit for the build process
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Deaktiviert ESLint und Sourcemaps während des Builds
ENV NEXT_ESLINT_IGNORE=true
ENV NEXT_DISABLE_SOURCEMAPS=1
# Reduziert die CPU-Last und Worker für Next.js 15/16
ENV NEXT_BUILD_WORKERS=1
ENV EXPERIMENTAL_NEXT_CPUS=1
ENV NEXT_CPU_COUNT=1
# Erhöht den Speicher für den Node-Prozess
ENV NODE_OPTIONS="--max-old-space-size=3584"

# Wir nutzen den direkten Pfad zur Binary, um Overhead zu vermeiden
RUN CI=true ./node_modules/.bin/next build

# Stage 2: Build the backend
FROM artifactory-jfrog.apps.ocp4.svc.prod.pl2cloud.de/dhi-remote/golang:1.24-alpine3.23 AS backend-builder
WORKDIR /app/backend
COPY services/backend/go.mod services/backend/go.sum ./
RUN go mod download
COPY services/backend/ ./
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o app-store-backend

# Stage 3: Create the final image
FROM base AS runner
WORKDIR /app

# Install necessary packages
RUN apk update && apk add --no-cache \
    ca-certificates \
    tini \
    postgresql-client

# Create user and group
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Set the correct permission for prerender cache
RUN mkdir .next \
    && chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=frontend-builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=frontend-builder --chown=nextjs:nodejs /app/frontend/.next/static ./.next/static
COPY --from=frontend-builder --chown=nextjs:nodejs /app/frontend/public /app/public

# Copy the backend binary LAST and explicitly to the WORKDIR
COPY --from=backend-builder /app/backend/app-store-backend /app/app-store-backend

# Copy .env file to the working directory
COPY --from=frontend-builder --chown=nextjs:nodejs /app/frontend/.env /app/.env

RUN chown -R nextjs:nodejs /app

RUN mkdir -p /etc/app-store \
    && chown -R nextjs:nodejs /etc/app-store

RUN mkdir -p /app/data \
    && chown -R nextjs:nodejs /app/data

# Set environment variables
ENV NODE_ENV=production

VOLUME [ "/etc/app-store", "/app/data" ]

# Expose ports
EXPOSE 8080 3000

USER nextjs

# Use tini as the entrypoint
ENTRYPOINT ["/sbin/tini", "--"]

# Start the backend and frontend
CMD ["sh", "-c", "./app-store-backend --config /etc/app-store/config.yaml & node /app/server.js"]