package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Adding extended information fields to apps table...")

		columns := []string{
			"focus",
			"app_type",
			"use_case",
			"visualization",
			"deployment",
			"infrastructure",
			"database",
			"additional_info",
			"status",
			"transferability",
			"contact_person",
		}

		for _, col := range columns {
			_, err := db.ExecContext(ctx, fmt.Sprintf("ALTER TABLE apps ADD COLUMN IF NOT EXISTS %s TEXT", col))
			if err != nil {
				return err
			}
		}

		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		columns := []string{
			"focus",
			"app_type",
			"use_case",
			"visualization",
			"deployment",
			"infrastructure",
			"database",
			"additional_info",
			"status",
			"transferability",
			"contact_person",
		}

		for _, col := range columns {
			_, err := db.ExecContext(ctx, fmt.Sprintf("ALTER TABLE apps DROP COLUMN IF EXISTS %s", col))
			if err != nil {
				return err
			}
		}
		return nil
	})
}
