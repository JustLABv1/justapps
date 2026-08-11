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

The Fumadocs site is served at `/docs` alongside JustApps. After deployment, open
`https://<your-justapps-host>/docs`; the hosted public instance is available at
[apps.justlab.app/docs](https://apps.justlab.app/docs).

Documentation source lives in [`services/docs/`](services/docs/), and the main guides are:

- [Admin documentation](https://apps.justlab.app/docs/admin)
- [First installation and bootstrap](https://apps.justlab.app/docs/admin/getting-started)
- [Docker and Docker Compose](https://apps.justlab.app/docs/admin/deployment/docker-compose)
- [Kubernetes and Helm](https://apps.justlab.app/docs/admin/deployment/helm)
- [App-creator documentation](https://apps.justlab.app/docs/app-creators)
- [API reference](https://apps.justlab.app/docs/reference/api)

## License

MIT — see [LICENSE](LICENSE).
