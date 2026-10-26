package migrations

import (
	"context"
	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `ALTER TABLE faq_answers ADD COLUMN reply_to_answer_id UUID REFERENCES faq_answers(id) ON DELETE SET NULL;
ALTER TABLE global_faq_answers ADD COLUMN reply_to_answer_id UUID REFERENCES global_faq_answers(id) ON DELETE SET NULL;`)
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `ALTER TABLE faq_answers DROP COLUMN reply_to_answer_id;
ALTER TABLE global_faq_answers DROP COLUMN reply_to_answer_id;`)
		return err
	})
}
