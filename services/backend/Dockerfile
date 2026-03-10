FROM golang:1.24-alpine AS builder
USER 0
# Define cache locations for Go build
ENV GOCACHE=/tmp/go-cache
ENV GOPATH=/go
ENV HOME=/tmp

WORKDIR /app

COPY go.mod go.sum ./

# Run go mod download
RUN go mod download

COPY . .

# Build
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o just-apps-backend

FROM alpine:3.22 AS runner
WORKDIR /app

COPY --from=builder /app/just-apps-backend /app/

RUN addgroup --system --gid 1001 justapps
RUN adduser --system --uid 1001 justapps

RUN mkdir -p /etc/just-apps \
    && chown -R justapps:justapps /etc/just-apps

RUN mkdir -p /app/data \
    && chown -R justapps:justapps /app/data

RUN chown -R justapps:justapps /app

VOLUME [ "/etc/just-apps", "/app/data" ]

EXPOSE 8080

CMD [ "/app/just-apps-backend", "--config", "/etc/just-apps/config.yaml" ]
