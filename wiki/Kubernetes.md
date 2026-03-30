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

> **Secret management:** Store `jwt.secret`, database passwords, Keycloak secrets, and GitLab tokens in Kubernetes Secrets or a Vault-injected secret, not plaintext in `values.yaml`.

---

## GitLab Integration

GitLab providers are configured under `config.gitlab.providers`. Each provider's token is treated as a secret and **never placed in the ConfigMap** — it is always injected as an environment variable.

### Option A — Inline token (chart creates the Secret)

```yaml
secrets:
  create: true

config:
  gitlab:
    providers:
      - key: my-gitlab          # unique identifier, used to derive the env var name
        label: My GitLab
        baseUrl: https://gitlab.example.com
        enabled: true
        namespaceAllowlist:
          - my-group
        timeoutSeconds: 15
        token: "glpat-xxxxxxxxxxxxxxxxxxxx"
```

The chart stores the token in the chart-managed Secret under the key `gitlab-token-<key>` and injects it into the container as `BACKEND_GITLAB_TOKEN_MY_GITLAB`.

### Option B — External Kubernetes Secret

Create the secret independently:

```bash
kubectl create secret generic my-gitlab-token \
  --from-literal=token=glpat-xxxxxxxxxxxxxxxxxxxx
```

Reference it in values:

```yaml
config:
  gitlab:
    providers:
      - key: my-gitlab
        label: My GitLab
        baseUrl: https://gitlab.example.com
        enabled: true
        namespaceAllowlist:
          - my-group
        timeoutSeconds: 15
        tokenSecretRef:
          name: my-gitlab-token   # name of the Kubernetes Secret
          key: token              # key within the Secret
```

The chart will read the token from that secret and inject it as `BACKEND_GITLAB_TOKEN_MY_GITLAB`. No token is stored in `values.yaml` or the ConfigMap.

> **Multiple providers:** Repeat the entry in the `providers` list. Each provider's token env var is derived from its `key` (uppercased, hyphens replaced with underscores): `BACKEND_GITLAB_TOKEN_<KEY>`.

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
