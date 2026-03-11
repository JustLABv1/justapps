package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

// defaultDetailFields is the default field schema seeded on first migration.
// Keys match what migration 20 used when converting old columns.
const defaultDetailFields = `[
	{"key": "focus",          "label": "Themenfeld",      "icon": "Layers"},
	{"key": "app_type",       "label": "Anwendungstyp",   "icon": "Globe"},
	{"key": "use_case",       "label": "Anwendungsfall",  "icon": "FileCode"},
	{"key": "visualization",  "label": "Visualisierung",  "icon": "Eye"},
	{"key": "deployment",     "label": "Deployment",      "icon": "Server"},
	{"key": "infrastructure", "label": "Infrastruktur",   "icon": "LayoutDashboard"},
	{"key": "database",       "label": "Datenbasis",      "icon": "Database"},
	{"key": "transferability","label": "Übertragbarkeit", "icon": "ArrowRightLeft"},
	{"key": "authority",      "label": "Behörde",         "icon": "Globe"},
	{"key": "contact_person", "label": "Ansprechpartner", "icon": "User"},
	{"key": "additional_info","label": "Sonstiges",       "icon": "ClipboardList"}
]`

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 21: adding detail_fields to platform_settings...")

		_, err := db.ExecContext(ctx, `ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS detail_fields JSONB NOT NULL DEFAULT '[]'`)
		if err != nil {
			return fmt.Errorf("add detail_fields column: %w", err)
		}

		// Seed default schema for the existing "default" row (inline JSON to avoid driver casting issues)
		_, err = db.ExecContext(ctx, fmt.Sprintf(
			`UPDATE platform_settings SET detail_fields = '%s'::jsonb WHERE id = 'default' AND detail_fields = '[]'`,
			defaultDetailFields,
		))
		if err != nil {
			return fmt.Errorf("seed default detail_fields: %w", err)
		}

		fmt.Println("Migration 21: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 21 rollback: dropping detail_fields from platform_settings...")
		_, err := db.ExecContext(ctx, `ALTER TABLE platform_settings DROP COLUMN IF EXISTS detail_fields`)
		return err
	})
}
