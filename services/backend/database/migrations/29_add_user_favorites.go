package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 29: creating user_favorites table...")

		_, err := db.ExecContext(ctx, `
			CREATE TABLE IF NOT EXISTS user_favorites (
				user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				app_id  TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				PRIMARY KEY (user_id, app_id)
			);
		`)
		if err != nil {
			return fmt.Errorf("create user_favorites: %w", err)
		}

		fmt.Println("Migration 29: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 29 rollback: dropping user_favorites table...")
		_, err := db.ExecContext(ctx, `DROP TABLE IF EXISTS user_favorites;`)
		return err
	})
}
