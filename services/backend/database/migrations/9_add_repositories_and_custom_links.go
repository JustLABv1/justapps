package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Adding repositories and custom_links columns to apps table...")

		_, err := db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS repositories JSONB DEFAULT '[]'::jsonb")
		if err != nil {
			return err
		}

		_, err = db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS custom_links JSONB DEFAULT '[]'::jsonb")
		if err != nil {
			return err
		}

		_, err = db.ExecContext(ctx, `
			UPDATE apps
			SET repositories = jsonb_build_array(jsonb_build_object('label', 'Repository', 'url', repo_url))
			WHERE repo_url IS NOT NULL AND repo_url != '' AND (repositories IS NULL OR jsonb_array_length(repositories) = 0);
		`)
		if err != nil {
			fmt.Printf("Warning: Failed to migrate repo_url to repositories: %v\n", err)
		}

		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS repositories")
		if err != nil {
			return err
		}

		_, err = db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS custom_links")
		return err
	})
}
