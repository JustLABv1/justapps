FROM golang:1.26-alpine AS builder
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
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o justapps-backend

FROM alpine:3.23 AS runner
WORKDIR /app

COPY --from=builder /app/justapps-backend /app/

RUN addgroup --system --gid 1001 justapps
RUN adduser --system --uid 1001 justapps

RUN mkdir -p /etc/justapps \
    && chown -R justapps:justapps /etc/justapps

RUN mkdir -p /app/data \
    && chown -R justapps:justapps /app/data

RUN chown -R justapps:justapps /app

VOLUME [ "/etc/justapps", "/app/data" ]

EXPOSE 8080

CMD [ "/app/justapps-backend", "--config", "/etc/justapps/config.yaml" ]
