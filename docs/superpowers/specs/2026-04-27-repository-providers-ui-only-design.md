# Repository Providers UI-Only Design

Date: 2026-04-27

## Goal

Move repository provider management out of backend static configuration and into the admin UI under Verwaltung -> Integrationen. Repository providers become database-backed records managed through CRUD APIs. Provider tokens are stored in the database encrypted at rest. The backend configuration, `config.yaml`, and Helm chart no longer define providers themselves; they only define the encryption secret required to encrypt and decrypt provider tokens.

## Approved Decisions

- Use the existing provider settings table as the canonical provider registry instead of introducing a second provider table.
- Store provider tokens in the database encrypted at rest.
- Use a dedicated backend encryption secret for provider tokens.
- Allow the encryption secret to be supplied by environment variable, `config.yaml`, or Helm-managed secret wiring.
- Keep `providerKey` immutable after creation.
- Block provider deletion while any app is linked to that provider.
- Do not migrate provider definitions from backend config. After rollout, admins recreate providers in the UI.
- The Verwaltung integrations page becomes the only supported provider-management surface.

## Non-Goals

- Renaming historical database table names in this change.
- Renaming all internal `GitLab*` type names in one sweep.
- Preserving config-based provider definitions after rollout.
- Building external secret-store integration for provider tokens.

## Current State

Today, provider metadata is split:

- Static provider identity and token come from backend config.
- Runtime settings such as label overrides, allowlists, intervals, and defaults are stored in `gitlab_provider_settings`.
- The admin UI edits only the DB-backed settings overlay.

That architecture prevents full provider management in the UI because the source of truth for a provider still lives in backend config.

## Proposed Architecture

The existing `gitlab_provider_settings` table becomes the single source of truth for repository providers.

The backend flow becomes:

1. Admin creates a provider in the Verwaltung integrations page.
2. Backend validates the request and encrypts the supplied token using a dedicated secret.
3. Backend stores provider metadata plus encrypted token material in the database.
4. Repository sync, provider dropdowns, provider summaries, and scheduling all read providers from the database only.
5. Provider update operations can replace token material without ever returning the plaintext token to clients.

The backend configuration is reduced to one responsibility for repository providers: supplying the encryption key used for token-at-rest encryption.

## Data Model Changes

### Existing Table

Reuse `gitlab_provider_settings` as the canonical provider registry.

### New / Required Columns

Add or ensure the following fields exist on `gitlab_provider_settings`:

- `provider_key TEXT PRIMARY KEY`
- `provider_type TEXT NOT NULL`
- `label TEXT`
- `base_url TEXT`
- `namespace_allowlist JSONB NOT NULL DEFAULT '[]'`
- `enabled BOOLEAN NOT NULL DEFAULT true`
- `auto_sync_enabled BOOLEAN NOT NULL DEFAULT true`
- `sync_interval_minutes INTEGER NOT NULL DEFAULT 15`
- `default_readme_path TEXT`
- `default_helm_values_path TEXT`
- `default_compose_file_path TEXT`
- `encrypted_token BYTEA or TEXT NOT NULL DEFAULT ''`
- `token_nonce BYTEA or TEXT NOT NULL DEFAULT ''`
- `token_key_version TEXT NOT NULL DEFAULT 'v1'`
- `token_configured BOOLEAN NOT NULL DEFAULT false`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`

The exact DB type for encrypted fields can be `TEXT` with base64 encoding or `BYTEA`. Prefer `TEXT` if that keeps Bun usage simpler in this codebase.

### App Links

`gitlab_app_links.provider_key` and `provider_type` remain unchanged and continue referencing provider identity by immutable key.

## Encryption Design

### Secret Source

Use a dedicated backend secret for provider-token encryption.

Supported configuration sources, in priority order:

1. `BACKEND_REPOSITORY_PROVIDER_ENCRYPTION_SECRET`
2. `repository_provider_encryption.secret` in backend `config.yaml`
3. Helm-managed secret wiring into the same backend env var

### Behavior

- Backend startup fails if repository provider APIs or sync services are initialized without an encryption secret configured.
- Encryption secret is never exposed through API responses.
- Token plaintext is accepted only on create and replace requests.
- Token plaintext is never returned to the frontend after save.
- Existing encrypted tokens are decrypted only inside backend runtime code when creating provider runtimes for sync operations.

### Crypto Shape

Use authenticated encryption with a modern AEAD, preferably AES-256-GCM if implemented with the Go standard library. Store nonce and ciphertext separately or in one encoded payload, but keep the storage format explicit and versioned.

### Key Rotation

This design does not implement full key rotation. `token_key_version` is included so a later migration can support it cleanly.

## Backend API Changes

### Admin Endpoints

Keep the current repository-provider endpoint family and extend it to full CRUD:

- `GET /v1/settings/repository-providers`
- `POST /v1/settings/repository-providers`
- `PUT /v1/settings/repository-providers/:key`
- `DELETE /v1/settings/repository-providers/:key`

### Non-Admin Endpoint

Keep:

- `GET /v1/settings/repository-providers/available`

This continues to return only non-sensitive summaries for authenticated users.

### Create Request

`POST /settings/repository-providers`

Request body:

- `providerKey`
- `providerType`
- `label`
- `baseUrl`
- `token`
- `namespaceAllowlist`
- `enabled`
- `autoSyncEnabled`
- `syncIntervalMinutes`
- `defaultReadmePath`
- `defaultHelmValuesPath`
- `defaultComposeFilePath`

Validation rules:

- `providerKey` required, trimmed, immutable, and unique.
- `providerType` required and must be one of supported provider types.
- `baseUrl` required and normalized.
- `token` required on create.
- `syncIntervalMinutes` must be positive.

### Update Request

`PUT /settings/repository-providers/:key`

Editable fields:

- `label`
- `baseUrl`
- `namespaceAllowlist`
- `enabled`
- `autoSyncEnabled`
- `syncIntervalMinutes`
- `defaultReadmePath`
- `defaultHelmValuesPath`
- `defaultComposeFilePath`
- optional token action fields:
  - `replaceToken`
  - `clearToken`

Rules:

- `providerKey` is not editable.
- `providerType` is not editable after creation in this design.
- `replaceToken` and `clearToken` are mutually exclusive.
- Clearing the token leaves the provider unconfigured for sync until a replacement token is set.

### Delete Request

`DELETE /settings/repository-providers/:key`

Rules:

- If any `gitlab_app_links` row references the provider key, deletion is blocked with a clear error.
- Disabled-but-linked providers are still not deletable.
- If unlinked, delete the provider row.

### Response Shape

Admin responses continue to omit plaintext token data. They include:

- `configured`
- `tokenConfigured`
- provider metadata and defaults
- optional `linkedAppsCount` if useful for delete-state UI

## Backend Runtime Changes

### Provider Loading

Replace provider resolution from backend config with provider resolution from the database.

Affected behavior:

- Admin provider listing uses DB only.
- Available provider listing uses DB only.
- App link resolution uses DB only.
- Sync scheduler uses DB only.
- Manual sync uses DB only.

### Scheduler

The scheduler currently builds provider runtimes from config plus DB overrides. After this change it builds provider runtimes directly from DB records, decrypting tokens at runtime.

### Error Handling

If token decryption fails for a provider:

- Log a backend error with provider key.
- Exclude that provider from available runtime providers.
- Surface a clear admin error or status on provider listing if feasible.
- Do not crash unrelated provider operations unless the encryption secret itself is missing at startup.

## Frontend Changes

The Verwaltung -> Integrationen section becomes full provider management UI.

### Provider List

Display:

- immutable provider key
- provider type badge
- label
- base URL
- enabled state
- token configured state
- auto-sync state
- sync interval
- linked-state / deletion eligibility

### Create Flow

Add a form for creating a provider with:

- key
- type
- label
- base URL
- token
- allowlist
- enabled toggle
- auto-sync toggle
- default file paths

### Update Flow

Existing rows remain editable for non-identity fields.

Token UX:

- show `Token configured` or `No token configured`
- offer `Replace token`
- offer `Clear token`
- never display the saved token value

### Delete Flow

- show delete action only for unlinked providers, or allow action but surface backend-blocked message
- if linked, show a message that deletion is blocked until app links are removed

## Validation Rules

### Provider Key

- lowercase canonical format recommended
- immutable after creation
- reject duplicates case-insensitively

### Provider Type

- limited to supported adapters: `gitlab`, `github`

### Base URL

- normalize trailing slash removal
- apply type-specific default only if the UI intentionally supports blank base URL on create; otherwise require explicit input

### Token

- required on create
- optional on update unless `clearToken` is used

## Rollout Impact

This is a breaking operational change.

After deployment:

- backend config provider definitions are ignored
- admins must recreate providers once in the Verwaltung UI
- Helm values no longer carry provider definitions
- Helm/config only carry the encryption secret for provider-token storage

This must be called out in release notes and operator documentation.

## Documentation Changes

Update:

- repository sync docs
- backend config docs
- Helm docs
- admin guide / integrations page docs

Required documentation message:

- repository providers are configured in the admin UI only
- backend config only provides the encryption secret
- tokens are stored encrypted at rest in the database
- provider deletion is blocked while linked apps exist

## Testing Strategy

### Backend

- migration tests or migration verification for new provider columns
- create provider with token succeeds
- create provider without token fails
- list providers never returns plaintext token
- update provider metadata succeeds
- replace token updates encrypted fields and keeps token hidden
- clear token marks provider unconfigured
- delete unlinked provider succeeds
- delete linked provider fails
- provider runtime loading decrypts token and supports sync
- startup or provider-management path fails cleanly when encryption secret is missing

### Frontend

- admin page can create provider
- admin page can update provider metadata
- token section shows configured state without exposing value
- delete action handles linked-provider error cleanly
- provider list refreshes after create/update/delete

### Manual Validation

- create GitLab provider via UI and link an app
- create GitHub provider via UI and link an app
- verify scheduler and manual sync still work
- verify app editor provider dropdown is populated from DB-backed providers only

## Risks

- Missing encryption secret blocks provider create/update and possibly sync runtime.
- Admins must recreate providers manually after rollout.
- Existing code paths still named `GitLab*` can make the implementation harder to reason about if touched too broadly.
- Provider decryption failures need clear operator diagnostics or the UI may look inconsistent.

## Recommended Implementation Order

1. Add DB migration for encrypted token storage and any required canonical provider fields.
2. Add backend encryption helper using the dedicated encryption secret.
3. Refactor provider runtime loading to DB-only.
4. Extend admin provider APIs to full CRUD plus token actions.
5. Update Verwaltung integrations UI for create, token replace, token clear, and delete.
6. Remove provider definitions from config and Helm docs, keeping only encryption secret wiring.
7. Validate backend and frontend behavior end to end.
