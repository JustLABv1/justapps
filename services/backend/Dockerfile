FROM artifactory-jfrog.apps.ocp4.svc.prod.pl2cloud.de/dhi-remote/golang:1.24-alpine3.23 as builder
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
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o marktplatz-backend

FROM alpine:3.22 as runner
WORKDIR /app

COPY --from=builder /app/marktplatz-backend /app/

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
