package apps

import (
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

func TestGlobalFAQAcceptanceRequiresQuestionAuthor(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, test := range []struct {
		name, role string
		affected   int64
		accepted   bool
		status     int
	}{
		{"author accepts", "user", 1, true, 200},
		{"author retracts", "user", 1, false, 200},
		{"other user denied", "user", 0, true, 403},
		{"admin cannot override author", "admin", 0, true, 403},
	} {
		t.Run(test.name, func(t *testing.T) {
			sqlDB, mock, err := sqlmock.New()
			if err != nil {
				t.Fatal(err)
			}
			db := bun.NewDB(sqlDB, pgdialect.New())
			defer db.Close()
			userID, answerID := uuid.New(), uuid.New()
			mock.ExpectQuery("SELECT .*platform_settings").WillReturnRows(sqlmock.NewRows([]string{"faq_enabled"}).AddRow(true))
			mock.ExpectExec(fmt.Sprintf("(?i)UPDATE global_faq_answers AS answer SET accepted_by_author = %t .*answer.id = '%s'.*question.user_id = '%s'", test.accepted, answerID, userID)).WillReturnResult(sqlmock.NewResult(0, test.affected))
			if test.affected > 0 {
				mock.ExpectQuery("INSERT INTO .*audit").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(uuid.New()))
			}
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest("PATCH", "/faq/answers/"+answerID.String()+"/acceptance", strings.NewReader(fmt.Sprintf(`{"acceptedByAuthor":%t}`, test.accepted)))
			c.Request.Header.Set("Content-Type", "application/json")
			c.Params = gin.Params{{Key: "answerId", Value: answerID.String()}}
			c.Set("user_id", userID)
			c.Set("role", test.role)
			SetFAQAnswerAcceptance(c, db, true)
			if recorder.Code != test.status {
				t.Fatalf("status %d: %s", recorder.Code, recorder.Body.String())
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatal(err)
			}
		})
	}
}
