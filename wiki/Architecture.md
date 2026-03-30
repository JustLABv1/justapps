# Architecture

## Overview

JustApps is a full-stack web application with a clear separation between a React frontend and a Go backend API.

```
┌─────────────────────────────────────┐
│            Browser / Client          │
└──────────────┬──────────────────────┘
               │ HTTP
┌──────────────▼──────────────────────┐
│         Next.js Frontend             │
│  (React 19 · HeroUI · NextAuth v5)  │
│                                      │
│  Pages: /, /apps/:id, /verwaltung,  │
│          /login, /register           │
└──────────────┬──────────────────────┘
               │ REST /api/v1
┌──────────────▼──────────────────────┐
│           Go Backend (Gin)           │
│                                      │
│  Router → Handlers → Functions       │
│  Middleware: JWT auth, admin check   │
└──────┬──────────────────────────────┘
       │ SQL (bun ORM)
┌──────▼──────────────┐
│    PostgreSQL 15+    │
└─────────────────────┘
```

---

## Services

### Frontend (`services/frontend/`)

| Component | Purpose |
|-----------|---------|
| `app/` | Next.js App Router pages and API routes |
| `components/` | Shared UI components (AppCard, AppModal, etc.) |
| `context/` | React context providers (Auth, Favorites, Settings) |
| `lib/` | API client, utility helpers |
| `auth.ts` | NextAuth configuration (Keycloak OIDC provider) |

**Key dependencies:** Next.js 16, React 19, HeroUI v3, Tailwind CSS v4, NextAuth v5

### Backend (`services/backend/`)

| Component | Purpose |
|-----------|---------|
| `main.go` | Entry point, server init, graceful shutdown |
| `router/` | Route registration |
| `handlers/` | HTTP handlers grouped by domain |
| `middlewares/` | JWT auth, admin enforcement, optional auth |
| `functions/` | Business logic — JWT signing, OIDC session, access control |
| `pkg/models/` | Database models (bun ORM structs) |
| `database/` | PostgreSQL connection, migrations, seed data |
| `config/` | YAML config loading (viper) |

**Key dependencies:** Gin, bun ORM, go-oidc v3, golang-jwt/jwt v5, logrus, viper

---

## Database Schema

The schema is managed via versioned migrations in `services/backend/database/migrations/`. There are 33+ migrations covering:

| Range | Additions |
|-------|-----------|
| 0–9 | Core tables: apps, users, ratings, deployments, tags |
| 10–17 | Permissions, platform settings, custom links, repositories |
| 18–25 | Branding, detail fields, deployment variants, related apps |
| 26–33 | Versioning, last login, favorites, GitLab integration |

### Core Tables

| Table | Description |
|-------|-------------|
| `apps` | Application catalog entries |
| `users` | User accounts (local + OIDC) |
| `ratings` | Per-user, per-app ratings |
| `platform_settings` | Branding, banner, footer links |
| `user_app_permissions` | Fine-grained app access control |
| `user_favorites` | Bookmarked apps per user |
| `gitlab_providers` | GitLab instance configurations |
| `gitlab_app_links` | App-to-GitLab-project mappings |

---

## Authentication Flow

### Local Auth

```
Browser → POST /auth/login → Backend validates credentials → Issues JWT
Frontend stores JWT → Sends as Bearer token on API requests
```

### OIDC (Keycloak)

```
Browser → NextAuth sign-in → Redirect to Keycloak
Keycloak authenticates → Returns ID + access tokens to NextAuth
NextAuth stores session → Frontend calls POST /auth/oidc/exchange
Backend validates OIDC token → Issues its own JWT for API calls
```

---

## Request Auth Middleware

Every protected route passes through the auth middleware (`middlewares/auth.go`):

1. Extract `Authorization: Bearer <token>` header
2. Attempt JWT validation (local token)
3. If the token has an OIDC issuer claim, validate against the OIDC provider
4. Attach user identity to the request context
5. Admin-only routes additionally check the `is_admin` flag via `middlewares/admin.go`

---

## Deployment Topology

### Monolith (Docker / single Kubernetes Deployment)

```
┌─────────────────────┐
│  Docker Container   │
│  ├── Next.js :3000  │
│  └── Go API :8080   │
└──────────┬──────────┘
           │
      PostgreSQL
```

### Microservices (Kubernetes separate Deployments)

```
Ingress ─┬─ /          → Frontend Deployment (:3000)
         └─ /api/v1/*  → Backend Deployment  (:8080)
                                  │
                             PostgreSQL
```

---

## CI/CD

| Workflow | Trigger | Output |
|----------|---------|--------|
| `pr-check.yml` | PR to `main` | TypeScript, ESLint, `next build`, `go vet`, `go build` |
| `release.yml` | Tag `v*.*.*` | Docker image to GHCR, Helm chart to GHCR OCI, GitHub Release |
| `wiki-sync.yml` | Push to `main` (wiki/** changes) | Syncs `wiki/` folder to GitHub Wiki |
