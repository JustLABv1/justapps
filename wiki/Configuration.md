# Configuration

## Backend — `services/backend/config.yaml`

```yaml
log_level: info        # trace | debug | info | warn | error
port: 8082

database:
  server: localhost
  port: 5432
  name: justapps
  user: postgres
  password: your-password

jwt:
  secret: replace-with-secure-random-string   # openssl rand -base64 32

oidc:
  enabled: true
  issuer: https://your-keycloak/realms/your-realm
  client_id: justapps
  admin_group: admin
```

Point to a custom config file path with:

```bash
go run main.go --config /etc/justapps/config.yaml
```

> **Tip:** When running in Docker or Kubernetes, mount your config at `/etc/justapps/config.yaml` and pass `--config /etc/justapps/config.yaml`.

---

## Frontend — `services/frontend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API base URL (e.g. `http://localhost:8082/api/v1`) |
| `AUTH_SECRET` | Yes | NextAuth secret — `openssl rand -base64 32` |
| `AUTH_URL` | Yes | Public URL of the frontend (e.g. `http://localhost:3000`) |
| `AUTH_OIDC_ID` | OIDC only | OIDC client ID |
| `AUTH_OIDC_SECRET` | OIDC only | OIDC client secret |
| `AUTH_OIDC_ISSUER` | OIDC only | OIDC issuer URL |
| `AUTH_ADMIN_GROUP` | OIDC only | OIDC group that grants admin rights (e.g. `admin`) |

See [`.env.example`](https://github.com/JustLABv1/justapps/blob/main/.env.example) for a full reference template.

---

## Environment Variables in Docker / Kubernetes

All `config.yaml` values can be overridden with environment variables using the pattern `BACKEND_<SECTION>_<KEY>` (uppercase, underscores):

| Config key | Env var |
|-----------|---------|
| `database.server` | `BACKEND_DATABASE_SERVER` |
| `database.password` | `BACKEND_DATABASE_PASSWORD` |
| `jwt.secret` | `BACKEND_JWT_SECRET` |
| `oidc.enabled` | `BACKEND_OIDC_ENABLED` |
| `oidc.issuer` | `BACKEND_OIDC_ISSUER` |
| `oidc.client_id` | `BACKEND_OIDC_CLIENT_ID` |
| `oidc.admin_group` | `BACKEND_OIDC_ADMIN_GROUP` |

---

## Repository Providers (`config.yaml`)

```yaml
repository_providers:
  - key: my-gitlab               # Unique identifier (used internally)
    type: gitlab                 # Supported: gitlab (default), github
    label: My GitLab             # Display name (defaults to key if omitted)
    base_url: https://gitlab.example.com   # Defaults to https://gitlab.com
    token: glpat-xxxx            # Personal / group / project access token (read_api scope)
    enabled: true
    namespace_allowlist:         # Optional — restrict sync to these namespaces/groups
      - my-org
      - another-group
    timeout_seconds: 15          # HTTP timeout for provider API calls (default: 15)
```

Multiple providers are supported:

```yaml
repository_providers:
  - key: internal
    type: gitlab
    label: Internal GitLab
    base_url: https://gitlab.internal.example.com
    token: glpat-internal-token
    enabled: true
  - key: public
    type: github
    label: GitHub.com
    base_url: https://github.com
    token: ghp-public-token
    enabled: false
```

> **Secret handling:** Avoid committing tokens to source control. Use `BACKEND_REPOSITORY_TOKEN_<KEY>` or inject tokens via Kubernetes Secrets / Vault.

---

## Generating Secrets

```bash
# JWT secret and NextAuth secret
openssl rand -base64 32
```

Store secrets in Kubernetes Secrets or a Vault-compatible secret store — never commit them to source control.
