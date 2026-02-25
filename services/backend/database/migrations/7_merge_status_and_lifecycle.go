package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Merging lifecycle into status and dropping lifecycle column...")

		// Move data from lifecycle to status if lifecycle is not POC (default)
		// and status is empty or 'Produktiv' (placeholder)
		_, err := db.ExecContext(ctx, `
			UPDATE apps 
			SET status = lifecycle 
			WHERE lifecycle IS NOT NULL AND lifecycle != 'POC' AND (status IS NULL OR status = '' OR status = 'Produktiv');
		`)
		if err != nil {
			fmt.Printf("Warning: Failed to migrate lifecycle to status: %v\n", err)
		}

		// Drop lifecycle column
		_, err = db.ExecContext(ctx, "ALTER TABLE apps DROP COLUMN IF EXISTS lifecycle")
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		// Rollback: re-add lifecycle column
		_, err := db.ExecContext(ctx, "ALTER TABLE apps ADD COLUMN IF NOT EXISTS lifecycle TEXT DEFAULT 'POC'")
		return err
	})
}
