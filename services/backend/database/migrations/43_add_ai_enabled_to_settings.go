package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 43: adding ai_enabled to platform_settings...")
		if _, err := db.ExecContext(ctx, `ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT true`); err != nil {
			return fmt.Errorf("add ai_enabled to platform_settings: %w", err)
		}
		if _, err := db.ExecContext(ctx, `UPDATE platform_settings SET ai_enabled = true WHERE id = 'default' AND ai_enabled = false`); err != nil {
			return fmt.Errorf("backfill ai_enabled in platform_settings: %w", err)
		}
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 43 rollback: dropping ai_enabled from platform_settings...")
		if _, err := db.ExecContext(ctx, `ALTER TABLE platform_settings DROP COLUMN IF EXISTS ai_enabled`); err != nil {
			return fmt.Errorf("drop ai_enabled from platform_settings: %w", err)
		}
		return nil
	})
}