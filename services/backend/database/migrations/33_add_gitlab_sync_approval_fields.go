package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 33: adding gitlab sync approval fields...")

		statements := []string{
			`ALTER TABLE gitlab_app_links ADD COLUMN IF NOT EXISTS pending_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb`,
			`ALTER TABLE gitlab_app_links ADD COLUMN IF NOT EXISTS approval_required BOOLEAN NOT NULL DEFAULT false`,
			`ALTER TABLE gitlab_app_links ADD COLUMN IF NOT EXISTS last_applied_at TIMESTAMPTZ`,
			`ALTER TABLE gitlab_app_links ADD COLUMN IF NOT EXISTS last_manual_change_at TIMESTAMPTZ`,
		}

		for _, statement := range statements {
			if _, err := db.ExecContext(ctx, statement); err != nil {
				return fmt.Errorf("alter gitlab_app_links: %w", err)
			}
		}

		fmt.Println("Migration 33: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 33 rollback: dropping gitlab sync approval fields...")
		statements := []string{
			`ALTER TABLE gitlab_app_links DROP COLUMN IF EXISTS pending_snapshot`,
			`ALTER TABLE gitlab_app_links DROP COLUMN IF EXISTS approval_required`,
			`ALTER TABLE gitlab_app_links DROP COLUMN IF EXISTS last_applied_at`,
			`ALTER TABLE gitlab_app_links DROP COLUMN IF EXISTS last_manual_change_at`,
		}

		for _, statement := range statements {
			if _, err := db.ExecContext(ctx, statement); err != nil {
				return err
			}
		}
		return nil
	})
}
