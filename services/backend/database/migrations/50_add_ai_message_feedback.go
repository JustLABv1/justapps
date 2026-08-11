package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 50: adding AI message feedback...")

		if _, err := db.ExecContext(ctx, `
			ALTER TABLE ai_messages
				ADD COLUMN IF NOT EXISTS feedback TEXT NOT NULL DEFAULT '';
		`); err != nil {
			return fmt.Errorf("add AI message feedback: %w", err)
		}

		fmt.Println("Migration 50: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 50 rollback: dropping AI message feedback...")
		_, err := db.ExecContext(ctx, `ALTER TABLE ai_messages DROP COLUMN IF EXISTS feedback`)
		return err
	})
}
