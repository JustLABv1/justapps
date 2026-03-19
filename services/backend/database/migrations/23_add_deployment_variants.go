package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 23: adding deployment_variants to apps...")

		_, err := db.ExecContext(ctx, `ALTER TABLE apps ADD COLUMN IF NOT EXISTS deployment_variants JSONB NOT NULL DEFAULT '[]'`)
		if err != nil {
			return fmt.Errorf("add deployment_variants column: %w", err)
		}

		fmt.Println("Migration 23: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 23 rollback: dropping deployment_variants from apps...")
		_, err := db.ExecContext(ctx, `ALTER TABLE apps DROP COLUMN IF EXISTS deployment_variants`)
		return err
	})
}
