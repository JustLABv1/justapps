package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 26: adding version and changelog columns to apps...")

		_, err := db.ExecContext(ctx, `
			ALTER TABLE apps ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '';
			ALTER TABLE apps ADD COLUMN IF NOT EXISTS changelog TEXT NOT NULL DEFAULT '';
		`)
		if err != nil {
			return fmt.Errorf("add version/changelog to apps: %w", err)
		}

		fmt.Println("Migration 26: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 26 rollback: dropping version and changelog columns from apps...")
		_, err := db.ExecContext(ctx, `
			ALTER TABLE apps DROP COLUMN IF EXISTS version;
			ALTER TABLE apps DROP COLUMN IF EXISTS changelog;
		`)
		return err
	})
}
