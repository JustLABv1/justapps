FROM artifactory-jfrog.apps.ocp4.svc.prod.pl2cloud.de/dhi-remote/golang:1.24-alpine3.23 as builder

# Ensure we are root (UID 0) to install certificates
USER 0

WORKDIR /app/backend

ARG PLAIN_USER
ARG GO_TOKEN

# Configure trust for internal CA using the secret mount.
# Instead of update-ca-certificates (which is missing), we copy the bundle
# and point the SSL_CERT_FILE environment variable to it.
RUN --mount=type=secret,id=ca-bundle \
    if [ -f /run/secrets/ca-bundle ]; then \
      cp /run/secrets/ca-bundle /app/backend/ca-bundle.crt; \
    fi

COPY go.mod go.sum ./

# Configure Go to use Artifactory Proxy and use the CA bundle for SSL verification
ENV GOPROXY="https://${PLAIN_USER}:${GO_TOKEN}@artifactory-jfrog.apps.ocp4.svc.prod.pl2cloud.de/artifactory/api/go/demo-go-virtual"
ENV GONOSUMDB="*"
ENV SSL_CERT_FILE=/app/backend/ca-bundle.crt

# Run go mod download
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
