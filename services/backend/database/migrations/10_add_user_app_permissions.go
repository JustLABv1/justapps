package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Adding permissions and ownership fields to users and apps tables...")

		// Users table updates
		_, err := db.ExecContext(ctx, "ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_type TEXT DEFAULT 'local'")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_submit_apps BOOLEAN DEFAULT true")
		if err != nil {
			return err
		}

		// Apps table updates
		_, err = db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS owner_id UUID")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false")
		if err != nil {
			return err
		}

		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, "ALTER TABLE users DROP COLUMN IF EXISTS auth_type")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE users DROP COLUMN IF EXISTS can_submit_apps")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS owner_id")
		if err != nil {
			return err
		}
		_, err = db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS is_locked")
		if err != nil {
			return err
		}
		return nil
	})
}
