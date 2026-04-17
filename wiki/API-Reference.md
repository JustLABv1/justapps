# API Reference

Base URL: `/api/v1`

**Auth levels:**
- `—` — public, no token required
- `User` — valid JWT required
- `Owner` — JWT required; caller must own the resource
- `Admin` — JWT required; caller must have the `admin` role

---

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | — | Returns `{"status":"ok"}` |

---

## Apps

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/apps` | — | List all apps |
| `GET` | `/apps/:id` | — | Get app details |
| `POST` | `/apps` | User | Create a new app |
| `PUT` | `/apps/:id` | Owner | Update app metadata |
| `DELETE` | `/apps/:id` | Owner | Delete an app |

### App Fields (create / update)

Common fields accepted in the request body:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name |
| `description` | string | Markdown description |
| `category` | string | Category label |
| `tech_stack` | string[] | Technologies used |
| `logo_url` | string | URL to the app logo |
| `status` | string | `active` \| `deprecated` \| `beta` |
| `version` | string | Current version string |
| `deployments` | object[] | Deployment instructions (docker, helm, etc.) |
| `links` | object[] | Custom external links |
| `tags` | string[] | Searchable tags |

---

## Ratings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/apps/:id/ratings` | — | List ratings for an app |
| `POST` | `/apps/:id/ratings` | User | Submit or update a rating |
| `DELETE` | `/apps/:id/ratings` | User | Delete own rating |

### Rating Body

```json
{
  "score": 4,
  "comment": "Great tool!"
}
```

`score` is an integer 1–5.

---

## Favorites

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/users/me/favorites` | User | List favorited apps |
| `POST` | `/apps/:id/favorite` | User | Add app to favorites |
| `DELETE` | `/apps/:id/favorite` | User | Remove from favorites |

---

## Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | — | Register a local account |
| `POST` | `/auth/login` | — | Login, returns JWT |
| `POST` | `/auth/oidc/exchange` | — | Exchange Keycloak token for app JWT |

### Login Body

```json
{
  "username": "user@example.com",
  "password": "your-password"
}
```

### Login Response

```json
{
  "token": "<jwt>",
  "user": { "id": "...", "username": "...", "is_admin": false }
}
```

---

## Platform Settings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/settings` | — | Get platform settings (branding, banner, footer) |
| `PUT` | `/settings` | Admin | Update platform settings |

### Selected Platform Settings Fields

The `/settings` payload includes branding fields that are intentionally public because the frontend reads them without authentication.

| Field | Type | Description |
|-------|------|-------------|
| `showFlagBar` | boolean | Shows or hides the thin color bar at the top of the page |
| `topBarPreset` | string | Selected preset for the top color bar, e.g. `deutschland`, `justapps`, `custom` |
| `topBarColors` | string[] | Custom top-bar colors used when `topBarPreset` is `custom` |
| `heroTitle` | string | Main title text on the homepage |
| `heroTitlePreset` | string | Selected color preset for the hero-title gradient |
| `heroTitleColors` | string[] | Custom gradient colors used when `heroTitlePreset` is `custom` |

Do not store secrets in platform settings. The `/settings` endpoint is public by design.

---

## Admin — Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/admin/users` | Admin | List all users |
| `POST` | `/admin/users` | Admin | Create a local user |
| `PUT` | `/admin/users/:id` | Admin | Update a user |
| `PUT` | `/admin/users/:id/state` | Admin | Enable or disable a user account |
| `DELETE` | `/admin/users/:id` | Admin | Delete a user |

---

## Admin — Apps

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/admin/apps` | Admin | List all apps (including unlisted) |
| `POST` | `/admin/apps/import` | Admin | Bulk import apps from JSON |
| `GET` | `/admin/apps/export` | Admin | Export all apps to JSON |

---

## GitLab Integration

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/admin/gitlab/providers` | Admin | List configured GitLab providers |
| `POST` | `/admin/gitlab/providers` | Admin | Add a GitLab provider |
| `PUT` | `/admin/gitlab/providers/:id` | Admin | Update provider settings |
| `DELETE` | `/admin/gitlab/providers/:id` | Admin | Remove a provider |
| `POST` | `/admin/gitlab/providers/:id/sync` | Admin | Trigger manual sync |

---

## File Uploads

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/upload/logo` | User | Upload an app logo, returns URL |

Accepted formats: `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`. Maximum size: 5 MB.

---

## Error Responses

All errors follow this structure:

```json
{
  "error": "human-readable message"
}
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request / validation error |
| `401` | Missing or invalid token |
| `403` | Insufficient permissions |
| `404` | Resource not found |
| `500` | Internal server error |
