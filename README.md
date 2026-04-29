# JustApps

A self-hosted application store for teams and organizations. Centrally manage, discover, and share internal software solutions with rich metadata, ratings, and deployment instructions.

[![PR Check](https://github.com/JustLABv1/justapps/actions/workflows/pr-check.yml/badge.svg)](https://github.com/JustLABv1/justapps/actions/workflows/pr-check.yml)
[![Release](https://github.com/JustLABv1/justapps/actions/workflows/release.yml/badge.svg)](https://github.com/JustLABv1/justapps/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Features

- **App catalog** — browse and discover applications with categories, tech stacks, and links
- **Ratings & reviews** — community-driven per-app ratings
- **Deployment-ready** — built-in Docker, Docker Compose, and Helm chart deployment instructions per app
- **Admin interface** — manage users, apps, platform branding, and settings
- **OIDC authentication** — Keycloak integration with local username/password fallback
- **Repository sync** — sync app metadata from GitLab and GitHub (including self-hosted/GitHub Enterprise) projects automatically
- **AI Chat** — answer catalog and deployment questions using app metadata plus repository-synced README, Helm and Compose sources with cloud or local providers

## Tech Stack

| Layer     | Technology                                        |
|-----------|---------------------------------------------------|
| Frontend  | Next.js 16, React 19, HeroUI v3, Tailwind CSS v4 |
| Backend   | Go 1.24, Gin, bun ORM                            |
| Database  | PostgreSQL 15+                                    |
| Auth      | NextAuth v5, Keycloak (OIDC), JWT                |
| Container | Docker (multi-stage), Kubernetes, Helm 3          |

## Quick Start

```bash
# Clone
git clone https://github.com/JustLABv1/justapps.git && cd justapps

# Backend
cd services/backend && go mod download && go run main.go --config config.yaml

# Frontend (new terminal)
cd services/frontend && pnpm install && pnpm dev
```

Or pull the pre-built image:

```bash
docker pull ghcr.io/JustLABv1/justapps:latest
```

## Documentation

Full documentation is in the [project wiki](https://github.com/JustLABv1/justapps/wiki):

| Page | Description |
|------|-------------|
| [Getting Started](https://github.com/JustLABv1/justapps/wiki/Getting-Started) | Install and run locally or via Docker |
| [Configuration](https://github.com/JustLABv1/justapps/wiki/Configuration) | Backend and frontend config reference |
| [Authentication](https://github.com/JustLABv1/justapps/wiki/Authentication) | Keycloak / OIDC setup |
| [Docker](https://github.com/JustLABv1/justapps/wiki/Docker) | Docker and Docker Compose deployment |
| [Kubernetes / Helm](https://github.com/JustLABv1/justapps/wiki/Kubernetes) | Helm chart deployment |
| [API Reference](https://github.com/JustLABv1/justapps/wiki/API-Reference) | REST API endpoints |
| [Architecture](https://github.com/JustLABv1/justapps/wiki/Architecture) | System overview and data flow |
| [Repository Sync](https://github.com/JustLABv1/justapps/wiki/Repository-Sync) | Sync apps from GitLab and GitHub |
| [AI Chat](https://github.com/JustLABv1/justapps/wiki/AI-Chat) | Configure AI providers and app knowledge retrieval |
| [Admin Guide](https://github.com/JustLABv1/justapps/wiki/Admin-Guide) | Manage users and platform settings |
| [Contributing](https://github.com/JustLABv1/justapps/wiki/Contributing) | Branching, commit style, PR workflow |

## License

MIT — see [LICENSE](LICENSE).
