package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 48: creating app release update tables...")

		_, err := db.ExecContext(ctx, `
			CREATE TABLE IF NOT EXISTS app_releases (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
				version TEXT NOT NULL DEFAULT '',
				release_type TEXT NOT NULL DEFAULT 'patch',
				source TEXT NOT NULL DEFAULT 'git_sync',
				title TEXT NOT NULL DEFAULT '',
				summary TEXT NOT NULL DEFAULT '',
				changed_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
				fingerprint TEXT NOT NULL DEFAULT '',
				published_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
			);

			CREATE INDEX IF NOT EXISTS idx_app_releases_app_published_at
				ON app_releases (app_id, published_at DESC);

			CREATE UNIQUE INDEX IF NOT EXISTS idx_app_releases_app_fingerprint
				ON app_releases (app_id, fingerprint);

			CREATE TABLE IF NOT EXISTS user_update_preferences (
				user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
				notify_favorited_apps BOOLEAN NOT NULL DEFAULT TRUE,
				notify_recently_viewed_apps BOOLEAN NOT NULL DEFAULT TRUE,
				notify_owned_managed_apps BOOLEAN NOT NULL DEFAULT TRUE,
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
			);

			CREATE TABLE IF NOT EXISTS user_recently_viewed_apps (
				user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
				viewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (user_id, app_id)
			);

			CREATE INDEX IF NOT EXISTS idx_user_recently_viewed_apps_user_viewed_at
				ON user_recently_viewed_apps (user_id, viewed_at DESC);

			CREATE TABLE IF NOT EXISTS user_release_inbox_items (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				release_id UUID NOT NULL REFERENCES app_releases(id) ON DELETE CASCADE,
				app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
				reason TEXT NOT NULL DEFAULT '',
				seen_at TIMESTAMPTZ NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
			);

			CREATE UNIQUE INDEX IF NOT EXISTS idx_user_release_inbox_unique
				ON user_release_inbox_items (user_id, release_id);

			CREATE INDEX IF NOT EXISTS idx_user_release_inbox_user_seen_created
				ON user_release_inbox_items (user_id, seen_at, created_at DESC);

			CREATE INDEX IF NOT EXISTS idx_user_release_inbox_app
				ON user_release_inbox_items (user_id, app_id, seen_at);
		`)
		if err != nil {
			return fmt.Errorf("create app release update tables: %w", err)
		}

		fmt.Println("Migration 48: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 48 rollback: dropping app release update tables...")
		_, err := db.ExecContext(ctx, `
			DROP TABLE IF EXISTS user_release_inbox_items;
			DROP TABLE IF EXISTS user_recently_viewed_apps;
			DROP TABLE IF EXISTS user_update_preferences;
			DROP TABLE IF EXISTS app_releases;
		`)
		return err
	})
}
