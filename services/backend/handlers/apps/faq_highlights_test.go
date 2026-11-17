package apps

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
)

func TestFAQQuestionHighlights(t *testing.T) {
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	solvedID, openID, answerID := uuid.New(), uuid.New(), uuid.New()
	mock.ExpectQuery(`(?i)SELECT DISTINCT a.question_id FROM faq_answers AS a .*accepted_by_author`).
		WillReturnRows(sqlmock.NewRows([]string{"question_id"}).AddRow(solvedID))
	mock.ExpectQuery(`(?i)SELECT DISTINCT ON \(a.question_id\) .*FROM faq_answers AS a LEFT JOIN faq_answer_upvotes AS v .*reply_to_answer_id IS NULL`).
		WillReturnRows(sqlmock.NewRows([]string{"question_id", "id", "username", "answer", "is_pinned", "creator_liked", "accepted_by_author", "upvote_count"}).
			AddRow(solvedID, answerID, "anna", "Mit Helm 3.", false, false, true, 2))

	solved, top, err := faqQuestionHighlights(context.Background(), db, "faq_answers", "faq_answer_upvotes", []uuid.UUID{solvedID, openID})
	if err != nil {
		t.Fatal(err)
	}
	if !solved[solvedID] || solved[openID] {
		t.Fatalf("solved = %v", solved)
	}
	if preview := top[solvedID]; preview == nil || preview.ID != answerID || !preview.AcceptedByAuthor || preview.UpvoteCount != 2 {
		t.Fatalf("top answer = %+v", top[solvedID])
	}
	if top[openID] != nil {
		t.Fatalf("question without answers got a preview")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestFAQQuestionHighlightsSkipsEmptyPage(t *testing.T) {
	solved, top, err := faqQuestionHighlights(context.Background(), nil, "faq_answers", "faq_answer_upvotes", nil)
	if err != nil || len(solved) != 0 || len(top) != 0 {
		t.Fatalf("unexpected result: %v %v %v", solved, top, err)
	}
}
