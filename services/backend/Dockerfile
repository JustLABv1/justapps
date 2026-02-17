FROM golang:1.24-alpine as builder

WORKDIR /app/backend

COPY go.mod go.sum ./

RUN go mod download

COPY . .

# Build
RUN go build -o app-store-backend

FROM alpine:3.22 as runner
WORKDIR /app

COPY --from=builder /app/backend/app-store-backend /app/

RUN addgroup --system --gid 1001 app-store
RUN adduser --system --uid 1001 app-store

RUN mkdir -p /etc/app-store \
    && chown -R app-store:app-store /etc/app-store

RUN mkdir -p /app/data \
    && chown -R app-store:app-store /app/data

RUN chown -R app-store:app-store /app

VOLUME [ "/etc/app-store", "/app/data" ]

EXPOSE 8080

CMD [ "/app-store-backend", "--config", "/etc/app-store/config.yaml" ]
