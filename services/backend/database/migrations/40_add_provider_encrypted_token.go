package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 40: adding encrypted token fields for repository providers...")

		statements := []string{
			`ALTER TABLE gitlab_provider_settings ADD COLUMN IF NOT EXISTS encrypted_token TEXT NOT NULL DEFAULT ''`,
			`ALTER TABLE gitlab_provider_settings ADD COLUMN IF NOT EXISTS token_nonce TEXT NOT NULL DEFAULT ''`,
			`ALTER TABLE gitlab_provider_settings ADD COLUMN IF NOT EXISTS token_key_version TEXT NOT NULL DEFAULT 'v1'`,
			`ALTER TABLE gitlab_provider_settings ADD COLUMN IF NOT EXISTS token_configured BOOLEAN NOT NULL DEFAULT false`,
			`UPDATE gitlab_provider_settings SET token_configured = (encrypted_token <> '' AND token_nonce <> '')`,
		}
		for _, statement := range statements {
			if _, err := db.ExecContext(ctx, statement); err != nil {
				return fmt.Errorf("migration 40: %w", err)
			}
		}

		fmt.Println("Migration 40: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 40 rollback: dropping encrypted token fields...")
		statements := []string{
			`ALTER TABLE gitlab_provider_settings DROP COLUMN IF EXISTS token_configured`,
			`ALTER TABLE gitlab_provider_settings DROP COLUMN IF EXISTS token_key_version`,
			`ALTER TABLE gitlab_provider_settings DROP COLUMN IF EXISTS token_nonce`,
			`ALTER TABLE gitlab_provider_settings DROP COLUMN IF EXISTS encrypted_token`,
		}
		for _, statement := range statements {
			if _, err := db.ExecContext(ctx, statement); err != nil {
				return err
			}
		}
		return nil
	})
}
