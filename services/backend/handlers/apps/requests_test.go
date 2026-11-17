package apps

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
)

func TestRequestMutationsRequireAuthentication(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handlers := map[string]func(*gin.Context, *bun.DB){
		"create": CreateRequest, "update": UpdateRequest, "delete": DeleteRequest,
		"vote":   func(c *gin.Context, db *bun.DB) { SetRequestVote(c, db, true) },
		"unvote": func(c *gin.Context, db *bun.DB) { SetRequestVote(c, db, false) },
	}
	for name, handler := range handlers {
		t.Run(name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/requests", nil)
			handler(c, nil)
			if recorder.Code != http.StatusUnauthorized {
				t.Fatalf("status %d: %s", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestRequestUpdateRejectsUnauthorizedChanges(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, test := range []struct {
		name, status, body string
		author             bool
	}{
		{"unrelated user cannot answer", requestOpen, `{"response":"Answer"}`, false},
		{"author cannot fulfill", requestOpen, `{"status":"fulfilled"}`, true},
		{"author cannot rewrite planned request", requestPlanned, `{"title":"Changed"}`, true},
		{"author cannot link an app", requestOpen, `{"linkedAppId":"app"}`, true},
	} {
		t.Run(test.name, func(t *testing.T) {
			sqlDB, mock, err := sqlmock.New()
			if err != nil {
				t.Fatal(err)
			}
			db := bun.NewDB(sqlDB, pgdialect.New())
			defer db.Close()
			viewer, author, id := uuid.New(), uuid.New(), uuid.New()
			if test.author {
				author = viewer
			}
			mock.ExpectQuery("SELECT r.id").WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "status", "title"}).AddRow(id, author, test.status, "Original"))
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPatch, "/requests/"+id.String(), strings.NewReader(test.body))
			c.Request.Header.Set("Content-Type", "application/json")
			c.Params = gin.Params{{Key: "id", Value: id.String()}}
			c.Set("user_id", viewer)
			c.Set("role", "user")
			UpdateRequest(c, db)
			if recorder.Code != http.StatusForbidden {
				t.Fatalf("status %d: %s", recorder.Code, recorder.Body.String())
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestLoadRequestIncludesVoterProfiles(t *testing.T) {
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()
	id, viewer := uuid.New(), uuid.New()
	for _, profiles := range []string{`[]`, `[{"id":"` + viewer.String() + `","username":"alex","displayName":"Alex","avatarUrl":"/avatar.png"}]`} {
		mock.ExpectQuery("SELECT r.id").WillReturnRows(sqlmock.NewRows([]string{"id", "voters"}).AddRow(id, profiles))
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodGet, "/requests", nil)
		row, err := loadRequest(c, db, id, viewer)
		if err != nil {
			t.Fatal(err)
		}
		if row.Voters == nil {
			t.Fatal("voters must serialize as an array")
		}
		if profiles != "[]" && (len(row.Voters) != 1 || row.Voters[0].ID != viewer || row.Voters[0].DisplayName != "Alex" || row.Voters[0].AvatarURL != "/avatar.png") {
			t.Fatalf("unexpected voters: %+v", row.Voters)
		}
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
