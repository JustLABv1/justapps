# Contributing

Contributions are welcome — bug reports, feature requests, documentation improvements, and code changes.

---

## Workflow

1. **Open an issue** first for bugs or significant feature requests — discuss before building
2. **Fork** the repository and create a feature branch:
   ```bash
   git checkout -b feat/my-feature
   ```
3. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` — new features
   - `fix:` — bug fixes
   - `chore:` — maintenance, dependencies, tooling
   - `docs:` — documentation only
4. **Open a PR** against `main` — the PR Check workflow runs automatically
5. All checks must pass before merging

---

## PR Check Workflow

The `pr-check.yml` workflow validates:

| Check | Tool |
|-------|------|
| TypeScript types | `tsc --noEmit` |
| Frontend lint | ESLint |
| Frontend build | `next build` |
| Backend vet | `go vet ./...` |
| Backend build | `go build ./...` |

Fix any failures before requesting review.

---

## Local Development Setup

See [Getting Started](Getting-Started) for full setup instructions.

```bash
# Backend (Go)
cd services/backend
go run main.go --config config.yaml

# Frontend (Next.js)
cd services/frontend
pnpm dev
```

---

## Database Migrations

Add new migrations in `services/backend/database/migrations/`:

```go
// N_describe_change.go
package migrations

import (
    "github.com/uptrace/bun"
)

func init() {
    Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
        _, err := db.ExecContext(ctx, `ALTER TABLE apps ADD COLUMN new_field text`)
        return err
    }, func(ctx context.Context, db *bun.DB) error {
        _, err := db.ExecContext(ctx, `ALTER TABLE apps DROP COLUMN new_field`)
        return err
    })
}
```

Migrations run automatically on backend startup in sequence.

---

## Release Process

Releases are created by pushing a semver tag:

```bash
git tag v1.2.0
git push origin v1.2.0
```

The `release.yml` workflow automatically:
- Builds and publishes the Docker image to `ghcr.io/JustLABv1/justapps`
- Publishes the Helm chart to `oci://ghcr.io/justlabv1/charts/justapps`
- Creates a GitHub Release with a changelog

---

## Code Style

- **Go**: `gofmt` formatted; follow idiomatic Go conventions
- **TypeScript**: ESLint enforced; prefer functional components with hooks
- **Commits**: Conventional Commits format required
- **No large refactors without discussion** — open an issue first
