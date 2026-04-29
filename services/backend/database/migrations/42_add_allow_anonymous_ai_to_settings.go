package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 42: adding allow_anonymous_ai to platform_settings...")
		if _, err := db.ExecContext(ctx, `ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS allow_anonymous_ai BOOLEAN NOT NULL DEFAULT false`); err != nil {
			return fmt.Errorf("migration 42: %w", err)
		}
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 42 rollback: dropping allow_anonymous_ai from platform_settings...")
		if _, err := db.ExecContext(ctx, `ALTER TABLE platform_settings DROP COLUMN IF EXISTS allow_anonymous_ai`); err != nil {
			return err
		}
		return nil
	})
}