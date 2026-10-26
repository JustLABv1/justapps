package migrations

import (
	"context"
	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `CREATE INDEX IF NOT EXISTS idx_faq_answers_reply_to ON faq_answers(reply_to_answer_id);
CREATE INDEX IF NOT EXISTS idx_global_faq_answers_reply_to ON global_faq_answers(reply_to_answer_id);`)
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `DROP INDEX IF EXISTS idx_faq_answers_reply_to;
DROP INDEX IF EXISTS idx_global_faq_answers_reply_to;`)
		return err
	})
}
