# Admin Guide

Admins access the management interface at `/verwaltung` (linked as "Verwaltung" in the user profile menu).

Admin rights are granted by:
- **OIDC**: membership in the configured Keycloak group (e.g. `admin`)
- **Local auth**: the `is_admin` flag set on the user record

---

## Users Tab

| Action | Description |
|--------|-------------|
| **View all users** | See all registered accounts (local + OIDC) |
| **Create user** | Add a new local account (username, password, role) |
| **Edit user** | Change display name, email, or admin status |
| **Lock / Unlock** | Disable or re-enable a user's access |
| **Delete user** | Permanently remove a user account |

> OIDC users are managed in Keycloak. Their account status is checked by the backend on every authenticated request — locking an OIDC user in JustApps prevents API access even with a valid token.

---

## Apps Tab

| Action | Description |
|--------|-------------|
| **View all apps** | See all apps including unlisted/pending entries |
| **Edit any app** | Modify metadata for any app regardless of ownership |
| **Delete any app** | Remove any app from the catalog |
| **Bulk import** | Upload a JSON file to create multiple apps at once |
| **Bulk export** | Download all apps as a JSON file |

### Import Format

```json
[
  {
    "name": "My App",
    "description": "A useful internal tool",
    "category": "DevOps",
    "tech_stack": ["Go", "Docker"],
    "status": "active",
    "version": "1.2.0"
  }
]
```

---

## Platform Settings

Accessible via the **Settings** tab in `/verwaltung`.

| Setting | Description |
|---------|-------------|
| **Platform name** | Displayed in the navigation and browser tab |
| **Logo URL** | Custom platform logo |
| **Top banner** | Optional announcement banner text and color |
| **Footer links** | Custom links shown in the page footer |
| **GitLab Providers** | Add/manage GitLab integrations |

---

## GitLab Approval Queue

When GitLab sync is enabled, synced projects appear in the **GitLab** tab for review before being published. See [GitLab Integration](GitLab-Integration) for details.

---

## API Admin Endpoints

All admin endpoints require a valid JWT with the admin role:

```
Authorization: Bearer <admin-jwt>
```

See [API Reference](API-Reference) for the full admin endpoint listing.
