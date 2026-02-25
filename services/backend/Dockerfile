FROM golang:1.24-alpine as builder

WORKDIR /app/backend

COPY go.mod go.sum ./

RUN go mod download

COPY . .

# Build
RUN go build -o marktplatz-backend

FROM alpine:3.22 as runner
WORKDIR /app

COPY --from=builder /app/backend/marktplatz-backend /app/

RUN addgroup --system --gid 1001 marktplatz
RUN adduser --system --uid 1001 marktplatz

RUN mkdir -p /etc/marktplatz \
    && chown -R marktplatz:marktplatz /etc/marktplatz

RUN mkdir -p /app/data \
    && chown -R marktplatz:marktplatz /app/data

RUN chown -R marktplatz:marktplatz /app

VOLUME [ "/etc/marktplatz", "/app/data" ]

EXPOSE 8080

CMD [ "/marktplatz-backend", "--config", "/etc/marktplatz/config.yaml" ]
