package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Adding live_demos column to apps table...")

		// Add live_demos column as jsonb
		_, err := db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS live_demos JSONB DEFAULT '[]'::jsonb")
		if err != nil {
			return err
		}

		// Optional: Migrate live_url to live_demos if it exists and live_demos is empty
		_, err = db.ExecContext(ctx, `
			UPDATE apps 
			SET live_demos = jsonb_build_array(jsonb_build_object('label', 'Live Demo', 'url', live_url))
			WHERE live_url IS NOT NULL AND live_url != '' AND (live_demos IS NULL OR jsonb_array_length(live_demos) = 0);
		`)
		if err != nil {
			fmt.Printf("Warning: Failed to migrate live_url to live_demos: %v\n", err)
			// Continue anyway, it's just a migration helper
		}

		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		// Rollback: remove live_demos column
		_, err := db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS live_demos")
		return err
	})
}
