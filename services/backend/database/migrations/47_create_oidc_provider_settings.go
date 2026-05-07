package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 47: creating OIDC provider settings table...")

		statements := []string{
			`CREATE TABLE IF NOT EXISTS oidc_provider_settings (
				provider_key TEXT PRIMARY KEY,
				label TEXT NOT NULL DEFAULT '',
				issuer TEXT NOT NULL DEFAULT '',
				client_id TEXT NOT NULL DEFAULT '',
				admin_group TEXT NOT NULL DEFAULT 'admin',
				encrypted_secret TEXT NOT NULL DEFAULT '',
				secret_nonce TEXT NOT NULL DEFAULT '',
				secret_key_version TEXT NOT NULL DEFAULT 'v1',
				secret_configured BOOLEAN NOT NULL DEFAULT false,
				enabled BOOLEAN NOT NULL DEFAULT true,
				insecure BOOLEAN NOT NULL DEFAULT false,
				disable_local_auth BOOLEAN NOT NULL DEFAULT false,
				scopes JSONB NOT NULL DEFAULT '["openid","profile","email"]'::jsonb,
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`,
			`CREATE INDEX IF NOT EXISTS oidc_provider_settings_enabled_idx ON oidc_provider_settings (enabled)`,
		}

		for _, statement := range statements {
			if _, err := db.ExecContext(ctx, statement); err != nil {
				return fmt.Errorf("migration 47: %w", err)
			}
		}

		fmt.Println("Migration 47: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 47 rollback: dropping OIDC provider settings table...")
		_, err := db.ExecContext(ctx, `DROP TABLE IF EXISTS oidc_provider_settings`)
		return err
	})
}
