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

repository_provider_encryption:
  secret: replace-with-secure-random-string   # openssl rand -base64 32
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
| `repository_provider_encryption.secret` | `BACKEND_REPOSITORY_PROVIDER_ENCRYPTION_SECRET` |
| `oidc.enabled` | `BACKEND_OIDC_ENABLED` |
| `oidc.issuer` | `BACKEND_OIDC_ISSUER` |
| `oidc.client_id` | `BACKEND_OIDC_CLIENT_ID` |
| `oidc.admin_group` | `BACKEND_OIDC_ADMIN_GROUP` |

---

## Repository Provider Encryption (`config.yaml`)

```yaml
repository_provider_encryption:
  secret: replace-with-secure-random-string
```

This secret is required at startup and is used to encrypt repository provider tokens and AI provider tokens stored in the database.

Repository providers themselves are created and maintained in the admin UI under **Verwaltung → Einstellungen → Repository-Provider**.

AI providers are created and maintained in the admin UI under **Verwaltung → Einstellungen → AI**. Local providers such as vLLM, Ollama and LM Studio need to be reachable from the backend process or container.

> **Secret handling:** Avoid committing the encryption secret or provider tokens to source control. Keep the secret in your runtime environment or a secret manager.

---

## Generating Secrets

```bash
# JWT secret and NextAuth secret
openssl rand -base64 32
```

Store secrets in Kubernetes Secrets or a Vault-compatible secret store — never commit them to source control.
