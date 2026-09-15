<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="design/logos/justapps-lockup-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="design/logos/justapps-lockup-light.svg">
    <img src="design/logos/justapps-lockup-light.svg" alt="JustApps" width="440">
  </picture>

  <p><strong>The self-hosted application catalog for teams and organizations.</strong></p>
  <p>Discover, document, govern, and share internal software from one place.</p>

  [![PR Check](https://github.com/JustLABv1/justapps/actions/workflows/pr-check.yml/badge.svg)](https://github.com/JustLABv1/justapps/actions/workflows/pr-check.yml)
  [![Release](https://github.com/JustLABv1/justapps/actions/workflows/release.yml/badge.svg)](https://github.com/JustLABv1/justapps/actions/workflows/release.yml)
  [![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-4655F5.svg)](LICENSE)
</div>

## What is JustApps?

JustApps gives teams a searchable home for internal applications, tools, and reusable software. Each catalog entry combines ownership, lifecycle status, technical metadata, documentation, source repositories, deployment instructions, ratings, FAQs, and release information.

It runs on your own infrastructure and supports both a compact Docker Compose setup and Kubernetes deployments with Helm.

## Highlights

- **Searchable app catalog** — organize software with categories, tags, tech stacks, groups, related apps, configurable detail fields, and featured or pinned entries.
- **Ownership and lifecycle** — manage owners and editors, transfer or lock entries, and track apps from draft and proof of concept through established use.
- **Personal discovery** — favorites, recently viewed apps, release updates, changelogs, and configurable update notifications.
- **Community knowledge** — ratings, app-specific FAQs, a platform-wide FAQ, answers, upvotes, and notifications for new questions and responses.
- **Repository integration** — connect GitLab, GitHub, self-hosted GitLab, or GitHub Enterprise; review synchronized metadata and deployment files before approval.
- **AI-assisted catalog** — chat over catalog knowledge, create app entries from descriptions or repositories, draft changelogs, and inspect catalog quality with Health Copilot and Catalog Steward.
- **Catalog health** — monitor live-link reachability, repository synchronization, documentation freshness, and missing ownership.
- **Flexible authentication** — local accounts or configurable OIDC providers, including Keycloak, plus scoped API tokens.
- **Administration and operations** — user and catalog management, custom branding, audit logs, metrics, encrypted backup export/import, and maintenance-aware health checks.
- **Agent access through MCP** — expose authenticated `search_apps` and `get_app` tools to compatible AI clients.
- **Deployment-ready metadata** — store Docker Compose, Helm, source, documentation, demo, and operational guidance alongside each app.

## Quick start with Docker Compose

The checked-in Compose stack starts PostgreSQL, the backend, frontend, and documentation service:

```bash
git clone https://github.com/JustLABv1/justapps.git
cd justapps/deploy/compose
cp .env.example .env
# Replace the placeholder secrets before using this outside a test host.
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000). With OIDC disabled, the first locally registered account becomes an administrator.

For production configuration, persistence, ports, and the optional edge proxy, follow the [Docker Compose guide](https://apps.justlab.app/docs/admin/deployment/docker-compose).

## Local development

Prerequisites: Go 1.27+, Node.js, pnpm, and PostgreSQL.

```bash
git clone https://github.com/JustLABv1/justapps.git
cd justapps

# Backend — review services/backend/config/config.yaml first
cd services/backend
go mod download
go run main.go --config config/config.yaml

# Frontend — in another terminal
cd justapps/services/frontend
pnpm install
pnpm dev

# Documentation — optional, in another terminal
cd justapps/services/docs
pnpm install
pnpm dev
```

The frontend runs at `http://localhost:3000`. See the [getting-started guide](https://apps.justlab.app/docs/admin/getting-started) for database, environment, and first-login setup.

## Deployment options

| Option | Best for | Guide |
| --- | --- | --- |
| Docker Compose | A complete installation on one host | [Docker Compose](https://apps.justlab.app/docs/admin/deployment/docker-compose) |
| Helm | Kubernetes, separate or monolithic services | [Kubernetes and Helm](https://apps.justlab.app/docs/admin/deployment/helm) |
| Container image | Custom deployment pipelines | `ghcr.io/JustLABv1/justapps:latest` |

## Technology

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, HeroUI v3, Tailwind CSS v4 |
| Backend | Go 1.27, Gin, bun ORM |
| Database | PostgreSQL |
| Authentication | NextAuth v5, OIDC, local accounts, JWT |
| Deployment | Docker, Docker Compose, Kubernetes, Helm 3 |
| Documentation | Fumadocs |

## Documentation

The full documentation is available at [apps.justlab.app/docs](https://apps.justlab.app/docs) and is also served at `/docs` by a deployed JustApps instance.

- [Administrator guide](https://apps.justlab.app/docs/admin)
- [Installation and bootstrap](https://apps.justlab.app/docs/admin/getting-started)
- [App creator guide](https://apps.justlab.app/docs/app-creators)
- [Repository and AI workflows](https://apps.justlab.app/docs/app-creators/ai-and-repositories)
- [MCP integration](https://apps.justlab.app/docs/reference/mcp)
- [API reference](https://apps.justlab.app/docs/reference/api)
- [Architecture](https://apps.justlab.app/docs/reference/architecture)
- [Contributing](https://apps.justlab.app/docs/reference/contributing)

Documentation sources live in [`services/docs/`](services/docs/).

## Brand assets

Ready-to-use logo marks, lockups, app icons, and repository avatars are available as SVG and PNG in [`design/logos/`](design/logos/). See the [brand asset guide](design/README.md) for variants, colors, and usage notes.

## License

JustApps is licensed under the [GNU Affero General Public License v3.0](LICENSE).
