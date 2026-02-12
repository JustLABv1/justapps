package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Adding tags, collections, is_featured and rating fields to apps table...")

		_, err := db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS tags TEXT[]")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS collections TEXT[]")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS rating_avg DOUBLE PRECISION DEFAULT 0")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0")
		if err != nil {
			return err
		}

		fmt.Println("Creating ratings table...")
		_, err = db.ExecContext(ctx, `
			CREATE TABLE IF NOT EXISTS ratings (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				app_id TEXT NOT NULL,
				user_id TEXT NOT NULL,
				username TEXT,
				rating INTEGER NOT NULL,
				comment TEXT,
				created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
			)
		`)
		if err != nil {
			return err
		}

		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, "DROP TABLE IF EXISTS ratings")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS tags")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS collections")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS is_featured")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS rating_avg")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS rating_count")
		if err != nil {
			return err
		}
		return nil
	})
}
