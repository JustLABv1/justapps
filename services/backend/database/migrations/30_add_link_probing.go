package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 30: adding link probing fields...")

		_, err := db.ExecContext(ctx, `
			ALTER TABLE platform_settings
				ADD COLUMN IF NOT EXISTS enable_link_probing BOOLEAN NOT NULL DEFAULT false
		`)
		if err != nil {
			return fmt.Errorf("add enable_link_probing to platform_settings: %w", err)
		}

		_, err = db.ExecContext(ctx, `
			ALTER TABLE apps
				ADD COLUMN IF NOT EXISTS skip_link_probe BOOLEAN NOT NULL DEFAULT false
		`)
		if err != nil {
			return fmt.Errorf("add skip_link_probe to apps: %w", err)
		}

		fmt.Println("Migration 30: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 30 rollback: dropping link probing fields...")
		_, err := db.ExecContext(ctx, `
			ALTER TABLE platform_settings DROP COLUMN IF EXISTS enable_link_probing
		`)
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, `
			ALTER TABLE apps DROP COLUMN IF EXISTS skip_link_probe
		`)
		return err
	})
}
