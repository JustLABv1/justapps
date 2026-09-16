package apps

import (
	"testing"
	"time"

	"justapps-backend/pkg/models"

	"github.com/google/uuid"
)

func TestFAQAnswerNotificationUsesQuestionAuthorAsRecipient(t *testing.T) {
	authorID := uuid.New()
	answererID := uuid.New()
	questionID := uuid.New()
	answerID := uuid.New()
	createdAt := time.Now().UTC()

	notification := newAppFAQAnswerNotification(
		models.FAQQuestion{ID: questionID, UserID: authorID},
		models.FAQAnswer{ID: answerID, AppID: "app-1", UserID: answererID, CreatedAt: createdAt},
	)
	if notification == nil {
		t.Fatal("expected a notification for an answer from another user")
	}
	if notification.UserID != authorID {
		t.Fatalf("recipient = %s, want question author %s", notification.UserID, authorID)
	}
	if notification.AppQuestionID == nil || *notification.AppQuestionID != questionID || notification.AppAnswerID == nil || *notification.AppAnswerID != answerID {
		t.Fatal("notification does not reference the answered app FAQ question and answer")
	}
}

func TestFAQAnswerNotificationSkipsSelfAnswer(t *testing.T) {
	authorID := uuid.New()
	if got := newGlobalFAQAnswerNotification(
		models.GlobalFAQQuestion{ID: uuid.New(), UserID: authorID},
		models.GlobalFAQAnswer{ID: uuid.New(), UserID: authorID},
	); got != nil {
		t.Fatal("self-answer must not notify the question author")
	}
}
