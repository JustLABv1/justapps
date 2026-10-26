package apps

import (
	"encoding/json"
	"fmt"
	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGlobalFAQReplyRejectsTargetOutsideQuestion(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()
	questionID, parentID := uuid.New(), uuid.New()
	mock.ExpectQuery("SELECT .*platform_settings").WillReturnRows(sqlmock.NewRows([]string{"faq_enabled"}).AddRow(true))
	mock.ExpectQuery("SELECT .*global_faq_questions").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(questionID))
	mock.ExpectQuery(fmt.Sprintf("SELECT EXISTS .*global_faq_answers.*id = '%s' AND question_id = '%s'", parentID, questionID)).WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("POST", "/faq", strings.NewReader(fmt.Sprintf(`{"answer":"Reply","replyToAnswerId":"%s"}`, parentID)))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "questionId", Value: questionID.String()}}
	c.Set("user_id", uuid.New())
	c.Set("role", "user")
	CreateGlobalFAQAnswer(c, db)
	if recorder.Code != 400 {
		t.Fatalf("status %d: %s", recorder.Code, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestGlobalFAQThreadsPaginateRootsAndIncludeNestedReplies(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()
	questionID, rootID, replyID, nestedID := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	mock.ExpectQuery("SELECT .*platform_settings").WillReturnRows(sqlmock.NewRows([]string{"faq_enabled"}).AddRow(true))
	mock.ExpectQuery("SELECT EXISTS .*global_faq_questions").WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery("SELECT count.*global_faq_answers AS a.*a.reply_to_answer_id IS NULL").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))
	mock.ExpectQuery("SELECT .*global_faq_answers AS a.*a.reply_to_answer_id IS NULL.*LIMIT 1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "question_id"}).AddRow(rootID, questionID))
	mock.ExpectQuery("SELECT .*a.id IN \\(WITH RECURSIVE thread_ids AS").
		WillReturnRows(sqlmock.NewRows([]string{"id", "question_id", "reply_to_answer_id"}).
			AddRow(replyID, questionID, rootID).
			AddRow(rootID, questionID, nil).
			AddRow(nestedID, questionID, replyID))
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("GET", "/faq?threaded=true&pageSize=1", nil)
	c.Params = gin.Params{{Key: "questionId", Value: questionID.String()}}
	c.Set("user_id", uuid.New())
	c.Set("role", "user")
	GetGlobalFAQAnswers(c, db)
	if recorder.Code != 200 {
		t.Fatalf("status %d: %s", recorder.Code, recorder.Body.String())
	}
	var result struct {
		Answers []struct {
			ID              uuid.UUID
			ReplyToAnswerID *uuid.UUID
		}
		Total   int
		HasMore bool
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if len(result.Answers) != 3 || result.Total != 2 || !result.HasMore {
		t.Fatalf("expected complete thread and pagination based on roots: %s", recorder.Body.String())
	}
	if result.Answers[2].ReplyToAnswerID == nil || *result.Answers[2].ReplyToAnswerID != replyID {
		t.Fatalf("nested reply lost its recipient: %s", recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
