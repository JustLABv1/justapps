package migrations

import (
	"context"
	"fmt"
	"strings"

	"github.com/uptrace/bun"
)

type legacyDetailField struct {
	key    string
	column string
}

var legacyDetailFields = []legacyDetailField{
	{key: "focus", column: "focus"},
	{key: "app_type", column: "app_type"},
	{key: "use_case", column: "use_case"},
	{key: "visualization", column: "visualization"},
	{key: "deployment", column: "deployment"},
	{key: "infrastructure", column: "infrastructure"},
	{key: "database", column: "database"},
	{key: "transferability", column: "transferability"},
	{key: "contact_person", column: "contact_person"},
	{key: "authority", column: "authority"},
	{key: "additional_info", column: "additional_info"},
}

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 20: migrating detail fields to custom_fields JSONB...")

		// 1. Add the new custom_fields column
		_, err := db.ExecContext(ctx, `ALTER TABLE apps ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '[]'`)
		if err != nil {
			return fmt.Errorf("add custom_fields column: %w", err)
		}

		existingFields := make([]legacyDetailField, 0, len(legacyDetailFields))
		for _, field := range legacyDetailFields {
			exists, err := columnExists(ctx, db, "apps", field.column)
			if err != nil {
				return fmt.Errorf("check column %s: %w", field.column, err)
			}
			if exists {
				existingFields = append(existingFields, field)
			}
		}

		// 2. Migrate existing values from the old columns into the JSONB array.
		//    Fresh installs already have custom_fields in the base schema, so there
		//    may be no legacy columns left to read from.
		if len(existingFields) > 0 {
			entries := make([]string, 0, len(existingFields))
			for _, field := range existingFields {
				entries = append(entries, fmt.Sprintf(
					"SELECT jsonb_build_object('key', '%s', 'value', %s) AS entry WHERE %s <> ''",
					field.key,
					field.column,
					field.column,
				))
			}

			query := fmt.Sprintf(`
				UPDATE apps SET custom_fields = COALESCE((
					SELECT jsonb_agg(entry)
					FROM (
						%s
					) sub
				), '[]')
			`, strings.Join(entries, " UNION ALL\n\t\t\t\t\t"))

			_, err = db.ExecContext(ctx, query)
			if err != nil {
				return fmt.Errorf("migrate data to custom_fields: %w", err)
			}
		}

		// 3. Drop the old columns
		for _, field := range legacyDetailFields {
			exists, err := columnExists(ctx, db, "apps", field.column)
			if err != nil {
				return fmt.Errorf("check column %s: %w", field.column, err)
			}
			if exists {
				_, err = db.ExecContext(ctx, fmt.Sprintf(`ALTER TABLE apps DROP COLUMN %s`, field.column))
				if err != nil {
					return fmt.Errorf("drop column %s: %w", field.column, err)
				}
			}
		}

		fmt.Println("Migration 20: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 20 rollback: restoring legacy detail columns...")

		cols := map[string]string{
			"focus":           "TEXT NOT NULL DEFAULT ''",
			"app_type":        "TEXT NOT NULL DEFAULT ''",
			"use_case":        "TEXT NOT NULL DEFAULT ''",
			"visualization":   "TEXT NOT NULL DEFAULT ''",
			"deployment":      "TEXT NOT NULL DEFAULT ''",
			"infrastructure":  "TEXT NOT NULL DEFAULT ''",
			"database":        "TEXT NOT NULL DEFAULT ''",
			"additional_info": "TEXT NOT NULL DEFAULT ''",
			"transferability": "TEXT NOT NULL DEFAULT ''",
			"contact_person":  "TEXT NOT NULL DEFAULT ''",
			"authority":       "TEXT NOT NULL DEFAULT ''",
		}

		for col, def := range cols {
			_, err := db.ExecContext(ctx, fmt.Sprintf(`ALTER TABLE apps ADD COLUMN IF NOT EXISTS %s %s`, col, def))
			if err != nil {
				return fmt.Errorf("re-add column %s: %w", col, err)
			}
		}

		// Restore values from custom_fields JSONB back to columns
		_, err := db.ExecContext(ctx, `
			UPDATE apps a SET
				focus          = COALESCE((SELECT f->>'value' FROM jsonb_array_elements(a.custom_fields) f WHERE f->>'key' = 'focus'          LIMIT 1), ''),
				app_type       = COALESCE((SELECT f->>'value' FROM jsonb_array_elements(a.custom_fields) f WHERE f->>'key' = 'app_type'       LIMIT 1), ''),
				use_case       = COALESCE((SELECT f->>'value' FROM jsonb_array_elements(a.custom_fields) f WHERE f->>'key' = 'use_case'       LIMIT 1), ''),
				visualization  = COALESCE((SELECT f->>'value' FROM jsonb_array_elements(a.custom_fields) f WHERE f->>'key' = 'visualization'  LIMIT 1), ''),
				deployment     = COALESCE((SELECT f->>'value' FROM jsonb_array_elements(a.custom_fields) f WHERE f->>'key' = 'deployment'     LIMIT 1), ''),
				infrastructure = COALESCE((SELECT f->>'value' FROM jsonb_array_elements(a.custom_fields) f WHERE f->>'key' = 'infrastructure' LIMIT 1), ''),
				database       = COALESCE((SELECT f->>'value' FROM jsonb_array_elements(a.custom_fields) f WHERE f->>'key' = 'database'       LIMIT 1), ''),
				additional_info = COALESCE((SELECT f->>'value' FROM jsonb_array_elements(a.custom_fields) f WHERE f->>'key' = 'additional_info' LIMIT 1), ''),
				transferability = COALESCE((SELECT f->>'value' FROM jsonb_array_elements(a.custom_fields) f WHERE f->>'key' = 'transferability' LIMIT 1), ''),
				contact_person = COALESCE((SELECT f->>'value' FROM jsonb_array_elements(a.custom_fields) f WHERE f->>'key' = 'contact_person' LIMIT 1), ''),
				authority      = COALESCE((SELECT f->>'value' FROM jsonb_array_elements(a.custom_fields) f WHERE f->>'key' = 'authority'      LIMIT 1), '')
		`)
		if err != nil {
			return fmt.Errorf("restore values from custom_fields: %w", err)
		}

		_, err = db.ExecContext(ctx, `ALTER TABLE apps DROP COLUMN IF EXISTS custom_fields`)
		if err != nil {
			return fmt.Errorf("drop custom_fields: %w", err)
		}

		fmt.Println("Migration 20 rollback: done.")
		return nil
	})
}
