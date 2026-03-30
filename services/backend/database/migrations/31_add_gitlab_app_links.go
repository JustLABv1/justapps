package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 31: adding gitlab app links...")

		_, err := db.ExecContext(ctx, `
			CREATE TABLE IF NOT EXISTS gitlab_app_links (
				app_id TEXT PRIMARY KEY REFERENCES apps(id) ON DELETE CASCADE,
				provider_key TEXT NOT NULL,
				project_id BIGINT NOT NULL DEFAULT 0,
				project_path TEXT NOT NULL,
				project_web_url TEXT,
				branch TEXT,
				readme_path TEXT,
				helm_values_path TEXT,
				compose_file_path TEXT,
				last_sync_status TEXT NOT NULL DEFAULT 'never',
				last_sync_error TEXT,
				last_synced_at TIMESTAMPTZ,
				snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
			)
		`)
		if err != nil {
			return fmt.Errorf("create gitlab_app_links: %w", err)
		}

		_, err = db.ExecContext(ctx, `
			CREATE INDEX IF NOT EXISTS gitlab_app_links_provider_key_idx
			ON gitlab_app_links(provider_key)
		`)
		if err != nil {
			return fmt.Errorf("create gitlab_app_links provider index: %w", err)
		}

		fmt.Println("Migration 31: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 31 rollback: dropping gitlab app links...")
		_, err := db.ExecContext(ctx, `DROP TABLE IF EXISTS gitlab_app_links`)
		return err
	})
}
