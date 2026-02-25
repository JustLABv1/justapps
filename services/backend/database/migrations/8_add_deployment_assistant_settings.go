package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Adding deployment assistant setting fields to apps table...")

		_, err := db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS has_deployment_assistant BOOLEAN NOT NULL DEFAULT TRUE")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS show_docker BOOLEAN NOT NULL DEFAULT TRUE")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS show_compose BOOLEAN NOT NULL DEFAULT TRUE")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS show_helm BOOLEAN NOT NULL DEFAULT TRUE")
		if err != nil {
			return err
		}

		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS has_deployment_assistant")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS show_docker")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS show_compose")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS show_helm")
		if err != nil {
			return err
		}

		return nil
	})
}
