package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 46: normalizing invalid app sort field values...")

		_, err := db.ExecContext(ctx, `
			UPDATE platform_settings
			SET app_sort_field = 'name'
			WHERE app_sort_field = 'authority'
		`)
		if err != nil {
			return fmt.Errorf("normalize platform_settings.app_sort_field: %w", err)
		}

		fmt.Println("Migration 46: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 46 rollback: no-op for app sort field normalization...")
		return nil
	})
}
