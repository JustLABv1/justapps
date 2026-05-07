# Authentication

JustApps supports two authentication modes:

| Mode | Description |
|------|-------------|
| **Local** | Username/password stored in PostgreSQL, JWT-issued tokens |
| **OIDC** | OAuth2 / OpenID Connect via one or more provider configurations managed in JustApps Admin settings (backend-managed auth code flow) |

Both modes can coexist. OIDC users are managed in your identity provider; local users are managed in the JustApps admin UI.

OIDC providers are configured in the UI under `Verwaltung -> Integrationen -> Authentifizierung`.

---

## OIDC Provider Setup (Keycloak Example)

### 1. Create a Realm

Create a new realm (e.g. `justapps`) or reuse an existing one.

### 2. Create a Client

1. Go to **Clients** → **Create client**
2. **Client ID**: choose a unique ID (for example `justapps-main`)
3. **Client Protocol**: `openid-connect`
4. **Access Type**: `confidential`
5. **Valid Redirect URIs**:
   - Development: `http://localhost:8080/api/v1/auth/oidc/<provider-key>/callback`
   - Production: `https://<backend-domain>/api/v1/auth/oidc/<provider-key>/callback`
6. **Web Origins**: `*` or your frontend URL

### 3. Client Secret

Copy the **Client Secret** from the **Credentials** tab into the provider entry in JustApps admin settings.

### 4. Admin Group

The backend checks group membership to grant the `admin` role.

1. Go to **Groups** → create a group named `admin` (or your custom name)
2. Assign admin users to this group
3. Add a **Group Membership** mapper so groups appear in the ID token:
   - **Client Scopes** → `{client-id}-dedicated` → **Mappers** → Add mapper
   - Type: **Group Membership**, Token Claim Name: `groups`

### 5. Offline Access (Session Persistence)

To prevent `Offline user session not found` errors and enable persistent sessions:

1. **Client Scopes** → your client → ensure `offline_access` is in **Default** or **Optional**
2. **Realm Roles** → `offline_access` → assign to the `admin` group (or all users)
3. **Client** → **Advanced** → set **PKCE** to `S256`
4. Ensure `Exclude Session State From Authentication Response` is **OFF**

> **Verify:** After login, check **Users** → user → **Sessions** tab. An "Offline" session entry confirms the scope was granted.

---

## Runtime Behavior

OIDC login flow:

1. Frontend loads available providers from `GET /api/v1/auth/oidc/providers`.
2. User clicks a provider button on `/login`.
3. Frontend redirects to `GET /api/v1/auth/oidc/:key/start`.
4. Backend handles provider redirect and callback.
5. Backend issues a JustApps JWT and redirects back to frontend `/login` with `oidc_token`.
6. Frontend validates the token with `GET /api/v1/user/` and stores session.

PKCE is enabled in the backend-managed flow.

## Environment Variables

### Backend (`config.yaml` or env overrides)

The legacy single-provider backend config still exists as fallback, but the recommended setup is provider configuration in Admin UI.

```yaml
oidc:
  enabled: true
  issuer: https://your-keycloak/realms/your-realm
  client_id: justapps
  admin_group: admin
```

| Env var | Description |
|---------|-------------|
| `BACKEND_OIDC_ENABLED` | Legacy toggle/fallback for single-provider config |
| `BACKEND_OIDC_ISSUER` | Legacy single-provider issuer |
| `BACKEND_OIDC_CLIENT_ID` | Legacy single-provider client ID |
| `BACKEND_OIDC_ADMIN_GROUP` | Legacy single-provider admin group |

### Frontend (`.env`)

```env
AUTH_SECRET=random-secret-string
AUTH_URL=https://your-domain.com
```

`AUTH_OIDC_*` variables are not required for the backend-managed provider-key flow.

---

## Local Authentication

When OIDC is disabled (or alongside OIDC), users can register and log in with a username and password:

- `POST /api/v1/auth/register` — create a new local account
- `POST /api/v1/auth/login` — returns a JWT

The first local user created through registration is automatically assigned the `admin` role.

Admins can create and manage local users through the **Admin UI** at `/verwaltung`.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Callback redirects to backend `/login` and returns 404 | Ensure backend callback redirects are configured to frontend origin and your frontend is reachable at that origin |
| `Token Validation Failed` | Ensure provider issuer matches the `iss` claim exactly (no trailing slash mismatch) |
| `Admin Access Denied` | Inspect the token at [jwt.io](https://jwt.io) — confirm `groups` or `roles` claim contains your admin group name |
| `CORS Issues` | Add your frontend URL to Keycloak **Web Origins** |
| `OIDC-Codeaustausch fehlgeschlagen` | Confirm client secret, callback URL, and PKCE settings in the IdP client |
| Sessions expire too quickly | Increase **Realm Settings** → **Sessions** → **SSO Session Idle** (30m+) |
