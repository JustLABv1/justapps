# Authentication

JustApps supports two authentication modes:

| Mode | Description |
|------|-------------|
| **Local** | Username/password stored in PostgreSQL, JWT-issued tokens |
| **OIDC (Keycloak)** | OAuth2 / OpenID Connect via Keycloak, handled by NextAuth v5 |

Both modes can coexist. OIDC users are managed in Keycloak; local users are managed in the JustApps admin UI.

---

## Keycloak Setup

### 1. Create a Realm

Create a new realm (e.g. `justapps`) or reuse an existing one.

### 2. Create a Client

1. Go to **Clients** → **Create client**
2. **Client ID**: `justapps` (must match `AUTH_KEYCLOAK_ID` and `oidc.client_id`)
3. **Client Protocol**: `openid-connect`
4. **Access Type**: `confidential` (required for NextAuth server-side flows)
5. **Valid Redirect URIs**:
   - Development: `http://localhost:3000/api/auth/callback/keycloak`
   - Production: `https://your-domain.com/api/auth/callback/keycloak`
6. **Web Origins**: `*` or your frontend URL

### 3. Client Secret

Copy the **Client Secret** from the **Credentials** tab into `AUTH_KEYCLOAK_SECRET`.

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

## Environment Variables

### Backend (`config.yaml` or env overrides)

```yaml
oidc:
  enabled: true
  issuer: https://your-keycloak/realms/your-realm
  client_id: justapps
  admin_group: admin
```

| Env var | Description |
|---------|-------------|
| `BACKEND_OIDC_ENABLED` | `true` to enable OIDC |
| `BACKEND_OIDC_ISSUER` | Keycloak realm URL |
| `BACKEND_OIDC_CLIENT_ID` | Must match Keycloak client ID |
| `BACKEND_OIDC_ADMIN_GROUP` | Group name that grants admin rights |

### Frontend (`.env`)

```env
AUTH_KEYCLOAK_ID=justapps
AUTH_KEYCLOAK_SECRET=your-client-secret
AUTH_KEYCLOAK_ISSUER=https://your-keycloak/realms/your-realm
AUTH_ADMIN_GROUP=admin
AUTH_SECRET=random-secret-string
AUTH_URL=https://your-domain.com
```

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
| `Token Validation Failed` | Ensure `oidc.issuer` matches the `iss` claim in the JWT exactly (no trailing slash) |
| `Admin Access Denied` | Inspect the token at [jwt.io](https://jwt.io) — confirm `groups` or `roles` claim contains your admin group name |
| `CORS Issues` | Add your frontend URL to Keycloak **Web Origins** |
| `Offline User Session Not Found` | Ensure `offline_access` scope is assigned to the client and user/group |
| Sessions expire too quickly | Increase **Realm Settings** → **Sessions** → **SSO Session Idle** (30m+) |
