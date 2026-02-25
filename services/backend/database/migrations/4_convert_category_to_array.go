package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Converting category to categories array...")

		// 1. Add new array column
		_, err := db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS categories TEXT[]")
		if err != nil {
			return err
		}

		// 2. Migrate data from old column if it exists
		// We check if the old column exists first to avoid errors on fresh installs where 0_create_tables already uses the new struct
		_, err = db.ExecContext(ctx, `
			DO $$ 
			BEGIN 
				IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='apps' AND column_name='category') THEN
					UPDATE apps SET categories = ARRAY[category] WHERE categories IS NULL;
				END IF;
			END $$;
		`)
		if err != nil {
			return err
		}

		// 3. Drop old column if it exists
		_, err = db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS category")
		if err != nil {
			return err
		}

		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		// Rollback: Add category back and copy first element from categories
		_, err := db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS category TEXT")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "UPDATE apps SET category = categories[1]")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS categories")
		if err != nil {
			return err
		}
		return nil
	})
}
