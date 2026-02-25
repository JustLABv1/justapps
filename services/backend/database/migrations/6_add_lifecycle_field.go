package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Adding lifecycle column to apps table...")

		_, err := db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS lifecycle TEXT DEFAULT 'POC'")
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS lifecycle")
		return err
	})
}
