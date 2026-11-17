package migrations

import (
	"context"

	"github.com/uptrace/bun"
)

// Users get a display name and a profile picture of their own. Both are
// optional: an empty display name falls back to the username, an empty
// avatar to the initials.
func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `
 ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
 ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';
 `)
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `ALTER TABLE users DROP COLUMN IF EXISTS avatar_url; ALTER TABLE users DROP COLUMN IF EXISTS display_name;`)
		return err
	})
}
