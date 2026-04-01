package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 35: adding icon to app_groups...")

		_, err := db.ExecContext(ctx, `
			ALTER TABLE app_groups
				ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT ''
		`)
		if err != nil {
			return fmt.Errorf("add icon to app_groups: %w", err)
		}

		fmt.Println("Migration 35: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 35 rollback: dropping icon from app_groups...")
		_, err := db.ExecContext(ctx, `ALTER TABLE app_groups DROP COLUMN IF EXISTS icon`)
		return err
	})
}
