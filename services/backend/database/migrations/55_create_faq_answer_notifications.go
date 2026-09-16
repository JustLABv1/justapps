package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 55: creating FAQ answer notifications...")

		_, err := db.ExecContext(ctx, `
			CREATE TABLE IF NOT EXISTS user_faq_answer_notifications (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				app_id TEXT NULL REFERENCES apps(id) ON DELETE CASCADE,
				app_question_id UUID NULL REFERENCES faq_questions(id) ON DELETE CASCADE,
				app_answer_id UUID NULL REFERENCES faq_answers(id) ON DELETE CASCADE,
				global_question_id UUID NULL REFERENCES global_faq_questions(id) ON DELETE CASCADE,
				global_answer_id UUID NULL REFERENCES global_faq_answers(id) ON DELETE CASCADE,
				seen_at TIMESTAMPTZ NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				CONSTRAINT user_faq_answer_notification_scope CHECK (
					(app_question_id IS NOT NULL AND app_answer_id IS NOT NULL AND global_question_id IS NULL AND global_answer_id IS NULL AND app_id IS NOT NULL)
					OR
					(app_question_id IS NULL AND app_answer_id IS NULL AND global_question_id IS NOT NULL AND global_answer_id IS NOT NULL AND app_id IS NULL)
				)
			);

			CREATE UNIQUE INDEX IF NOT EXISTS idx_user_faq_answer_notification_app_unique
				ON user_faq_answer_notifications (user_id, app_answer_id)
				WHERE app_answer_id IS NOT NULL;

			CREATE UNIQUE INDEX IF NOT EXISTS idx_user_faq_answer_notification_global_unique
				ON user_faq_answer_notifications (user_id, global_answer_id)
				WHERE global_answer_id IS NOT NULL;

			CREATE INDEX IF NOT EXISTS idx_user_faq_answer_notification_user_seen
				ON user_faq_answer_notifications (user_id, seen_at, created_at DESC);
		`)
		if err != nil {
			return fmt.Errorf("create FAQ answer notifications: %w", err)
		}

		fmt.Println("Migration 55: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `DROP TABLE IF EXISTS user_faq_answer_notifications;`)
		return err
	})
}
