# Kubernetes / Helm Deployment

A Helm chart is available in [`charts/justapps/`](https://github.com/JustLABv1/justapps/tree/main/charts/justapps).

---

## Install from the Repository

```bash
helm install justapps ./charts/justapps -f charts/justapps/values.yaml
```

## Install from GitHub Container Registry

Login once with a GitHub token that has `read:packages`:

```bash
export CR_PAT=<github-token>
echo "$CR_PAT" | helm registry login ghcr.io -u <github-username> --password-stdin
```

Install:

```bash
helm install justapps oci://ghcr.io/justlabv1/charts/justapps \
  --version 1.0.0 \
  -f my-values.yaml
```

Upgrade:

```bash
helm upgrade justapps oci://ghcr.io/justlabv1/charts/justapps \
  --version 1.0.0 \
  -f my-values.yaml
```

Inspect the chart before installing:

```bash
helm pull oci://ghcr.io/justlabv1/charts/justapps --version 1.0.0
helm show values oci://ghcr.io/justlabv1/charts/justapps --version 1.0.0
```

---

## Deployment Modes

The chart supports two modes, set via `deploymentMode` in `values.yaml`:

| Mode | Description |
|------|-------------|
| `monolith` | Single Deployment with both frontend + backend in one container |
| `microservices` | Separate Deployments for frontend and backend |

---

## Key `values.yaml` Options

```yaml
deploymentMode: monolith    # or microservices

image:
  repository: ghcr.io/JustLABv1/justapps
  tag: latest
  pullPolicy: IfNotPresent

ingress:
  enabled: true
  className: nginx
  host: justapps.your-domain.com
  tls: true

backend:
  config:
    database:
      server: postgres
      port: 5432
      name: justapps
      user: justapps
      password: changeme
    jwt:
      secret: replace-with-secret
    oidc:
      enabled: true
      issuer: https://your-keycloak/realms/your-realm
      client_id: justapps
      admin_group: admin

frontend:
  env:
    NEXT_PUBLIC_API_URL: https://justapps.your-domain.com/api/v1
    AUTH_SECRET: replace-with-secret
    AUTH_URL: https://justapps.your-domain.com
    AUTH_KEYCLOAK_ID: justapps
    AUTH_KEYCLOAK_SECRET: replace-with-keycloak-secret
    AUTH_KEYCLOAK_ISSUER: https://your-keycloak/realms/your-realm

postgresql:
  enabled: true             # Deploys an in-cluster PostgreSQL instance
  auth:
    database: justapps
    username: justapps
    password: changeme

persistence:
  enabled: true             # PVC for uploaded app logos
  size: 1Gi
```

> **Secret management:** Store `jwt.secret`, database passwords, and Keycloak secrets in Kubernetes Secrets or a Vault-injected secret, not plaintext in `values.yaml`.

---

## Upgrading

```bash
helm upgrade justapps oci://ghcr.io/justlabv1/charts/justapps \
  --version <new-version> \
  -f my-values.yaml
```

Database migrations run automatically on backend startup.

---

## Uninstall

```bash
helm uninstall justapps
```

Note: PVCs are not deleted automatically. Remove them manually if needed.
