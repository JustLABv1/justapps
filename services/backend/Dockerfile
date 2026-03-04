FROM artifactory-jfrog.apps.ocp4.svc.prod.pl2cloud.de/dhi-remote/golang:1.24-alpine3.23 as builder

WORKDIR /app/backend

COPY go.mod go.sum ./

RUN export GOPROXY="https://${PLAIN_USER}:${GO_TOKEN}@artifactory-jfrog.apps.ocp4.svc.prod.pl2cloud.de/artifactory/api/go/demo-go-virtual"

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
