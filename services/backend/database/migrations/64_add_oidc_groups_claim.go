package migrations

import (
	"context"
	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `ALTER TABLE oidc_provider_settings ADD COLUMN IF NOT EXISTS groups_claim TEXT NOT NULL DEFAULT 'groups'`)
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `ALTER TABLE oidc_provider_settings DROP COLUMN IF EXISTS groups_claim`)
		return err
	})
}
