package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Adding deployment fields and updated_at to apps table...")

		_, err := db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS custom_docker_command TEXT")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS custom_compose_command TEXT")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS custom_helm_command TEXT")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS custom_docker_note TEXT")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS custom_compose_note TEXT")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS custom_helm_note TEXT")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP")
		if err != nil {
			return err
		}

		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS custom_docker_command")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS custom_compose_command")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS custom_helm_command")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS updated_at")
		if err != nil {
			return err
		}
		return nil
	})
}
