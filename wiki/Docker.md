# Docker Deployment

JustApps ships as a single multi-stage Docker image containing both the Next.js frontend and the Go backend.

| Port | Service |
|------|---------|
| `3000` | Frontend (Next.js) |
| `8080` | Backend API |

---

## Build Locally

```bash
docker build -t justapps .
```

## Run

```bash
docker run -d \
  -p 3000:3000 \
  -p 8080:8080 \
  -v /etc/justapps:/etc/justapps \
  -v /app/data:/app/data \
  --name justapps \
  justapps
```

- `/etc/justapps/config.yaml` — backend configuration (required)
- `/app/data` — persistent storage for uploaded app logos

---

## Pre-built Image

```bash
docker pull ghcr.io/JustLABv1/justapps:latest
```

Available tags:

| Tag | Description |
|-----|-------------|
| `latest` | Most recent release |
| `1`, `1.0`, `1.0.0` | Semantic version pins |
| `sha-<commit>` | Specific commit build |

---

## Docker Compose Example

```yaml
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: justapps
      POSTGRES_USER: justapps
      POSTGRES_PASSWORD: changeme
    volumes:
      - postgres_data:/var/lib/postgresql/data

  app:
    image: ghcr.io/JustLABv1/justapps:latest
    ports:
      - "3000:3000"
      - "8080:8080"
    volumes:
      - ./config.yaml:/etc/justapps/config.yaml:ro
      - app_data:/app/data
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8080/api/v1
      AUTH_SECRET: replace-with-secret
      AUTH_URL: http://localhost:3000
      # OIDC (optional)
      AUTH_KEYCLOAK_ID: justapps
      AUTH_KEYCLOAK_SECRET: replace-with-keycloak-secret
      AUTH_KEYCLOAK_ISSUER: https://your-keycloak/realms/your-realm
    depends_on:
      - db

volumes:
  postgres_data:
  app_data:
```

---

## Environment Variables in the Container

Frontend environment variables (prefixed `NEXT_PUBLIC_*` or `AUTH_*`) can be passed directly via `-e` flags or a `--env-file`. Backend config values can be set via `BACKEND_*` environment variables — see [Configuration](Configuration).

---

## Health Check

```bash
curl http://localhost:8080/api/v1/health
# {"status":"ok"}
```
