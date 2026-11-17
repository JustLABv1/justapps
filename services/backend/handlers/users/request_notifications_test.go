package users

import (
	"fmt"
	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRequestNotificationSeenIsRecipientScoped(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, affected := range []int64{0, 1} {
		t.Run(fmt.Sprint(affected), func(t *testing.T) {
			sqlDB, mock, err := sqlmock.New()
			if err != nil {
				t.Fatal(err)
			}
			db := bun.NewDB(sqlDB, pgdialect.New())
			defer db.Close()
			user, id := uuid.New(), uuid.New()
			mock.ExpectExec(fmt.Sprintf(`UPDATE user_request_notifications .* WHERE id = '%s' AND user_id = '%s'`, id, user)).WillReturnResult(sqlmock.NewResult(0, affected))
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/user/request-notifications/"+id.String()+"/seen", nil)
			c.Params = gin.Params{{Key: "id", Value: id.String()}}
			c.Set("user_id", user)
			MarkRequestNotificationSeen(c, db)
			want := http.StatusNoContent
			if affected == 0 {
				want = http.StatusNotFound
			}
			if c.Writer.Status() != want {
				t.Fatalf("status %d: %s", c.Writer.Status(), recorder.Body.String())
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestRequestNotificationsListScopesAndPaginates(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()
	user := uuid.New()
	mock.ExpectQuery(fmt.Sprintf(`SELECT COUNT\(\*\).*WHERE n.user_id = '%s' AND n.seen_at IS NULL`, user)).WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(20))
	mock.ExpectQuery(fmt.Sprintf(`SELECT n.id.*WHERE n.user_id = '%s' AND n.seen_at IS NULL ORDER BY .* LIMIT 5 OFFSET 5`, user)).WillReturnRows(sqlmock.NewRows([]string{"id", "request_id", "title", "kind", "response", "created_at", "seen_at"}))
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/user/request-notifications?status=unread&page=2&pageSize=5", nil)
	c.Set("user_id", user)
	ListRequestNotifications(c, db)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status %d: %s", c.Writer.Status(), recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
