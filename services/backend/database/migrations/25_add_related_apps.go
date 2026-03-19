package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 25: creating app_relations, app_groups, app_group_members tables...")

		_, err := db.ExecContext(ctx, `
			CREATE TABLE IF NOT EXISTS app_relations (
				app_id        TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
				related_app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
				PRIMARY KEY (app_id, related_app_id),
				CHECK (app_id <> related_app_id)
			);

			CREATE TABLE IF NOT EXISTS app_groups (
				id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				name        TEXT NOT NULL,
				description TEXT NOT NULL DEFAULT ''
			);

			CREATE TABLE IF NOT EXISTS app_group_members (
				app_group_id UUID NOT NULL REFERENCES app_groups(id) ON DELETE CASCADE,
				app_id       TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
				PRIMARY KEY (app_group_id, app_id)
			);
		`)
		if err != nil {
			return fmt.Errorf("create related apps tables: %w", err)
		}

		fmt.Println("Migration 25: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 25 rollback: dropping related apps tables...")
		_, err := db.ExecContext(ctx, `
			DROP TABLE IF EXISTS app_group_members;
			DROP TABLE IF EXISTS app_groups;
			DROP TABLE IF EXISTS app_relations;
		`)
		return err
	})
}
