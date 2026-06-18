package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 49: adding diff details to app releases...")

		_, err := db.ExecContext(ctx, `
			ALTER TABLE app_releases
				ADD COLUMN IF NOT EXISTS change_details JSONB NOT NULL DEFAULT '[]'::jsonb,
				ADD COLUMN IF NOT EXISTS diff_preview TEXT NOT NULL DEFAULT '';
		`)
		if err != nil {
			return fmt.Errorf("add app release diff details: %w", err)
		}

		fmt.Println("Migration 49: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 49 rollback: dropping diff details from app releases...")
		_, err := db.ExecContext(ctx, `
			ALTER TABLE app_releases
				DROP COLUMN IF EXISTS change_details,
				DROP COLUMN IF EXISTS diff_preview;
		`)
		return err
	})
}
