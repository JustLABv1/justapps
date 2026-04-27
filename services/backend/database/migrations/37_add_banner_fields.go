package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Adding banner fields to apps table and migrating known_issue data...")

		stmts := []string{
			"ALTER TABLE apps ADD COLUMN IF NOT EXISTS banner_text TEXT NOT NULL DEFAULT ''",
			"ALTER TABLE apps ADD COLUMN IF NOT EXISTS banner_type TEXT NOT NULL DEFAULT ''",
			"ALTER TABLE apps ADD COLUMN IF NOT EXISTS banner_color TEXT NOT NULL DEFAULT ''",
			"UPDATE apps SET banner_text = known_issue, banner_type = 'warning' WHERE known_issue IS NOT NULL AND known_issue != ''",
			"ALTER TABLE apps DROP COLUMN IF EXISTS known_issue",
		}

		for _, stmt := range stmts {
			if _, err := db.ExecContext(ctx, stmt); err != nil {
				return err
			}
		}

		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		stmts := []string{
			"ALTER TABLE apps ADD COLUMN IF NOT EXISTS known_issue TEXT",
			"UPDATE apps SET known_issue = banner_text WHERE banner_type = 'warning' AND banner_text != ''",
			"ALTER TABLE apps DROP COLUMN IF EXISTS banner_text",
			"ALTER TABLE apps DROP COLUMN IF EXISTS banner_type",
			"ALTER TABLE apps DROP COLUMN IF EXISTS banner_color",
		}

		for _, stmt := range stmts {
			if _, err := db.ExecContext(ctx, stmt); err != nil {
				return err
			}
		}

		return nil
	})
}
