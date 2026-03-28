package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 28: adding top_banner_type column to platform_settings...")

		_, err := db.ExecContext(ctx, `
			ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS top_banner_type TEXT NOT NULL DEFAULT 'info';
		`)
		if err != nil {
			return fmt.Errorf("add top_banner_type to platform_settings: %w", err)
		}

		fmt.Println("Migration 28: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 28 rollback: dropping top_banner_type column from platform_settings...")
		_, err := db.ExecContext(ctx, `
			ALTER TABLE platform_settings DROP COLUMN IF EXISTS top_banner_type;
		`)
		return err
	})
}
