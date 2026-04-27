package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 39: adding provider_type column for repository sync...")

		statements := []string{
			`ALTER TABLE gitlab_app_links ADD COLUMN IF NOT EXISTS provider_type TEXT NOT NULL DEFAULT 'gitlab'`,
			`ALTER TABLE gitlab_provider_settings ADD COLUMN IF NOT EXISTS provider_type TEXT NOT NULL DEFAULT 'gitlab'`,
			`UPDATE gitlab_app_links SET provider_type = 'gitlab' WHERE provider_type IS NULL OR provider_type = ''`,
			`UPDATE gitlab_provider_settings SET provider_type = 'gitlab' WHERE provider_type IS NULL OR provider_type = ''`,
		}
		for _, statement := range statements {
			if _, err := db.ExecContext(ctx, statement); err != nil {
				return fmt.Errorf("migration 39: %w", err)
			}
		}

		fmt.Println("Migration 39: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 39 rollback: dropping provider_type columns...")
		statements := []string{
			`ALTER TABLE gitlab_app_links DROP COLUMN IF EXISTS provider_type`,
			`ALTER TABLE gitlab_provider_settings DROP COLUMN IF EXISTS provider_type`,
		}
		for _, statement := range statements {
			if _, err := db.ExecContext(ctx, statement); err != nil {
				return err
			}
		}
		return nil
	})
}
