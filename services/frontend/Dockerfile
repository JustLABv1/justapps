# Base image
FROM artifactory-jfrog.apps.ocp4.svc.prod.pl2cloud.de/plain-images/node:24-alpine@sha256:e922633a7cfbc0d6db6b6854a45ebf2452772b483b481540fe906ee1f8146599 AS base

# Install dependencies only when needed
FROM base AS deps

# Accept CA as build argument
ARG PLAIN2_ROOT_CA

WORKDIR /app

# Configure trust for internal CA if provided
# We write to a temp file and use it directly for npm config to avoid any path resolution issues
RUN if [ -n "$PLAIN2_ROOT_CA" ]; then \
      echo "$PLAIN2_ROOT_CA" > /app/internal-ca.crt && \
      update-ca-certificates; \
    fi

# set npm to use the provided CA certificate directly
RUN if [ -f /app/internal-ca.crt ]; then \
      npm config set cafile /app/internal-ca.crt; \
    fi

# Install dependencies
COPY package.json pnpm-lock.yaml ./

# create .npmrc to set registry and auth token for private packages
RUN echo "registry=https://artifactory-jfrog.apps.ocp4.svc.prod.pl2cloud.de/artifactory/api/npm/npm-remote/" > .npmrc && \
    echo "//artifactory-jfrog.apps.ocp4.svc.prod.pl2cloud.de/artifactory/api/npm/npm-remote/:_authToken=\${NPM_TOKEN}" >> .npmrc

# Install pnpm using the internal registry. If we have a CA file, pnpm and npm will use it.
RUN CA_FLAG=""; if [ -f /app/internal-ca.crt ]; then CA_FLAG="--cafile /app/internal-ca.crt"; fi && \
    npm install -g pnpm --registry=https://artifactory-jfrog.apps.ocp4.svc.prod.pl2cloud.de/artifactory/api/npm/npm-remote/ $CA_FLAG && \
    pnpm config set cafile /app/internal-ca.crt && \
    pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /usr/local/lib/node_modules/pnpm /usr/local/lib/node_modules/pnpm
COPY --from=deps /usr/local/bin/pnpm /usr/local/bin/pnpm
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
