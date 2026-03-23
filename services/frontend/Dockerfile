# Base image
FROM node:25-alpine AS base

# 1. Platform Setup: Install pnpm and configure auth
FROM base AS platform
WORKDIR /app

# Install pnpm using the secret mount for CA trust
RUN npm install -g pnpm

# 2. Dependencies Stage
FROM platform AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./

# Install project dependencies
RUN pnpm install --frozen-lockfile

# 3. Builder Stage
FROM platform AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Learn more here: https://nextjs.org/telemetry
ENV NEXT_TELEMETRY_DISABLED 1

# Optimize for low resource environments
# Disable source maps completely
ENV GENERATE_SOURCEMAP=false
# Skip all checks
ENV NEXT_LINT_DISABLED=1
ENV NEXT_TYPECHECK_DISABLED=1
# Use a more conservative memory limit (1GB) to ensure OS has breathing room in a 2GB VM
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Use the CA certificate during the build to fetch external resources (fonts etc)
# Also enable Turbopack system TLS certs as suggested by the error
RUN pnpm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/config.yaml ./config.yaml

USER nextjs

EXPOSE 3000

ENV PORT 3000
# set hostname to localhost
ENV HOSTNAME "0.0.0.0"

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"]
