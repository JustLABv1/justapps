package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 59: adding app visibility...")
		_, err := db.ExecContext(ctx, `ALTER TABLE apps ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false`)
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 59 rollback: dropping app visibility...")
		_, err := db.ExecContext(ctx, `ALTER TABLE apps DROP COLUMN IF EXISTS is_hidden`)
		return err
	})
}
