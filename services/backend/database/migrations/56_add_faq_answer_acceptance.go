package migrations

import (
	"context"
	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `ALTER TABLE faq_answers ADD COLUMN IF NOT EXISTS accepted_by_author BOOLEAN NOT NULL DEFAULT FALSE;
   ALTER TABLE global_faq_answers ADD COLUMN IF NOT EXISTS accepted_by_author BOOLEAN NOT NULL DEFAULT FALSE;`)
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `ALTER TABLE faq_answers DROP COLUMN IF EXISTS accepted_by_author;
   ALTER TABLE global_faq_answers DROP COLUMN IF EXISTS accepted_by_author;`)
		return err
	})
}
