package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 45: adding require_auth_for_app_store to platform_settings...")
		if _, err := db.ExecContext(ctx, `ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS require_auth_for_app_store BOOLEAN NOT NULL DEFAULT false`); err != nil {
			return fmt.Errorf("add require_auth_for_app_store to platform_settings: %w", err)
		}
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 45 rollback: dropping require_auth_for_app_store from platform_settings...")
		if _, err := db.ExecContext(ctx, `ALTER TABLE platform_settings DROP COLUMN IF EXISTS require_auth_for_app_store`); err != nil {
			return fmt.Errorf("drop require_auth_for_app_store from platform_settings: %w", err)
		}
		return nil
	})
}
