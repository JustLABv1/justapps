package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Adding branding fields to platform_settings...")

		columns := []string{
			"ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS store_name TEXT",
			"ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS store_description TEXT",
			"ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS logo_url TEXT",
			"ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS logo_dark_url TEXT",
			"ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS favicon_url TEXT",
			"ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS accent_color TEXT",
			"ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS hero_title TEXT",
			"ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS hero_subtitle TEXT",
			"ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS footer_text TEXT",
			"ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS show_flag_bar BOOLEAN NOT NULL DEFAULT true",
		}

		for _, col := range columns {
			if _, err := db.ExecContext(ctx, col); err != nil {
				return err
			}
		}

		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Removing branding fields from platform_settings...")

		columns := []string{
			"ALTER TABLE platform_settings DROP COLUMN IF EXISTS store_name",
			"ALTER TABLE platform_settings DROP COLUMN IF EXISTS store_description",
			"ALTER TABLE platform_settings DROP COLUMN IF EXISTS logo_url",
			"ALTER TABLE platform_settings DROP COLUMN IF EXISTS logo_dark_url",
			"ALTER TABLE platform_settings DROP COLUMN IF EXISTS favicon_url",
			"ALTER TABLE platform_settings DROP COLUMN IF EXISTS accent_color",
			"ALTER TABLE platform_settings DROP COLUMN IF EXISTS hero_title",
			"ALTER TABLE platform_settings DROP COLUMN IF EXISTS hero_subtitle",
			"ALTER TABLE platform_settings DROP COLUMN IF EXISTS footer_text",
			"ALTER TABLE platform_settings DROP COLUMN IF EXISTS show_flag_bar",
		}

		for _, col := range columns {
			if _, err := db.ExecContext(ctx, col); err != nil {
				return err
			}
		}

		return nil
	})
}
