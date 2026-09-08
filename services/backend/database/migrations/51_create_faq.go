package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 51: creating FAQ tables and feature setting...")

		if _, err := db.ExecContext(ctx, `
			ALTER TABLE platform_settings
				ADD COLUMN IF NOT EXISTS faq_enabled BOOLEAN NOT NULL DEFAULT TRUE;

			CREATE TABLE IF NOT EXISTS faq_questions (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
				user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				username TEXT NOT NULL DEFAULT '',
				question TEXT NOT NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
			);

			CREATE INDEX IF NOT EXISTS idx_faq_questions_app_created_at
				ON faq_questions (app_id, created_at DESC);

			CREATE TABLE IF NOT EXISTS faq_answers (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				question_id UUID NOT NULL REFERENCES faq_questions(id) ON DELETE CASCADE,
				app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
				user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				username TEXT NOT NULL DEFAULT '',
				answer TEXT NOT NULL,
				is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
				creator_liked BOOLEAN NOT NULL DEFAULT FALSE,
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
			);

			CREATE INDEX IF NOT EXISTS idx_faq_answers_app_question
				ON faq_answers (app_id, question_id, created_at ASC);

			CREATE TABLE IF NOT EXISTS faq_answer_upvotes (
				answer_id UUID NOT NULL REFERENCES faq_answers(id) ON DELETE CASCADE,
				user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (answer_id, user_id)
			);

			CREATE INDEX IF NOT EXISTS idx_faq_answer_upvotes_user
				ON faq_answer_upvotes (user_id, created_at DESC);
		`); err != nil {
			return fmt.Errorf("create FAQ schema: %w", err)
		}

		fmt.Println("Migration 51: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 51 rollback: dropping FAQ tables and feature setting...")
		if _, err := db.ExecContext(ctx, `
			DROP TABLE IF EXISTS faq_answer_upvotes;
			DROP TABLE IF EXISTS faq_answers;
			DROP TABLE IF EXISTS faq_questions;
			ALTER TABLE platform_settings DROP COLUMN IF EXISTS faq_enabled;
		`); err != nil {
			return fmt.Errorf("drop FAQ schema: %w", err)
		}
		return nil
	})
}
