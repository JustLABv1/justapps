package users

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
)

func TestMarkFAQAnswerNotificationSeenIsRestrictedToRecipient(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("create mock database: %v", err)
	}
	defer sqlDB.Close()
	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	recipientID := uuid.New()
	notificationID := uuid.New()
	expectedQuery := fmt.Sprintf(`UPDATE "user_faq_answer_notifications" AS "ufan" SET seen_at = COALESCE\(seen_at, '.+'\) WHERE \(id = '%s'\) AND \(user_id = '%s'\)`, notificationID, recipientID)
	mock.ExpectExec(expectedQuery).
		WillReturnResult(sqlmock.NewResult(0, 1))

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPost, "/user/faq-answer-notifications/"+notificationID.String()+"/seen", nil)
	context.Params = gin.Params{{Key: "id", Value: notificationID.String()}}
	context.Set("user_id", recipientID)

	MarkFAQAnswerNotificationSeen(context, db)

	if context.Writer.Status() != http.StatusNoContent {
		t.Fatalf("status = %d, want %d; body=%s", context.Writer.Status(), http.StatusNoContent, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("database expectations: %v", err)
	}
}

func TestMarkFAQAnswerNotificationSeenReturnsNotFoundOutsideRecipient(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("create mock database: %v", err)
	}
	defer sqlDB.Close()
	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	requestingUserID := uuid.New()
	notificationID := uuid.New()
	expectedQuery := fmt.Sprintf(`UPDATE .*user_faq_answer_notifications.*WHERE \(id = '%s'\) AND \(user_id = '%s'\)`, notificationID, requestingUserID)
	mock.ExpectExec(expectedQuery).
		WillReturnResult(sqlmock.NewResult(0, 0))

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPost, "/user/faq-answer-notifications/"+notificationID.String()+"/seen", nil)
	context.Params = gin.Params{{Key: "id", Value: notificationID.String()}}
	context.Set("user_id", requestingUserID)

	MarkFAQAnswerNotificationSeen(context, db)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d; body=%s", recorder.Code, http.StatusNotFound, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("database expectations: %v", err)
	}
}
