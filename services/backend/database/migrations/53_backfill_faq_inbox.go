package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 53: backfilling open FAQ questions into the inbox...")

		_, err := db.ExecContext(ctx, `
			INSERT INTO user_faq_inbox_items (user_id, question_id, app_id, created_at)
			SELECT candidate.user_id, question.id, question.app_id, question.created_at
			FROM faq_questions AS question
			JOIN (
				SELECT owner_id AS user_id, id AS app_id
				FROM apps
				WHERE owner_id IS NOT NULL
				UNION
				SELECT user_id, app_id
				FROM app_editors
			) AS candidate ON candidate.app_id = question.app_id
			JOIN users AS recipient ON recipient.id = candidate.user_id
			WHERE candidate.user_id <> question.user_id
			  AND recipient.disabled = FALSE
			  AND NOT EXISTS (
				  SELECT 1
				  FROM faq_answers AS answer
				  WHERE answer.question_id = question.id
			  )
			ON CONFLICT (user_id, question_id) DO NOTHING;
		`)
		if err != nil {
			return fmt.Errorf("backfill FAQ inbox: %w", err)
		}

		fmt.Println("Migration 53: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		// The inbox rows are owned by migration 52; rollback 53 only undoes
		// rows that can be identified as historical backfill is not tracked
		// separately. Keeping the rollback empty avoids deleting user state.
		return nil
	})
}
