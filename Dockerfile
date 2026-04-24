FROM node:25-alpine AS base

# Stage 1: Build the frontend
FROM base AS frontend-builder
WORKDIR /app/frontend

RUN npm install -g pnpm

COPY services/frontend/package.json services/frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY services/frontend/ ./

ENV NEXT_TELEMETRY_DISABLED=1
ENV GENERATE_SOURCEMAP=false
ENV NEXT_LINT_DISABLED=1
ENV NEXT_TYPECHECK_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=1024"

RUN pnpm run build

# Stage 2: Build the backend
FROM golang:1.26-alpine AS backend-builder
WORKDIR /app/backend

ENV GOCACHE=/tmp/go-cache
ENV GOPATH=/go
ENV HOME=/tmp

COPY services/backend/go.mod services/backend/go.sum ./
RUN go mod download
COPY services/backend/ ./
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o justapps-backend

# Stage 3: Final image
FROM base AS runner
WORKDIR /app

RUN apk update && apk add --no-cache \
    ca-certificates \
    tini \
    postgresql-client

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

RUN mkdir .next \
    && chown nextjs:nodejs .next

COPY --from=frontend-builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=frontend-builder --chown=nextjs:nodejs /app/frontend/.next/static ./.next/static
COPY --from=frontend-builder --chown=nextjs:nodejs /app/frontend/public /app/public

COPY --from=backend-builder /app/backend/justapps-backend /app/justapps-backend

RUN chown -R nextjs:nodejs /app

RUN mkdir -p /etc/justapps \
    && chown -R nextjs:nodejs /etc/justapps

RUN mkdir -p /app/data \
    && chown -R nextjs:nodejs /app/data

ENV NODE_ENV=production

VOLUME [ "/etc/justapps", "/app/data" ]

EXPOSE 8080 3000

USER nextjs

ENTRYPOINT ["/sbin/tini", "--"]

CMD ["sh", "-c", "./justapps-backend --config /etc/justapps/config.yaml & node /app/server.js"]
