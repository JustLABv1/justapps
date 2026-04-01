# Docker / Docker Compose

JustApps supports two container-based deployment paths:

| Method | When to use it |
|------|---------|
| Docker Compose | Recommended for a single host or VM with PostgreSQL, frontend, and backend as separate services |
| Single Docker image | Useful if you specifically want the monolith image and manage PostgreSQL yourself |

---

## Recommended: Docker Compose

The repository now ships a complete Compose stack in `deploy/compose/`.

### Files

- `deploy/compose/compose.yaml` — frontend, backend, and PostgreSQL services
- `deploy/compose/.env.example` — runtime variables and secrets template
- `deploy/compose/backend.config.yaml` — backend base config mounted into the container

### Start the stack

```bash
cd deploy/compose
cp .env.example .env
docker compose up -d
```

The default stack exposes:

| Service | URL / Port |
|------|---------|
| Frontend | `http://localhost:3000` |
| Backend API | `http://localhost:8080/api/v1` |
| PostgreSQL | internal only (`postgres:5432`) |

### First login

The checked-in Compose setup defaults to local authentication with OIDC disabled. After the containers are up, open `http://localhost:3000` and register a user through the UI. The first locally registered user is created with the `admin` role.

If you want OIDC / Keycloak instead, update `deploy/compose/.env` with the `BACKEND_OIDC_*` and `AUTH_KEYCLOAK_*` values from the [Authentication](Authentication) page, then restart the stack.

### Operations

```bash
cd deploy/compose
docker compose logs -f
docker compose pull
docker compose up -d
docker compose down
```

Persistent data is stored in named Docker volumes:

- `postgres-data` — PostgreSQL data directory
- `uploads-data` — uploaded assets such as logos

### Health check

```bash
curl http://localhost:8080/api/v1/health
```

---

## Alternative: Single Docker Image

JustApps also ships as a single multi-stage Docker image containing both the Next.js frontend and the Go backend.

### Build locally

```bash
docker build -t justapps .
```

### Run

```bash
docker run -d \
  -p 3000:3000 \
  -p 8080:8080 \
  -v /etc/justapps:/etc/justapps \
  -v /app/data:/app/data \
  --name justapps \
  ghcr.io/justlabv1/justapps:latest
```

Required mounts:

- `/etc/justapps/config.yaml` — backend configuration file
- `/app/data` — persistent storage for uploaded app logos

### Pre-built image

```bash
docker pull ghcr.io/justlabv1/justapps:latest
```

Available tags:

| Tag | Description |
|-----|-------------|
| `latest` | Most recent release |
| `1`, `1.0`, `1.0.0` | Semantic version pins |
| `sha-<commit>` | Specific commit build |

---

## Configuration

Frontend variables (`NEXT_PUBLIC_*`, `AUTH_*`) can be set in the Compose env file or passed directly to `docker run`. Backend configuration is read from `/etc/justapps/config.yaml` and can be overridden with `BACKEND_*` environment variables. See [Configuration](Configuration) for the full reference.
