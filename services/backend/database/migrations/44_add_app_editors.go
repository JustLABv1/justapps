package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 44: creating app_editors table...")

		_, err := db.ExecContext(ctx, `
			CREATE TABLE IF NOT EXISTS app_editors (
				app_id     TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
				user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				created_by UUID REFERENCES users(id) ON DELETE SET NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				PRIMARY KEY (app_id, user_id)
			);

			CREATE INDEX IF NOT EXISTS idx_app_editors_user_id ON app_editors(user_id);
			CREATE INDEX IF NOT EXISTS idx_app_editors_app_id ON app_editors(app_id);
		`)
		if err != nil {
			return fmt.Errorf("create app_editors table: %w", err)
		}

		fmt.Println("Migration 44: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 44 rollback: dropping app_editors table...")
		_, err := db.ExecContext(ctx, `DROP TABLE IF EXISTS app_editors;`)
		return err
	})
}
