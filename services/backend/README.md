# JustApps Backend

## OIDC Configuration (Keycloak)

To enable OIDC authentication with Keycloak, update your `config.yaml` or set the following environment variables:

### Config File (`config.yaml`)

```yaml
oidc:
  enabled: true
  issuer: "https://<keycloak-url>/realms/<realm-name>"
  client_id: "just-apps"
  admin_group: "2Fa" # The group or role in Keycloak that identifies an admin
```

### Environment Variables

- `BACKEND_OIDC_ENABLED`: `true`
- `BACKEND_OIDC_ISSUER`: `https://<keycloak-url>/realms/<realm-name>`
- `BACKEND_OIDC_CLIENT_ID`: `just-apps`
- `BACKEND_OIDC_ADMIN_GROUP`: `2Fa` (Default for this deployment)

## User Management

Admin users can manage other users via the `/api/v1/admin/users` endpoints. This includes creating, editing, deleting, and disabling users.
The Frontend provides a UI for this under the `/management` page (Users tab).
