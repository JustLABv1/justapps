package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 36: adding branding color preset fields...")

		_, err := db.ExecContext(ctx, `
			ALTER TABLE platform_settings
				ADD COLUMN IF NOT EXISTS top_bar_preset TEXT NOT NULL DEFAULT 'deutschland',
				ADD COLUMN IF NOT EXISTS top_bar_colors JSONB NOT NULL DEFAULT '[]',
				ADD COLUMN IF NOT EXISTS hero_title_preset TEXT NOT NULL DEFAULT 'deutschland',
				ADD COLUMN IF NOT EXISTS hero_title_colors JSONB NOT NULL DEFAULT '[]'
		`)
		if err != nil {
			return fmt.Errorf("add branding color preset columns to platform_settings: %w", err)
		}

		fmt.Println("Migration 36: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 36 rollback: dropping branding color preset fields...")
		_, err := db.ExecContext(ctx, `
			ALTER TABLE platform_settings
				DROP COLUMN IF EXISTS top_bar_preset,
				DROP COLUMN IF EXISTS top_bar_colors,
				DROP COLUMN IF EXISTS hero_title_preset,
				DROP COLUMN IF EXISTS hero_title_colors
		`)
		return err
	})
}
