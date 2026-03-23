# Keycloak Integration & Admin Setup

This document describes how to set up Keycloak for OIDC authentication and how to manage users in JustApps.

## Keycloak Configuration

### 1. Create a Realm
Create a new realm (e.g., `justapps`) or use an existing one.

### 2. Create a Client
1. Go to **Clients** -> **Create client**.
2. **Client ID**: `justapps` (or as configured in `.env`).
3. **Client Protocol**: `openid-connect`.
4. **Access Type**: `confidential` (for NextAuth) or `public` (if exclusively using frontend-only flow, but NextAuth prefers confidential).
5. **Valid Redirect URIs**: 
   - `http://localhost:3000/api/auth/callback/keycloak` (Development)
   - `https://your-domain.de/api/auth/callback/keycloak` (Production)
6. **Web Origins**: `*` or your frontend URL.

### 3. Essential Scopes & Offline Access (Crucial for Session Persistence)
To prevent the `Offline user session not found` error and ensure long-running sessions:

1. **Client Scopes**:
   - Go to **Clients** -> (your client) -> **Client Scopes**.
   - Ensure `offline_access` is in the **Default** or **Optional** column.
2. **User Role (Crucial)**:
   - For a user to get an offline token, they must have the `offline_access` role.
   - Go to **Realm Roles** -> find `offline_access`.
   - Go to **Role Mapping** for a specific user OR a **Group** (like your `admin` group).
   - Assign the `offline_access` realm role to that user/group.
3. **Dedicated Scope**:
   - In the **Client Scopes** tab of your client, click on the `{client-id}-dedicated` scope.
   - Go to **Mappers** and ensure you have mappers for `audience`, `groups`, and `roles`.
4. **Advanced Settings**:
   - Go to **Clients** -> (your client) -> **Advanced**.
   - **Proof Key for Code Exchange (PKCE)**: Should be set to `S256` (matches our frontend config).
   - **OpenID Connect Compatibility Modes**: Ensure `Exclude Session State From Authentication Response` is **OFF**.

### 4. Client Secret
If the client is `confidential`, copy the **Client Secret** from the **Credentials** tab.

### 4. Admin Role / Group
The application checks for an admin status via a group or role named `admin` (configurable via `BACKEND_OIDC_ADMIN_GROUP`).

1. Go to **Groups** and create a group named `admin`.
2. Assign users who should have management access to this group.
3. Ensure the group information is included in the ID Token. Go to **Client Scopes** -> `roles` or `groups` (or create a new scope) and add a **Group Membership** mapper.

## Environment Variables

### Backend (`services/backend/.env` or Config)
```env
BACKEND_OIDC_ENABLED=true
BACKEND_OIDC_ISSUER=http://keycloak:8080/realms/justapps
BACKEND_OIDC_CLIENT_ID=justapps
BACKEND_OIDC_ADMIN_GROUP=admin
```

### Frontend (`services/frontend/.env.local`)
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=a-very-secret-random-string

KEYCLOAK_CLIENT_ID=justapps
KEYCLOAK_CLIENT_SECRET=your-client-secret
KEYCLOAK_ISSUER=http://keycloak:8080/realms/justapps
```

## User Management Via UI

Once OIDC is configured and you have logged in as an admin:

1. Navigate to `/management` (or click "Verwaltung" in the profile menu).
2. Use the **Users** tab to:
   - View all registered users.
   - Create new local users (outside of OIDC).
   - Edit user roles.
   - **Lock/Unlock** users to prevent/allow access.
   - Delete users.

*Note: OIDC users are managed in Keycloak, but their status is verified by the backend middleware on every request.*

## Troubleshooting

- **Token Validation Failed**: Ensure the `ISSUER` URL in the backend matches the `iss` claim in the JWT exactly.
- **Admin Access Denied**: Check if the `groups` or `roles` claim is present in the token and contains the `admin` value. You can inspect tokens at [jwt.io](https://jwt.io).
- **CORS Issues**: Ensure Keycloak has the correct **Web Origins** configured.
- **Offline User Session Not Found**: This error in the logs means `offline_access` is requested by the code but not allowed/available in Keycloak. 
  1. Go to **Client Scopes** in Keycloak sidebar.
  2. Verify `offline_access` exists.
  3. Go to your **Client** -> **Client Scopes**.
  4. Ensure `offline_access` is in the **Default** or **Optional** columns.
  5. If the error persists, check **Realm Settings** -> **Sessions** -> **SSO Session Idle** (increase to 30m+).
  6. **Pro Tip**: In the Keycloak User view, check the **Sessions** tab. If no "Offline" sessions appear for a logged-in user, the scope is not being granted.
