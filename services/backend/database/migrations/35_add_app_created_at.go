package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 35: adding created_at to apps...")

		_, err := db.ExecContext(ctx, `
			ALTER TABLE apps
				ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
		`)
		if err != nil {
			return fmt.Errorf("add created_at to apps: %w", err)
		}

		_, err = db.ExecContext(ctx, `
			UPDATE apps AS a
			SET created_at = audit_rows.created_at
			FROM (
				SELECT substring(details from '\\(([^)]+)\\)$') AS app_id, MIN(created_at) AS created_at
				FROM audit
				WHERE operation = 'app.create'
				  AND details ~ '\\([0-9a-fA-F-]{36}\\)$'
				GROUP BY 1
			) AS audit_rows
			WHERE a.id = audit_rows.app_id
			  AND a.created_at IS NULL
		`)
		if err != nil {
			return fmt.Errorf("backfill apps.created_at from audit: %w", err)
		}

		_, err = db.ExecContext(ctx, `
			UPDATE apps
			SET created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP)
			WHERE created_at IS NULL
		`)
		if err != nil {
			return fmt.Errorf("fallback backfill for apps.created_at: %w", err)
		}

		_, err = db.ExecContext(ctx, `
			ALTER TABLE apps
				ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
				ALTER COLUMN created_at SET NOT NULL
		`)
		if err != nil {
			return fmt.Errorf("finalize apps.created_at column: %w", err)
		}

		fmt.Println("Migration 35: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 35 rollback: dropping created_at from apps...")
		_, err := db.ExecContext(ctx, `ALTER TABLE apps DROP COLUMN IF EXISTS created_at`)
		return err
	})
}
