# Stage 1: Build the frontend
FROM node:26.12.1-alpine3.24 AS frontend-builder
USER root
WORKDIR /app/frontend

RUN npm install -g pnpm

COPY services/frontend/package.json services/frontend/pnpm-lock.yaml services/frontend/pnpm-workspace.yaml ./
RUN pnpm install

COPY services/frontend/ ./

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm run build

# Stage 2: Build the documentation service
FROM node:26.12.1-alpine3.24 AS docs-builder
USER root
WORKDIR /app/docs

RUN npm install -g pnpm

COPY services/docs/package.json services/docs/pnpm-lock.yaml services/docs/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY services/docs/ ./

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# Stage 3: Build the backend
FROM golang:1.27.3-bookworm AS backend-builder
WORKDIR /app/backend
COPY services/backend/go.mod services/backend/go.sum ./
RUN go mod download
COPY services/backend/ ./
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o justapps-backend

# Stage 4: Create the final image
FROM alpine:3.24 AS runner
WORKDIR /app

RUN apk add --upgrade --no-cache \
    ca-certificates \
    libstdc++ \
    libatomic \
    tini \
    libcrypto3 \
    libssl3

# Copy only Node so package managers and build headers stay out of runtime layers.
COPY --from=frontend-builder /usr/local/bin/node /usr/local/bin/node
# Check shared libraries on the target architecture during the build.
RUN node --version

# Create user and group
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copy the backend binary
COPY --from=backend-builder /app/backend/justapps-backend /app/justapps-backend

# Copy the frontend build
COPY --from=frontend-builder /app/frontend/public /app/public

# Set the correct permission for prerender cache
RUN mkdir .next \
    && chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=frontend-builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=frontend-builder --chown=nextjs:nodejs /app/frontend/.next/static ./.next/static

# Copy the documentation standalone server into its own directory so it can
# run beside the frontend process on an internal port.
COPY --from=docs-builder --chown=nextjs:nodejs /app/docs/public /app/docs/public
COPY --from=docs-builder --chown=nextjs:nodejs /app/docs/.next/standalone /app/docs/
COPY --from=docs-builder --chown=nextjs:nodejs /app/docs/.next/static /app/docs/.next/static

RUN chown -R nextjs:nodejs /app

RUN mkdir -p /etc/justapps \
    && chown -R nextjs:nodejs /etc/justapps

RUN mkdir -p /app/data \
    && chown -R nextjs:nodejs /app/data

ENV NODE_ENV=production

VOLUME [ "/etc/justapps", "/app/data" ]

EXPOSE 8080 3000 3001

USER nextjs

ENTRYPOINT ["/sbin/tini", "--"]

CMD ["sh", "-c", "./justapps-backend --config /etc/justapps/config.yaml & PORT=3001 HOSTNAME=0.0.0.0 node /app/docs/server.js & node /app/server.js"]
