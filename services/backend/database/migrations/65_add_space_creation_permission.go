package migrations

import (
	"context"
	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `ALTER TABLE users ADD COLUMN IF NOT EXISTS can_create_spaces BOOLEAN NOT NULL DEFAULT false`)
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `ALTER TABLE users DROP COLUMN IF EXISTS can_create_spaces`)
		return err
	})
}
