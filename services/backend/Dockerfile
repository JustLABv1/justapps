FROM artifactory-jfrog.apps.ocp4.svc.prod.pl2cloud.de/dhi-remote/golang:1.24-alpine3.23 as builder

# Ensure we are root (UID 0) to install certificates
# Using UID 0 directly avoids "unknown user" errors if /etc/passwd is missing
USER 0

WORKDIR /app/backend

ARG PLAIN_USER
ARG GO_TOKEN

# Configure trust for internal CA using the secret mount (same strategy as frontend)
RUN --mount=type=secret,id=ca-bundle \
    if [ -f /run/secrets/ca-bundle ]; then \
      cp /run/secrets/ca-bundle /usr/local/share/ca-certificates/internal-ca.crt && \
      update-ca-certificates; \
    fi

COPY go.mod go.sum ./

# Configure Go to use Artifactory Proxy
# We set GOPROXY using `go env -w` so it persists for this user, OR simply export it
# Setting via ENV is fine for builder stage
ENV GOPROXY="https://${PLAIN_USER}:${GO_TOKEN}@artifactory-jfrog.apps.ocp4.svc.prod.pl2cloud.de/artifactory/api/go/demo-go-virtual"
# Disable sumdb validation since we are using a private proxy that might serve private modules
ENV GONOSUMDB="*"

# Run go mod download with the CA certs available
RUN go mod download

COPY . .

# Build
RUN go build -o community-store-backend

FROM alpine:3.22 as runner
WORKDIR /app

COPY --from=builder /app/backend/community-store-backend /app/

RUN addgroup --system --gid 1001 community-store
RUN adduser --system --uid 1001 community-store

RUN mkdir -p /etc/community-store \
    && chown -R community-store:community-store /etc/community-store

RUN mkdir -p /app/data \
    && chown -R community-store:community-store /app/data

RUN chown -R community-store:community-store /app

VOLUME [ "/etc/community-store", "/app/data" ]

EXPOSE 8080

CMD [ "/community-store-backend", "--config", "/etc/community-store/config.yaml" ]
