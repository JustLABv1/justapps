# JustAppStore

A simple application store with a Go backend and a Next.js frontend, featuring OIDC authentication with Keycloak and an Admin Management interface.

## Project Structure

- `services/backend`: Go-based REST API using Gorilla Mux and Gorm.
- `services/frontend`: Next.js application using HeroUI v3 and Tailwind CSS v4.
- `k8s`: Kubernetes/OpenShift deployment manifests.

## Setup & Configuration

This project uses environment variables for configuration. See `.env.example` in the root for a template.

### 1. Keycloak Setup
To enable OIDC, ensure you have a Keycloak realm and client configured:
- **Client ID**: `app-store`
- **Access Type**: `Confidential` (or Public if properly configured for PKCE)
- **Valid Redirect URIs**: `http://localhost:3000/api/auth/callback/keycloak`
- **Admin Group**: Users in the group `2Fa` (or configured via `AUTH_ADMIN_GROUP`) will receive the `admin` role in the application.

### 2. Backend Configuration (`services/backend/.env`)
```bash
BACKEND_OIDC_ENABLED=true
BACKEND_OIDC_ISSUER=https://<keycloak-url>/realms/<realm>
BACKEND_OIDC_CLIENT_ID=app-store
BACKEND_OIDC_ADMIN_GROUP=2Fa
```

### 3. Frontend Configuration (`services/frontend/.env`)
```bash
AUTH_KEYCLOAK_ID=app-store
AUTH_KEYCLOAK_SECRET=<client-secret>
AUTH_KEYCLOAK_ISSUER=https://<keycloak-url>/realms/<realm>
AUTH_ADMIN_GROUP=2Fa
NEXT_PUBLIC_API_URL=http://localhost:8082/api/v1
```

## Running Locally

### Backend
```bash
cd services/backend
go run main.go
```

### Frontend
```bash
cd services/frontend
pnpm install
pnpm dev
```

## Deployment

The application is designed to run on OpenShift. Check the `k8s/` directory for deployment strategies.
- Ensure `AUTH_SECRET` is set to a secure random string in production.
- Use `trustHost: true` (already configured) for proxy-aware deployments.
