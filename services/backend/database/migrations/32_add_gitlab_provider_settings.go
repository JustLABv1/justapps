package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 32: adding gitlab provider settings...")

		_, err := db.ExecContext(ctx, `
			CREATE TABLE IF NOT EXISTS gitlab_provider_settings (
				provider_key TEXT PRIMARY KEY,
				label TEXT,
				base_url TEXT,
				namespace_allowlist JSONB NOT NULL DEFAULT '[]'::jsonb,
				enabled BOOLEAN NOT NULL DEFAULT true,
				auto_sync_enabled BOOLEAN NOT NULL DEFAULT true,
				sync_interval_minutes INTEGER NOT NULL DEFAULT 15,
				default_readme_path TEXT,
				default_helm_values_path TEXT,
				default_compose_file_path TEXT,
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
			)
		`)
		if err != nil {
			return fmt.Errorf("create gitlab_provider_settings: %w", err)
		}

		fmt.Println("Migration 32: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 32 rollback: dropping gitlab provider settings...")
		_, err := db.ExecContext(ctx, `DROP TABLE IF EXISTS gitlab_provider_settings`)
		return err
	})
}
