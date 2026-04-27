# Repository Sync (GitLab & GitHub)

JustApps can connect to one or more repository providers and automatically sync project metadata, README content and selected files (Helm values, Compose) into the app catalog. This keeps app listings up to date without manual editing.

The same sync engine supports both **GitLab** (gitlab.com or self-hosted) and **GitHub** (github.com or GitHub Enterprise Server). Provider credentials are admin-managed and stored server-side only.

## How It Works

1. Operators provide a backend encryption secret via `repository_provider_encryption.secret` or `BACKEND_REPOSITORY_PROVIDER_ENCRYPTION_SECRET`.
2. An admin creates one or more **repository providers** (instance URL + access token + provider type) under **Verwaltung → Einstellungen → Repository-Provider**.
3. App owners link an app to a project under the **Repository** tab in the app editor.
4. The backend runs a periodic **scheduler** plus on-demand sync, calling the provider API and persisting a snapshot.
5. If the snapshot conflicts with manual edits, the change waits for explicit approval before being applied.

## Configuring a Provider

Provider definitions live in the database and are managed in the admin UI. Each provider has:

| Field | Description | Example |
|-------|-------------|---------|
| `key` | Stable internal identifier | `internal-gitlab`, `github-com` |
| `type` | Provider implementation. Supported: `gitlab` (default), `github` | `github` |
| `label` | Display name shown in the UI | `Internal GitLab` |
| `baseUrl` | Instance base URL. Defaults to `https://gitlab.com` for `gitlab`, `https://github.com` for `github` | `https://gitlab.example.org` |
| `token` | Access token for the provider | (PAT or fine-grained token) |
| `enabled` | Whether the provider is active | `true` |
| `namespaceAllowlist` | Optional list of namespaces or `owner/repo` prefixes that may be linked | `["my-team", "infra/platform"]` |
| `syncIntervalMinutes` | Automatic sync cadence for linked apps | `15` |

`key` and `type` are immutable after creation. Tokens are encrypted before they are stored and can be rotated or cleared from the same settings page.

### GitHub Enterprise Server

Create a provider with `type: github` and point `baseUrl` at the GHE host. Example values:

- `key`: `ghe-internal`
- `type`: `github`
- `baseUrl`: `https://ghe.example.org`
- `label`: `GHE`

The adapter automatically rewrites the API base to `<baseUrl>/api/v3` for GHE and uses `https://api.github.com` for `github.com`.

### Tokens

* **GitLab**: Project, group or personal access token with `read_api` and `read_repository` scopes.
* **GitHub**: Personal access token (classic with `repo` scope) or fine-grained token with `Contents: Read`, `Metadata: Read` and (for organisation repos) `Administration: Read`.

## Linking an App

1. Open the app editor and switch to the **Repository** tab.
2. Choose a provider, enter the project path (`group/project` for GitLab or `owner/repo` for GitHub) and an optional branch/file paths.
3. Save the link, then click **Sync**.
4. The backend reads project metadata, README, license, topics and any configured Helm values / Compose file, and stores them as the active snapshot.
5. Subsequent edits in the app editor mark the link as **awaiting approval**; an admin (or the app owner) approves the next sync to overwrite manual edits.

## API Endpoints

The provider-neutral routes are stable; the legacy `/gitlab` aliases stay for backwards compatibility.

| Operation | Endpoint |
|-----------|----------|
| Available providers (auth users) | `GET /v1/settings/repository-providers/available` |
| List providers (admin) | `GET /v1/settings/repository-providers` |
| Create provider (admin) | `POST /v1/settings/repository-providers` |
| Update provider settings (admin) | `PUT /v1/settings/repository-providers/:key` |
| Delete provider (admin) | `DELETE /v1/settings/repository-providers/:key` |
| Get app integration | `GET /v1/apps/:id/repository` |
| Upsert app link | `PUT /v1/apps/:id/repository` |
| Trigger sync | `POST /v1/apps/:id/repository/sync` |
| Approve pending change | `POST /v1/apps/:id/repository/approve` |
| Remove link | `DELETE /v1/apps/:id/repository` |

Legacy aliases: every `/repository*` route also responds at the equivalent `/gitlab*` path.

## Database Tables

| Table | Purpose |
|-------|---------|
| `gitlab_provider_settings` | Canonical provider registry. Stores type, label, base URL, encrypted token metadata, allowlists and sync settings. |
| `gitlab_app_links` | Maps JustApps apps to a single repository project. `provider_type` records the adapter used. |

> Table names will become provider-neutral in a future migration; for now they keep their historical `gitlab_` prefix to preserve existing data.

## Backups

Backup exports use the section names `repositoryProviders` and `repositoryAppLinks`. Imports continue to accept the legacy `gitLabProviders` and `gitLabAppLinks` section names for backwards compatibility.

## Approval Behaviour

Approval is only re-required when an app field that the sync manages (description, license, README, topics, Helm values, Compose file or repository links) diverges from the last applied snapshot. Routine edits to unrelated fields do not block the next automatic sync.
