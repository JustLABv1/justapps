package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 24: adding sort config and pinned_apps to platform_settings...")

		_, err := db.ExecContext(ctx, `
			ALTER TABLE platform_settings
				ADD COLUMN IF NOT EXISTS app_sort_field TEXT NOT NULL DEFAULT 'name',
				ADD COLUMN IF NOT EXISTS app_sort_direction TEXT NOT NULL DEFAULT 'asc',
				ADD COLUMN IF NOT EXISTS pinned_apps TEXT[] NOT NULL DEFAULT '{}'
		`)
		if err != nil {
			return fmt.Errorf("add sort columns to platform_settings: %w", err)
		}

		fmt.Println("Migration 24: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 24 rollback: dropping sort columns from platform_settings...")
		_, err := db.ExecContext(ctx, `
			ALTER TABLE platform_settings
				DROP COLUMN IF EXISTS app_sort_field,
				DROP COLUMN IF EXISTS app_sort_direction,
				DROP COLUMN IF EXISTS pinned_apps
		`)
		return err
	})
}
