# JustApps

A self-hosted application store for teams and organizations. Centrally manage, discover, and share internal software solutions with rich metadata, ratings, and deployment instructions.

[![PR Check](https://github.com/JustLABv1/justapps/actions/workflows/pr-check.yml/badge.svg)](https://github.com/JustLABv1/justapps/actions/workflows/pr-check.yml)
[![Release](https://github.com/JustLABv1/justapps/actions/workflows/release.yml/badge.svg)](https://github.com/JustLABv1/justapps/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Docker](#docker)
- [Kubernetes / Helm](#kubernetes--helm)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [CI/CD](#cicd)
- [Contributing](#contributing)
- [License](#license)

## Features

- **App catalog** — browse and discover applications with categories, tech stacks, and links
- **Ratings & reviews** — community-driven per-app ratings
- **Deployment-ready** — built-in Docker, Docker Compose, and Helm chart deployment instructions per app
- **Admin interface** — manage users, apps, platform branding, and settings
- **OIDC authentication** — Keycloak integration with local username/password fallback
- **App ownership** — users manage their own listings
- **File uploads** — app logo storage
- **Import/Export** — admin-level JSON bulk import/export

## Tech Stack

| Layer     | Technology                                          |
|-----------|-----------------------------------------------------|
| Frontend  | Next.js 16, React 19, HeroUI v3, Tailwind CSS v4   |
| Backend   | Go 1.24, Gin, bun ORM                              |
| Database  | PostgreSQL 15+                                      |
| Auth      | NextAuth v5, Keycloak (OIDC), JWT                  |
| Container | Docker (multi-stage build), Kubernetes, Helm 3      |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 24+ and [pnpm](https://pnpm.io)
- [Go](https://go.dev/) 1.24+
- [PostgreSQL](https://www.postgresql.org/) 15+
- (Optional) A [Keycloak](https://www.keycloak.org/) instance for OIDC

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/JustLABv1/justapps.git
cd just-app-store
```

**2. Configure environment**

```bash
cp .env.example .env
# Edit .env — see Configuration section below
```

**3. Start the backend**

```bash
cd services/backend
go mod download
go run main.go --config config.yaml
```

The API is available at `http://localhost:8082`.

**4. Start the frontend**

```bash
cd services/frontend
pnpm install
pnpm dev
```

The app is available at `http://localhost:3000`.

## Configuration

### Backend (`services/backend/config.yaml`)

```yaml
log_level: info
port: 8082

database:
  server: localhost
  port: 5432
  name: just_apps
  user: postgres
  password: your-password

jwt:
  secret: replace-with-secure-random-string  # openssl rand -base64 32

oidc:
  enabled: true
  issuer: https://your-keycloak/realms/your-realm
  client_id: just-apps
  admin_group: admin
```

Use `--config` to point to a custom config file path.

### Frontend (`services/frontend/.env`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API URL (e.g. `http://localhost:8082/api/v1`) |
| `AUTH_SECRET` | NextAuth secret — generate with `openssl rand -base64 32` |
| `AUTH_URL` | Public URL of the frontend (e.g. `http://localhost:3000`) |
| `AUTH_KEYCLOAK_ID` | Keycloak client ID |
| `AUTH_KEYCLOAK_SECRET` | Keycloak client secret |
| `AUTH_KEYCLOAK_ISSUER` | Keycloak realm URL |
| `AUTH_ADMIN_GROUP` | Keycloak group that receives the `admin` role |

See [.env.example](.env.example) for a full reference.

### Keycloak Setup

Configure your Keycloak realm and client:

- **Client ID**: `just-apps`
- **Access Type**: `Confidential`
- **Valid Redirect URIs**: `http://localhost:3000/api/auth/callback/keycloak`
- **Admin group**: members of the configured `AUTH_ADMIN_GROUP` receive admin rights

## Docker

Build and run the combined image (frontend + backend in a single container):

```bash
docker build -t just-apps .

docker run -p 3000:3000 -p 8080:8080 \
  -v /etc/just-apps:/etc/just-apps \
  -v /app/data:/app/data \
  just-apps
```

The container expects a config file at `/etc/just-apps/config.yaml`.

### Pre-built image

```bash
docker pull ghcr.io/JustLABv1/justapps:latest
```

Available tags: `latest`, `1`, `1.0`, `1.0.0`, `sha-<commit>`

## Kubernetes / Helm

A Helm chart is available in [`charts/just-apps/`](charts/just-apps/):

```bash
helm install just-apps ./charts/just-apps \
  -f charts/just-apps/values.yaml
```

Review and adjust `values.yaml` for your cluster (image, ingress, PostgreSQL credentials, OIDC settings).

## API Reference

The backend REST API is available under `/api/v1`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | — | Health check |
| `GET` | `/apps` | — | List all apps |
| `GET` | `/apps/:id` | — | Get app details |
| `POST` | `/apps` | User | Create app |
| `PUT` | `/apps/:id` | Owner | Update app |
| `DELETE` | `/apps/:id` | Owner | Delete app |
| `GET` | `/apps/:id/ratings` | — | List ratings |
| `POST` | `/apps/:id/ratings` | User | Submit rating |
| `DELETE` | `/apps/:id/ratings` | User | Delete own rating |
| `POST` | `/auth/login` | — | Local login |
| `POST` | `/auth/register` | — | Register account |
| `POST` | `/auth/oidc/exchange` | — | Exchange Keycloak token |
| `GET` | `/settings` | — | Platform settings |
| `PUT` | `/settings` | Admin | Update settings |
| `GET` | `/admin/users` | Admin | List all users |
| `PUT` | `/admin/users/:id/state` | Admin | Enable/disable user |

## Project Structure

```
just-app-store/
├── services/
│   ├── frontend/          # Next.js application
│   │   ├── app/           # Pages and routes
│   │   └── components/    # Shared UI components
│   └── backend/           # Go REST API
│       ├── handlers/      # HTTP handlers
│       ├── pkg/models/    # Database models
│       ├── database/      # Migrations
│       └── router/        # Route definitions
├── charts/just-apps/     # Helm chart
├── .github/workflows/     # CI/CD pipelines
├── Dockerfile             # Multi-stage build (frontend + backend)
└── .env.example           # Environment variable reference
```

## CI/CD

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| [PR Check](.github/workflows/pr-check.yml) | Pull request → `main` | TypeScript check, lint, `next build`, `go vet`, `go build` |
| [Release](.github/workflows/release.yml) | Push tag `v*.*.*` | Builds Docker image, pushes to GHCR, creates GitHub Release with changelog |

### Creating a release

```bash
git tag v1.0.0
git push origin v1.0.0
```

The image will be published to `ghcr.io/JustLABv1/justapps:1.0.0`.

## Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` new features
   - `fix:` bug fixes
   - `chore:` maintenance, dependencies
   - `docs:` documentation changes
4. Open a pull request against `main`

The PR Check workflow runs automatically and must pass before merging.

Please open an issue for bugs or feature requests before submitting large changes.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
