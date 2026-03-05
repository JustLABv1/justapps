package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Adding top banner fields to platform_settings...")
		_, err := db.ExecContext(ctx, "ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS show_top_banner BOOLEAN NOT NULL DEFAULT false")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS top_banner_text TEXT")
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Removing top banner fields from platform_settings...")
		_, err := db.ExecContext(ctx, "ALTER TABLE platform_settings DROP COLUMN IF EXISTS show_top_banner")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE platform_settings DROP COLUMN IF EXISTS top_banner_text")
		return err
	})
}
