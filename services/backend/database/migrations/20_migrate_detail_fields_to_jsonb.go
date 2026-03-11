package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 20: migrating detail fields to custom_fields JSONB...")

		// 1. Add the new custom_fields column
		_, err := db.ExecContext(ctx, `ALTER TABLE apps ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '[]'`)
		if err != nil {
			return fmt.Errorf("add custom_fields column: %w", err)
		}

		// 2. Migrate existing values from the old columns into the JSONB array.
		//    Only include entries where the old value was non-empty.
		_, err = db.ExecContext(ctx, `
			UPDATE apps SET custom_fields = COALESCE((
				SELECT jsonb_agg(entry)
				FROM (
					SELECT jsonb_build_object('key', 'focus',          'value', focus)           AS entry WHERE focus          <> '' UNION ALL
					SELECT jsonb_build_object('key', 'app_type',       'value', app_type)        AS entry WHERE app_type       <> '' UNION ALL
					SELECT jsonb_build_object('key', 'use_case',       'value', use_case)        AS entry WHERE use_case       <> '' UNION ALL
					SELECT jsonb_build_object('key', 'visualization',  'value', visualization)   AS entry WHERE visualization  <> '' UNION ALL
					SELECT jsonb_build_object('key', 'deployment',     'value', deployment)      AS entry WHERE deployment     <> '' UNION ALL
					SELECT jsonb_build_object('key', 'infrastructure', 'value', infrastructure)  AS entry WHERE infrastructure <> '' UNION ALL
					SELECT jsonb_build_object('key', 'database',       'value', database)        AS entry WHERE database       <> '' UNION ALL
					SELECT jsonb_build_object('key', 'transferability','value', transferability) AS entry WHERE transferability <> '' UNION ALL
					SELECT jsonb_build_object('key', 'contact_person', 'value', contact_person)  AS entry WHERE contact_person <> '' UNION ALL
					SELECT jsonb_build_object('key', 'authority',      'value', authority)       AS entry WHERE authority      <> '' UNION ALL
					SELECT jsonb_build_object('key', 'additional_info','value', additional_info) AS entry WHERE additional_info <> ''
				) sub
			), '[]')
		`)
		if err != nil {
			return fmt.Errorf("migrate data to custom_fields: %w", err)
		}

		// 3. Drop the old columns
		oldColumns := []string{
			"focus", "app_type", "use_case", "visualization", "deployment",
			"infrastructure", "database", "additional_info",
			"transferability", "contact_person", "authority",
		}
		for _, col := range oldColumns {
			exists, err := columnExists(ctx, db, "apps", col)
			if err != nil {
				return fmt.Errorf("check column %s: %w", col, err)
			}
			if exists {
				_, err = db.ExecContext(ctx, fmt.Sprintf(`ALTER TABLE apps DROP COLUMN %s`, col))
				if err != nil {
					return fmt.Errorf("drop column %s: %w", col, err)
				}
			}
		}

		fmt.Println("Migration 20: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 20 rollback: restoring legacy detail columns...")

		cols := map[string]string{
			"focus":          "TEXT NOT NULL DEFAULT ''",
			"app_type":       "TEXT NOT NULL DEFAULT ''",
			"use_case":       "TEXT NOT NULL DEFAULT ''",
			"visualization":  "TEXT NOT NULL DEFAULT ''",
			"deployment":     "TEXT NOT NULL DEFAULT ''",
			"infrastructure": "TEXT NOT NULL DEFAULT ''",
			"database":       "TEXT NOT NULL DEFAULT ''",
			"additional_info": "TEXT NOT NULL DEFAULT ''",
			"transferability": "TEXT NOT NULL DEFAULT ''",
			"contact_person": "TEXT NOT NULL DEFAULT ''",
			"authority":      "TEXT NOT NULL DEFAULT ''",
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
