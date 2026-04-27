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
- **GitLab integration** — sync app metadata from GitLab projects automatically

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
| [GitLab Integration](https://github.com/JustLABv1/justapps/wiki/GitLab-Integration) | Sync apps from GitLab |
| [Admin Guide](https://github.com/JustLABv1/justapps/wiki/Admin-Guide) | Manage users and platform settings |
| [Contributing](https://github.com/JustLABv1/justapps/wiki/Contributing) | Branching, commit style, PR workflow |

## openCode Mirror And Releases

The repository can be mirrored automatically to openCode GitLab and publish release artifacts there from the existing GitHub Actions workflows.

- `.github/workflows/opencode-sync.yml` pushes `main` and all release tags to the openCode project on each push, on manual dispatch, and nightly.
- `.github/workflows/release.yml` continues to publish to GHCR and also publishes container images and release assets to openCode when the required secrets and variables are configured.
- `.github/workflows/helm-chart-release.yml` uploads manual chart releases to openCode as additional downloadable assets.

Required GitHub Actions repository variables:

- `OPENCODE_GITLAB_PROJECT_PATH` — openCode project path, for example `organisation/justapps`
- `OPENCODE_GITLAB_PROJECT_ID` — numeric GitLab project ID used for the API
- `OPENCODE_GITLAB_REGISTRY` — openCode container registry hostname
- `OPENCODE_GITLAB_REGISTRY_IMAGE` — fully qualified openCode image path, for example `registry.example.tld/organisation/justapps`

Required GitHub Actions repository secrets:

- `OPENCODE_SSH_PRIVATE_KEY` — SSH private key with write access to the openCode project for branch and tag mirroring
- `OPENCODE_GITLAB_TOKEN` — GitLab project or personal access token with `api` scope for uploads and release creation
- `OPENCODE_REGISTRY_USERNAME` — registry user or deploy token name for the openCode container registry
- `OPENCODE_REGISTRY_PASSWORD` — registry password or deploy token secret for the openCode container registry

Keep the openCode project protected from direct commits on `main`, otherwise the mirror workflow will fail on drift instead of silently overwriting local changes.

## License

MIT — see [LICENSE](LICENSE).
