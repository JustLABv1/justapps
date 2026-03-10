package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Adding hero_badge field to platform_settings...")
		_, err := db.ExecContext(ctx, "ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS hero_badge TEXT")
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Removing hero_badge field from platform_settings...")
		_, err := db.ExecContext(ctx, "ALTER TABLE platform_settings DROP COLUMN IF EXISTS hero_badge")
		return err
	})
}
