FROM golang:1.24-alpine as builder
LABEL org.opencontainers.image.source = "https://github.com/JustLabV1/JustWMS"

WORKDIR /app/backend

COPY go.mod go.sum ./

RUN go mod download

COPY . .

# Build
RUN go build -o justwms-backend

FROM alpine:3.22 as runner
LABEL org.opencontainers.image.source = "https://github.com/JustLabV1/JustWMS"
WORKDIR /app

COPY --from=builder /app/backend/justwms-backend /app/

RUN addgroup --system --gid 1001 justwms
RUN adduser --system --uid 1001 justwms

RUN mkdir -p /etc/justwms \
    && chown -R justwms:justwms /etc/justwms

RUN mkdir -p /app/data \
    && chown -R justwms:justwms /app/data

RUN chown -R justwms:justwms /app

VOLUME [ "/etc/justwms", "/app/data" ]

EXPOSE 8080

CMD [ "/justwms-backend", "--config", "/etc/justwms/config.yaml" ]
