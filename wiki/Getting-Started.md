# Getting Started

## Prerequisites

| Requirement | Version |
|------------|---------|
| [Node.js](https://nodejs.org/) + [pnpm](https://pnpm.io) | Node 24+ |
| [Go](https://go.dev/) | 1.24+ |
| [PostgreSQL](https://www.postgresql.org/) | 15+ |
| [Keycloak](https://www.keycloak.org/) *(optional)* | Any recent version |

---

## Quick Install With Docker Compose

If you want a full installation on a single machine without Kubernetes, use the checked-in Compose stack:

```bash
git clone https://github.com/JustLABv1/justapps.git
cd justapps/deploy/compose
cp .env.example .env
docker compose up -d
```

This starts PostgreSQL, the backend, and the frontend. By default, OIDC is disabled so you can create the first local user at `http://localhost:3000` without Keycloak. The first locally registered user becomes an admin.

For production-style settings, edit `deploy/compose/.env` before starting. For Keycloak setup, see [Authentication](Authentication). For container details, see [Docker](Docker).

---

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/JustLABv1/justapps.git
cd justapps
```

### 2. Configure the backend

```bash
cd services/backend
cp config.example.yaml config.yaml
# Edit config.yaml — see Configuration wiki page
```

### 3. Start the backend

```bash
go mod download
go run main.go --config config.yaml
```

The API is available at `http://localhost:8082`.
The backend auto-runs all pending database migrations on startup.

### 4. Configure the frontend

```bash
cd services/frontend
cp .env.example .env
# Edit .env — see Configuration wiki page
```

### 5. Start the frontend

```bash
pnpm install
pnpm dev
```

The app is available at `http://localhost:3000`.

---

## First Login

If OIDC is **disabled**, register the first local user through the frontend at `http://localhost:3000/register`. The backend assigns the first registered local user the `admin` role automatically.

If OIDC is **enabled**, log in via Keycloak. See the [Authentication](Authentication) page for setup instructions.

---

## What's Running

| Service | Port | Purpose |
|---------|------|---------|
| Backend API | `8082` | REST API (`/api/v1/*`) |
| Frontend | `3000` | Next.js web application |
| PostgreSQL | `5432` | Database |

---

## Next Steps

- [Configure](Configuration) the backend and frontend
- [Set up Keycloak](Authentication) for OIDC login
- [Deploy with Docker Compose](Docker) for a single-host setup
- [Deploy to Kubernetes](Kubernetes) for production
