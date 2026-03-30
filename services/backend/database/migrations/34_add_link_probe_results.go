package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 34: adding link_probe_results table and link_probe_status to apps...")

		_, err := db.ExecContext(ctx, `
			CREATE TABLE IF NOT EXISTS link_probe_results (
				id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				app_id      TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
				url         TEXT NOT NULL,
				status_code INT NOT NULL DEFAULT 0,
				reachable   BOOLEAN NOT NULL DEFAULT false,
				probed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
			)
		`)
		if err != nil {
			return fmt.Errorf("create link_probe_results: %w", err)
		}

		_, err = db.ExecContext(ctx, `CREATE INDEX IF NOT EXISTS idx_link_probe_results_app_id ON link_probe_results(app_id)`)
		if err != nil {
			return fmt.Errorf("create index on link_probe_results: %w", err)
		}

		_, err = db.ExecContext(ctx, `
			ALTER TABLE apps
				ADD COLUMN IF NOT EXISTS link_probe_status TEXT NOT NULL DEFAULT 'unknown'
		`)
		if err != nil {
			return fmt.Errorf("add link_probe_status to apps: %w", err)
		}

		fmt.Println("Migration 34: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 34 rollback: dropping link_probe_results and link_probe_status...")
		_, err := db.ExecContext(ctx, `DROP TABLE IF EXISTS link_probe_results`)
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, `ALTER TABLE apps DROP COLUMN IF EXISTS link_probe_status`)
		return err
	})
}
