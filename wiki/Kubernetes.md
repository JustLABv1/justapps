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
    AUTH_OIDC_ID: justapps
    AUTH_OIDC_SECRET: replace-with-client-secret
    AUTH_OIDC_ISSUER: https://your-keycloak/realms/your-realm

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

> **Secret management:** Store `jwt.secret`, database passwords, Keycloak secrets, and the repository provider encryption secret in Kubernetes Secrets or a Vault-injected secret, not plaintext in `values.yaml`.

---

## Repository Provider Encryption

Repository providers are created in the admin UI and stored in the database. Helm only needs to provide the encryption secret used to protect provider tokens at rest.

### Option A — Chart-managed Secret

```yaml
secrets:
  create: true

config:
  repositoryProviderEncryption:
    secret: "replace-with-secure-random-string"
```

The chart stores the secret in the chart-managed Secret under `repository-provider-encryption-secret` and injects it into the backend as `BACKEND_REPOSITORY_PROVIDER_ENCRYPTION_SECRET`.

### Option B — External Kubernetes Secret

Create the secret independently:

```bash
kubectl create secret generic justapps-secrets \
  --from-literal=repository-provider-encryption-secret=replace-with-secure-random-string
```

Reference it in values:

```yaml
secrets:
  existingSecret: justapps-secrets
```

The referenced Secret must include the key `repository-provider-encryption-secret`. No provider definitions or tokens are stored in `values.yaml` or the ConfigMap.

> **Runtime behavior:** Once the encryption secret is available, admins can add, rotate, or delete repository providers directly in the UI without redeploying the chart.

---

## Custom CA Certificates (Self-Signed/Private CAs)

If you need to trust a self-signed or private CA (for example, for GitLab or other internal services), you can mount a custom CA certificate into the backend and frontend containers using the Helm chart.

### 1. Create a Kubernetes Secret or ConfigMap with your CA

**As a Secret:**
```bash
kubectl create secret generic my-custom-ca --from-file=ca.crt=./my-root-ca.crt
```

**As a ConfigMap:**
```bash
kubectl create configmap my-custom-ca --from-file=ca.crt=./my-root-ca.crt
```

### 2. Reference the CA in your `values.yaml`

```yaml
customCA:
  enabled: true
  name: my-custom-ca         # Name of the Secret or ConfigMap
  secret: true               # true if Secret, false if ConfigMap
  mountPath: /etc/ssl/certs/extra-ca.crt
```

The CA will be mounted into the container at the specified path. You may need to configure your application or set environment variables (e.g. `SSL_CERT_FILE=/etc/ssl/certs/extra-ca.crt`) so that your backend/frontend trusts this CA.

> **Note:** The file inside the Secret/ConfigMap must be named `ca.crt`.

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
