package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 27: adding last_login_at column to users...")

		_, err := db.ExecContext(ctx, `
			ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
		`)
		if err != nil {
			return fmt.Errorf("add last_login_at to users: %w", err)
		}

		fmt.Println("Migration 27: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 27 rollback: dropping last_login_at column from users...")
		_, err := db.ExecContext(ctx, `
			ALTER TABLE users DROP COLUMN IF EXISTS last_login_at;
		`)
		return err
	})
}
