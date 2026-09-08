package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 52: creating FAQ inbox table...")

		_, err := db.ExecContext(ctx, `
			CREATE TABLE IF NOT EXISTS user_faq_inbox_items (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				question_id UUID NOT NULL REFERENCES faq_questions(id) ON DELETE CASCADE,
				app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
				seen_at TIMESTAMPTZ NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
			);

			CREATE UNIQUE INDEX IF NOT EXISTS idx_user_faq_inbox_unique
				ON user_faq_inbox_items (user_id, question_id);

			CREATE INDEX IF NOT EXISTS idx_user_faq_inbox_user_seen_created
				ON user_faq_inbox_items (user_id, seen_at, created_at DESC);

			CREATE INDEX IF NOT EXISTS idx_user_faq_inbox_app
				ON user_faq_inbox_items (user_id, app_id, seen_at);

		`)
		if err != nil {
			return fmt.Errorf("create FAQ inbox schema: %w", err)
		}

		fmt.Println("Migration 52: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 52 rollback: dropping FAQ inbox table...")
		_, err := db.ExecContext(ctx, `DROP TABLE IF EXISTS user_faq_inbox_items;`)
		return err
	})
}
