# GitLab Integration

> **Note:** Repository sync now supports both GitLab and GitHub (including GitHub Enterprise). See [Repository-Sync](Repository-Sync.md) for the up-to-date, provider-neutral documentation. This page is kept for historical reference.

JustApps can connect to one or more GitLab instances and automatically sync project metadata into the app catalog. This keeps app listings up-to-date without manual editing.

---

## How It Works

1. An admin configures a **GitLab Provider** (instance URL + access token)
2. The backend runs a **scheduler** that periodically queries the GitLab API
3. Linked GitLab projects are synced as apps (name, description, topics, links)
4. Synced apps enter an **approval queue** — admins review before they appear publicly

---

## Setup

### 1. Create a GitLab Access Token

In your GitLab instance:

1. Go to **User Settings** → **Access Tokens** (or a Project / Group token)
2. Scopes needed: `read_api`
3. Copy the token

### 2. Add a Provider

In the JustApps admin UI (`/verwaltung`):

1. Open the **Settings** tab → **GitLab Providers**
2. Click **Add Provider**
3. Fill in:
   - **Name**: A display label (e.g. `Internal GitLab`)
   - **URL**: Your GitLab instance URL (e.g. `https://gitlab.example.com`)
   - **Access Token**: The token from step 1
   - **Sync Interval**: How often to poll (in minutes)
4. Save

Or via API:

```http
POST /api/v1/admin/gitlab/providers
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "name": "Internal GitLab",
  "url": "https://gitlab.example.com",
  "access_token": "glpat-xxxx",
  "sync_interval_minutes": 60
}
```

### 3. Link an App to a GitLab Project

Either during sync (automatic) or manually:

```http
POST /api/v1/admin/gitlab/providers/:provider_id/link
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "app_id": "uuid-of-app",
  "gitlab_project_id": 12345
}
```

### 4. Trigger a Manual Sync

```bash
POST /api/v1/admin/gitlab/providers/:id/sync
```

Or click **Sync Now** in the admin UI.

---

## Approval Workflow

Synced apps are not published automatically. They appear in an **Approval Queue** in the admin UI:

- **Approve** — publishes the app to the catalog
- **Reject** — discards the synced entry
- **Pending** — default state after sync

This prevents unreviewed or unwanted projects from appearing in the catalog.

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `gitlab_providers` | Stores provider credentials and sync settings |
| `gitlab_app_links` | Maps JustApps apps to GitLab project IDs |

Relevant migrations: `31_add_gitlab_app_links.go`, `32_add_gitlab_provider_settings.go`, `33_add_gitlab_sync_approval_fields.go`

---

## Source Code

| File | Purpose |
|------|---------|
| `functions/integrations/gitlab/client.go` | GitLab REST API client |
| `functions/integrations/gitlab/providers.go` | Provider CRUD logic |
| `functions/integrations/gitlab/scheduler.go` | Background sync scheduler |
| `functions/integrations/gitlab/service.go` | App linking and sync business logic |
| `pkg/models/gitlab.go` | Database model structs |
