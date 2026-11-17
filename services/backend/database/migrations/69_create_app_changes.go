package migrations

import (
	"context"

	"github.com/uptrace/bun"
)

// What changed when an app was saved in the editor, so the weekly summary can
// say what is new rather than only that something changed. One row per save
// that touched something a reader would care about.
func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `
 CREATE TABLE IF NOT EXISTS app_changes (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
   user_id UUID,
   fields TEXT[] NOT NULL DEFAULT '{}',
   version_before TEXT NOT NULL DEFAULT '',
   version_after TEXT NOT NULL DEFAULT '',
   note TEXT NOT NULL DEFAULT '',
   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
 );
 CREATE INDEX IF NOT EXISTS app_changes_app_created_idx ON app_changes (app_id, created_at DESC);
 CREATE INDEX IF NOT EXISTS app_changes_created_idx ON app_changes (created_at);
 `)
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `DROP TABLE IF EXISTS app_changes;`)
		return err
	})
}
