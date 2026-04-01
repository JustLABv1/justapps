package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 31: enabling link probing by default...")

		_, err := db.ExecContext(ctx, `
			ALTER TABLE platform_settings
				ALTER COLUMN enable_link_probing SET DEFAULT true
		`)
		if err != nil {
			return fmt.Errorf("set default enable_link_probing: %w", err)
		}

		_, err = db.ExecContext(ctx, `
			UPDATE platform_settings
			SET enable_link_probing = true
			WHERE id = 'default' AND enable_link_probing = false
		`)
		if err != nil {
			return fmt.Errorf("enable link probing for default settings row: %w", err)
		}

		fmt.Println("Migration 31: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 31 rollback: restoring link probing default...")

		_, err := db.ExecContext(ctx, `
			ALTER TABLE platform_settings
				ALTER COLUMN enable_link_probing SET DEFAULT false
		`)
		if err != nil {
			return fmt.Errorf("restore default enable_link_probing: %w", err)
		}

		_, err = db.ExecContext(ctx, `
			UPDATE platform_settings
			SET enable_link_probing = false
			WHERE id = 'default' AND enable_link_probing = true
		`)
		if err != nil {
			return fmt.Errorf("restore default settings link probing flag: %w", err)
		}

		return nil
	})
}
