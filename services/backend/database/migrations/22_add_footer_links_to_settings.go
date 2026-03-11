package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 22: adding footer_links to platform_settings...")

		_, err := db.ExecContext(ctx, `ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS footer_links JSONB NOT NULL DEFAULT '[]'`)
		if err != nil {
			return fmt.Errorf("add footer_links column: %w", err)
		}

		fmt.Println("Migration 22: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 22 rollback: dropping footer_links from platform_settings...")
		_, err := db.ExecContext(ctx, `ALTER TABLE platform_settings DROP COLUMN IF EXISTS footer_links`)
		return err
	})
}
