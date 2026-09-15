package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 54: creating global FAQ tables...")
		_, err := db.ExecContext(ctx, `
			CREATE TABLE IF NOT EXISTS global_faq_questions (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				username TEXT NOT NULL DEFAULT '',
				question TEXT NOT NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
			);
			CREATE INDEX IF NOT EXISTS idx_global_faq_questions_created_at
				ON global_faq_questions (created_at DESC);

			CREATE TABLE IF NOT EXISTS global_faq_answers (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				question_id UUID NOT NULL REFERENCES global_faq_questions(id) ON DELETE CASCADE,
				user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				username TEXT NOT NULL DEFAULT '',
				answer TEXT NOT NULL,
				is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
				creator_liked BOOLEAN NOT NULL DEFAULT FALSE,
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
			);
			CREATE INDEX IF NOT EXISTS idx_global_faq_answers_question
				ON global_faq_answers (question_id, created_at ASC);

			CREATE TABLE IF NOT EXISTS global_faq_answer_upvotes (
				answer_id UUID NOT NULL REFERENCES global_faq_answers(id) ON DELETE CASCADE,
				user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (answer_id, user_id)
			);
			CREATE INDEX IF NOT EXISTS idx_global_faq_answer_upvotes_user
				ON global_faq_answer_upvotes (user_id, created_at DESC);
		`)
		if err != nil {
			return fmt.Errorf("create global FAQ schema: %w", err)
		}
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `
			DROP TABLE IF EXISTS global_faq_answer_upvotes;
			DROP TABLE IF EXISTS global_faq_answers;
			DROP TABLE IF EXISTS global_faq_questions;
		`)
		return err
	})
}
