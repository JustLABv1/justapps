package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Adding reuse fields to apps table...")

		_, err := db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS is_reuse BOOLEAN NOT NULL DEFAULT false")
		if err != nil {
			return err
		}

		_, err = db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS reuse_requirements TEXT")
		if err != nil {
			return err
		}

		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS is_reuse")
		if err != nil {
			return err
		}

		_, err = db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS reuse_requirements")
		if err != nil {
			return err
		}

		return nil
	})
}
